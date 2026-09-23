import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { BankRepository } from '../../data/repositories/BankRepository';
import { QuestionRepository } from '../../data/repositories/QuestionRepository';
import type { MCQuestion, TFQuestion, EssayQuestion } from '../entities/Question';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { docxBlob, exportNewDocx, exportSourceDocx } from '../../infrastructure/document/docx/DocxBankWriter';

export const BankExportImportService = {
  async exportToDocx(bankId: string) {
    const bank = await BankRepository.getById(bankId);
    if (!bank) throw new Error('Không tìm thấy ngân hàng.');
    const questions = await QuestionRepository.getByBankId(bankId);
    const sources = (bank.docxSources ?? []).map(source => ({ ...source, id: source.id ?? uuidv4() }));
    if (sources.some((source, i) => source.id !== bank.docxSources?.[i].id)) await BankRepository.update(bankId, { docxSources: sources });
    const safeName = (name: string) => Array.from(name).map((char) => char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? '_' : char).join('');
    if (!sources.length) {
      saveAs(docxBlob(await exportNewDocx(bank.name, questions, { bankId, sourceId: `bank-${bankId}` })), `${safeName(bank.name)}.docx`);
      return;
    }
    const linked = new Set(sources.flatMap((source) => source.questions.map((q) => q.questionId)));
    const additions = questions.filter((q) => !linked.has(q.id));
    if (sources.length === 1) {
      saveAs(docxBlob(await exportSourceDocx(sources[0], questions, additions, { bankId, sourceId: sources[0].id })), safeName(sources[0].name));
      return;
    }
    // Each source retains its own page setup, styles, headers and media.
    const archive = new JSZip();
    for (const [index, source] of sources.entries()) {
      archive.file(`${index + 1}_${safeName(source.name)}`, await exportSourceDocx(source, questions, [], { bankId, sourceId: source.id }));
    }
    if (additions.length) archive.file('Cau_hoi_bo_sung.docx', await exportNewDocx(bank.name, additions, { bankId, sourceId: `bank-${bankId}` }));
    saveAs(await archive.generateAsync({ type: 'blob' }), `${safeName(bank.name)}_DOCX.zip`);
  },
  /**
   * Export a Bank and its questions to a JSON file.
   */
  async exportToJSON(bankId: string) {
    const bank = await BankRepository.getById(bankId);
    if (!bank) throw new Error('Bank not found');

    const questions = await QuestionRepository.getByBankId(bankId);
    
    const data = {
      bank,
      questions
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `${bank.name}_export.json`);
  },

  /**
   * Export a Bank and its questions to an Excel file.
   */
  async exportToExcel(bankId: string) {
    const bank = await BankRepository.getById(bankId);
    if (!bank) throw new Error('Bank not found');

    const questions = await QuestionRepository.getByBankId(bankId);

    // Flatten questions for Excel
    const rows = questions.map(q => {
      const base = {
        Type: q.type,
        Title: q.title,
        Content: q.content,
        Tags: q.tags.join(', '),
      };

      if (q.type === 'MULTIPLE_CHOICE') {
        const mc = q as MCQuestion;
        return {
          ...base,
          Choices: mc.choices.join('|'),
          Answer: mc.answer, // index
        };
      } else if (q.type === 'TRUE_FALSE') {
        // For TF, we might store choices if custom, or just assume True/False.
        // Current interface has choices/answers.
        const tf = q as TFQuestion;
        return {
          ...base,
          Choices: tf.choices.join('|'),
          Answer: JSON.stringify(tf.answers), 
        };
      } else {
        const essay = q as EssayQuestion;
        return {
          ...base,
          Choices: '',
          Answer: essay.answer || '',
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
    
    // Add Info sheet
    const infoRows = [{ Name: bank.name, Description: bank.description || '' }];
    const infoSheet = XLSX.utils.json_to_sheet(infoRows);
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Info');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${bank.name}_export.xlsx`);
  },

  /**
   * Import a Bank from a JSON file.
   */
  async importFromJSON(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.bank || !data.questions) {
      throw new Error('Invalid JSON format');
    }

    // Create new bank to avoid ID collisions
    const newBank = await BankRepository.create(data.bank.name + ' (Imported)', data.bank.description);
    const importedIds = new Map<string, string>();
    
    for (const q of data.questions) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, bankId, createdAt, ...rest } = q;
        const imported = await QuestionRepository.create({
          ...rest,
          bankId: newBank.id
        });
        importedIds.set(id, imported.id);
    }
    if (Array.isArray(data.bank.docxSources)) {
      await BankRepository.update(newBank.id, {
        docxSources: data.bank.docxSources.map((source: import('../entities/Bank').BankDocxSource) => ({
          ...source,
          questions: source.questions.map((entry) => ({ ...entry, questionId: entry.questionId ? importedIds.get(entry.questionId) : undefined })),
        })),
      });
    }
  },

  /**
   * Import a Bank from an Excel file.
   */
  async importFromExcel(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);

    // 1. Get Bank Info
    let bankName = file.name.replace(/\.[^/.]+$/, "") + ' (Imported)';
    let bankDesc = '';
    
    if (workbook.SheetNames.includes('Info')) {
      const infoSheet = workbook.Sheets['Info'];
      const infoData = XLSX.utils.sheet_to_json<{Name: string, Description: string}>(infoSheet);
      if (infoData.length > 0) {
        if(infoData[0].Name) bankName = infoData[0].Name + ' (Imported)';
        if(infoData[0].Description) bankDesc = infoData[0].Description;
      }
    }

    const newBank = await BankRepository.create(bankName, bankDesc);

    // 2. Get Questions
    const sheetName = workbook.SheetNames.includes('Questions') ? 'Questions' : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    for (const row of rows) {
      const type = row.Type;
      const title = row.Title || 'Untitled';
      const content = row.Content || '';
      const tags = row.Tags ? row.Tags.split(',').map((t: string) => t.trim()) : [];

      if (type === 'MULTIPLE_CHOICE') {
        const choices = row.Choices ? row.Choices.split('|') : [];
        const answer = typeof row.Answer === 'number' ? row.Answer : 0;
        await QuestionRepository.create({
          bankId: newBank.id,
          type: 'MULTIPLE_CHOICE',
          title,
          content,
          tags,
          choices,
          answer
        } as MCQuestion);
      } else if (type === 'TRUE_FALSE') {
         const choices = row.Choices ? row.Choices.split('|') : ['True', 'False'];
         let answers = [true, false];
         try {
            if (row.Answer) answers = JSON.parse(row.Answer);
         } catch {
             // fallback
         }
         await QuestionRepository.create({
            bankId: newBank.id,
            type: 'TRUE_FALSE',
            title,
            content,
            tags,
            choices,
            answers
         } as TFQuestion);
      } else if (type === 'ESSAY') {
          await QuestionRepository.create({
              bankId: newBank.id,
              type: 'ESSAY',
              title,
              content,
              tags,
              answer: row.Answer || ''
          } as EssayQuestion);
      }
    }
  }
};

import { ParserRegistry } from '../../core/import/parsers/ParserRegistry';
import { TrailingAnswerKeyParser } from '../../core/import/parsers/TrailingAnswerKeyParser';
import { DocxReader } from '../../infrastructure/document/docx/DocxReader';
import { readDocxIdentity } from '../../infrastructure/document/docx/DocxIdentity';
import type { Question } from '../../core/entities/Question';
import type { QuestionReviewItem } from '../../core/import/review/QuestionImportReview';
import { canImportReview } from '../../core/import/review/QuestionImportReview';
import { QuestionRepository } from '../../data/repositories/QuestionRepository';
import { db } from '../../data/db';
import type { QuestionParseResult } from '../../core/import/parsers/QuestionDocumentParser';
import { buildDocxImportPlan, type DocxImportOptions } from './DocxImportPlan';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

export const DOCX_MAX_FILE_SIZE = 20 * 1024 * 1024;
const registry = new ParserRegistry().register(new TrailingAnswerKeyParser());
export type DocxImportStage = 'reading' | 'detecting' | 'parsing' | 'validating';

export const DocxQuestionImportService = {
  validateFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.docx')) throw new Error('Chỉ chấp nhận file .docx.');
    if (file.size > DOCX_MAX_FILE_SIZE) throw new Error('File DOCX không được vượt quá 20 MB.');
    if (!file.size) throw new Error('File DOCX đang trống.');
  },

  async preview(file: File, onStage?: (stage: DocxImportStage) => void) {
    this.validateFile(file);
    onStage?.('reading');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await DocxReader.read(bytes);
    onStage?.('detecting');
    const selected = registry.select(document);
    if (!selected || selected.detection.confidence < 0.35) throw new Error('Không nhận diện được format ngân hàng câu hỏi trong DOCX.');
    onStage?.('parsing');
    const result = selected.parser.parse(document);
    const identity = await readDocxIdentity(await JSZip.loadAsync(bytes), result.questions);
    result.sourceDocx = { name: file.name, base64: await new JSZip().file('source', bytes).file('source')!.async('base64'), ...identity };
    onStage?.('validating');
    return result;
  },

  async plan(bankId: string, items: QuestionReviewItem[], source: QuestionParseResult['sourceDocx'], options: DocxImportOptions) {
    const bank = await db.banks.get(bankId);
    if (!bank) throw new Error('Ngân hàng không còn tồn tại.');
    return buildDocxImportPlan(bank, await db.questions.where('bankId').equals(bankId).toArray(), items, source, options);
  },

  async importConfirmed(bankId: string, items: QuestionReviewItem[], source?: QuestionParseResult['sourceDocx'], options: DocxImportOptions = { mode: 'append' }) {
    if (!bankId) throw new Error('Không xác định được ngân hàng đích.');
    if (!canImportReview(items)) throw new Error('Phiên review vẫn còn mục chưa được xử lý.');
    // Legacy callers without a DOCX still use the repository's atomic bulk import.
    if (!source && options.mode === 'append') {
      const plan = buildDocxImportPlan({ id: bankId, name: '', createdAt: 0, updatedAt: 0 }, [], items, source, options);
      return QuestionRepository.importMany(plan.operations.filter(op => op.action !== 'skipped').map(op => {
        if (!op.data) throw new Error('Dữ liệu câu hỏi không hợp lệ.');
        return op.data;
      }));
    }
    return db.transaction('rw', db.banks, db.questions, async () => {
      const bank = await db.banks.get(bankId);
      if (!bank) throw new Error('Ngân hàng không còn tồn tại.');
      const existing = await db.questions.where('bankId').equals(bankId).toArray();
      // Recompute inside the transaction so the preview cannot write stale mappings.
      const plan = buildDocxImportPlan(bank, existing, items, source, options);
      if (plan.operations.some(op => op.action === 'conflict')) throw new Error('Còn câu đối chiếu bị trùng. Hãy xử lý hoặc bỏ qua trước khi import.');
      const results: Question[] = [];
      const links = new Map<string, string>();
      const now = Date.now();
      for (const [index, op] of plan.operations.entries()) {
        if (op.action === 'skipped') {
          if (op.targetId) links.set(op.itemId, op.targetId);
          continue;
        }
        if (!op.data) throw new Error('Dữ liệu câu hỏi không hợp lệ.');
        const question = op.action === 'unchanged' && op.existing ? op.existing : {
          ...op.data, id: op.targetId ?? uuidv4(), createdAt: op.existing?.createdAt ?? now - index,
        } as Question;
        if (op.action !== 'unchanged') await db.questions.put(question);
        links.set(op.itemId, question.id);
        results.push(question);
      }
      if (source) {
        const previous = bank.docxSources ?? [];
        const newSource = {
          id: options.mode === 'update' ? previous[plan.sourceIndex]?.id ?? (source.bankId === bankId ? source.sourceId : undefined) ?? uuidv4() : uuidv4(),
          name: source.name, base64: source.base64,
          questions: items.map(item => ({ original: item.original, questionId: links.get(item.id) })),
        };
        const sources = [...previous];
        if (options.mode === 'update' && plan.sourceIndex >= 0) sources[plan.sourceIndex] = newSource;
        else sources.push(newSource);
        await db.banks.update(bankId, { docxSources: sources, updatedAt: now });
      }
      return results;
    });
  },
};

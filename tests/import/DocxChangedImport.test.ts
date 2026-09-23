// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { readFile, readdir } from 'node:fs/promises';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { BankRepository } from '../../src/data/repositories/BankRepository';
import { DocxQuestionImportService as service } from '../../src/application/import/DocxQuestionImportService';
import { confirmAllValid, createQuestionImportReview } from '../../src/core/import/review/QuestionImportReview';
import { exportSourceDocx, exportNewDocx } from '../../src/infrastructure/document/docx/DocxBankWriter';
import type { QuestionParseResult } from '../../src/core/import/parsers/QuestionDocumentParser';
import type { MCQuestion, TFQuestion } from '../../src/core/entities/Question';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const p = (text: string, red = false) => `<w:p><w:r>${red ? '<w:rPr><w:color w:val="FF0000"/></w:rPr>' : ''}<w:t>${text}</w:t></w:r></w:p>`;
const questionXml = (n: number) => p(`Câu ${n}. Nội dung ${n}`) + p('A. Một', true) + p('B. Hai') + p('C. Ba') + p('D. Bốn');
async function fixture(count = 2) {
  return new JSZip().file('word/document.xml', `<w:document xmlns:w="${W}"><w:body>${p('I. NHẬN BIẾT')}${Array.from({ length: count }, (_, i) => questionXml(i + 1)).join('')}</w:body></w:document>`).generateAsync({ type: 'uint8array' });
}
const preview = (bytes: Uint8Array) => service.preview({ name: 'bank.docx', size: bytes.length, arrayBuffer: async () => new Uint8Array(bytes).buffer } as File);
const review = (result: QuestionParseResult) => confirmAllValid(createQuestionImportReview(result).items);
async function setup(count = 2) {
  const bank = await BankRepository.create('Test');
  const parsed = await preview(await fixture(count));
  const questions = await service.importConfirmed(bank.id, review(parsed), parsed.sourceDocx);
  const source = (await db.banks.get(bank.id))!.docxSources![0];
  const identity = { bankId: bank.id, sourceId: source.id! };
  return { bank, questions, source, identity, bytes: await exportSourceDocx(source, questions, [], identity) };
}
beforeEach(async () => { await db.questions.clear(); await db.banks.clear(); });

describe('changed DOCX import', () => {
  it('updates a manually created bank and reuses its first imported source', async () => {
    const bank = await BankRepository.create('Manual');
    const question: MCQuestion = { id: 'manual1', bankId: bank.id, title: 'Câu 1', content: 'Mẫu', type: 'MULTIPLE_CHOICE', choices: ['Một', 'Hai', 'Ba', 'Bốn'], answer: 1, tags: [], createdAt: 1 };
    await db.questions.add(question);
    const parsed = await preview(await exportNewDocx(bank.name, [question], { bankId: bank.id, sourceId: `bank-${bank.id}` }));
    expect(parsed.questions[0].documentQuestionId).toBe(question.id);
    for (let n = 0; n < 2; n++) await service.importConfirmed(bank.id, review(parsed), parsed.sourceDocx, { mode: 'update' });
    expect(await db.questions.count()).toBe(1);
    expect((await db.banks.get(bank.id))!.docxSources).toHaveLength(1);
  });

  it('retains identities and tags in the supplied lesson DOCX files', async () => {
    const folder = 'exam-samples/Câu TN theo bài SGK 12 mới';
    for (const name of await readdir(folder)) {
      const bank = await BankRepository.create(name);
      const parsed = await preview(await readFile(`${folder}/${name}`));
      const questions = parsed.questions.map((q, i) => ({
        id: `q${i}`, bankId: bank.id, createdAt: 0, title: `Câu ${q.number}`, content: q.content,
        tags: q.tags ?? [...new Set([q.topic, q.lesson, q.section, q.level].filter((t): t is string => Boolean(t)))],
        type: q.type, choices: q.choices,
        ...(q.type === 'MULTIPLE_CHOICE' ? { answer: q.answer ?? 0 } : { answers: q.answer }),
      })) as Array<MCQuestion | TFQuestion>;
      const source = { ...parsed.sourceDocx!, id: 'sample', questions: parsed.questions.map((original, i) => ({ original, questionId: questions[i].id })) };
      const output = await preview(await exportSourceDocx(source, questions, [], { bankId: bank.id, sourceId: source.id! }));
      expect(output.questions.map(q => q.documentQuestionId), name).toEqual(questions.map(q => q.id));
      expect(output.questions.map(q => q.tags), name).toEqual(questions.map(q => q.tags));
    }
  }, 60000);

  it('reimports 59 questions twice without duplicating questions or sources', async () => {
    const { bank, questions, bytes } = await setup(59);
    const parsed = await preview(bytes);
    expect(parsed.questions.map(q => q.documentQuestionId)).toEqual(questions.map(q => q.id));
    expect(parsed.questions.every(q => q.tags?.includes('Nhận biết'))).toBe(true);
    for (let n = 0; n < 2; n++) {
      const plan = await service.plan(bank.id, review(parsed), parsed.sourceDocx, { mode: 'update' });
      expect(plan.operations.every(op => op.action === 'unchanged')).toBe(true);
      await service.importConfirmed(bank.id, review(parsed), parsed.sourceDocx, { mode: 'update' });
    }
    expect(await db.questions.count()).toBe(59);
    expect((await db.banks.get(bank.id))!.docxSources).toHaveLength(1);
  });

  it('keeps identities after renumbering/reordering and imports Word edits including empty tags', async () => {
    const { bank, questions, bytes } = await setup();
    const zip = await JSZip.loadAsync(bytes);
    const doc = new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'), 'application/xml');
    const paragraphs = Array.from(doc.getElementsByTagNameNS(W, 'p'));
    const texts = Array.from(doc.getElementsByTagNameNS(W, 't'));
    texts.find(n => n.textContent?.includes('Câu 1.'))!.textContent = 'Câu 99. Sửa trong Word';
    const tags = texts.filter(n => n.textContent?.startsWith('Tags:'));
    tags[0].textContent = 'Tags: Mới, Thông hiểu'; tags[1].textContent = 'Tags:';
    // Move the entire second question (including bookmarks and Tags) before the first.
    for (const node of paragraphs.slice(7, 13)) paragraphs[1].before(node);
    zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
    const parsed = await preview(await zip.generateAsync({ type: 'uint8array' }));
    expect(parsed.questions.map(q => q.documentQuestionId)).toEqual([questions[1].id, questions[0].id]);
    await service.importConfirmed(bank.id, review(parsed), parsed.sourceDocx, { mode: 'update' });
    expect(await db.questions.count()).toBe(2);
    expect(await db.questions.get(questions[0].id)).toMatchObject({ title: 'Câu 99', content: 'Sửa trong Word', tags: ['Mới', 'Thông hiểu'], createdAt: questions[0].createdAt });
    expect((await db.questions.get(questions[1].id))!.tags).toEqual([]);
    const source = (await db.banks.get(bank.id))!.docxSources![0];
    const roundTrip = await preview(await exportSourceDocx(source, await db.questions.toArray(), [], { bankId: bank.id, sourceId: source.id! }));
    expect(roundTrip.questions.map(q => q.tags)).toEqual([[], ['Mới', 'Thông hiểu']]);
    expect(roundTrip.questions.map(q => q.documentQuestionId)).toEqual([questions[1].id, questions[0].id]);
  });

  it('matches legacy files only within the selected source and retains absent questions', async () => {
    const { bank, questions, source } = await setup();
    const parsed = await preview(await fixture(1));
    parsed.questions[0].content = 'Legacy edit';
    await db.questions.update(questions[0].id, { tags: ['Giữ tag'] });
    await expect(service.plan(bank.id, review(parsed), parsed.sourceDocx, { mode: 'update' })).rejects.toThrow('Chọn file nguồn');
    await service.importConfirmed(bank.id, review(parsed), parsed.sourceDocx, { mode: 'update', targetSourceId: source.id });
    expect(await db.questions.count()).toBe(2);
    expect(await db.questions.get(questions[0].id)).toMatchObject({ content: 'Legacy edit', tags: ['Giữ tag'] });
  });

  it('adds new questions and rejects duplicate identities atomically', async () => {
    const { bank, questions, bytes } = await setup();
    const parsed = await preview(bytes);
    parsed.questions.push({ ...parsed.questions[0], key: 'new', number: 3, documentQuestionId: undefined });
    await service.importConfirmed(bank.id, review(parsed), parsed.sourceDocx, { mode: 'update' });
    expect(await db.questions.count()).toBe(3);
    const duplicate = await preview(bytes);
    duplicate.questions[1].documentQuestionId = questions[0].id;
    await expect(service.importConfirmed(bank.id, review(duplicate), duplicate.sourceDocx, { mode: 'update' })).rejects.toThrow('đối chiếu bị trùng');
    expect(await db.questions.count()).toBe(3);
  });
});

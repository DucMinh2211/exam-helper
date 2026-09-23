// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/data/db';
import { BankRepository } from '../../src/data/repositories/BankRepository';
import { QuestionRepository } from '../../src/data/repositories/QuestionRepository';
import { DocxQuestionImportService } from '../../src/application/import/DocxQuestionImportService';
import { createQuestionImportReview, confirmAllValid, setReviewDecision } from '../../src/core/import/review/QuestionImportReview';
import type { ParsedQuestion, QuestionParseResult } from '../../src/core/import/parsers/QuestionDocumentParser';
const question = (number: number): ParsedQuestion => ({ key: String(number), number, type: 'MULTIPLE_CHOICE', content: 'Câu mẫu', choices: ['A', 'B', 'C', 'D'], answer: 1, rawText: '', source: { blockStart: number, blockEnd: number }, confidence: 1, issues: [] });
const result: QuestionParseResult = { parserId: 'test', parserVersion: '1', confidence: 1, warnings: [], questions: [question(1), question(2)] };
beforeEach(async () => { await db.questions.clear(); await db.banks.clear(); });
describe('DOCX import source persistence', () => {
  it('imports inferred difficulty and respects explicitly edited/cleared tags', async () => {
    const bank = await BankRepository.create('Tags');
    const tagged = { ...result, questions: [
      { ...question(1), level: 'Nhận biết', lesson: 'Bài 1' },
      { ...question(2), level: 'Thông hiểu', tags: ['Tự chọn'] },
      { ...question(3), level: 'Vận dụng', tags: [] },
    ] };
    const items = confirmAllValid(createQuestionImportReview(tagged).items);
    const imported = await DocxQuestionImportService.importConfirmed(bank.id, items);
    expect(imported.map(q => q.tags)).toEqual([['Bài 1', 'Nhận biết'], ['Tự chọn'], []]);
  });
  it('persists sources and stable question identities across imports, edits and deletions', async () => {
    const bank = await BankRepository.create('Test');
    let items = confirmAllValid(createQuestionImportReview(result).items);
    items = setReviewDecision(items, items[1].id, 'skipped');
    const source = { name: 'a.docx', base64: 'c291cmNl' };
    const imported = await DocxQuestionImportService.importConfirmed(bank.id, items, source);
    expect(imported).toHaveLength(1);
    let saved = await BankRepository.getById(bank.id);
    expect(saved?.docxSources?.[0]).toMatchObject({ ...source, questions: [{ questionId: imported[0].id }, { questionId: undefined }] });
    await QuestionRepository.update(imported[0].id, { content: 'Đã sửa' });
    await DocxQuestionImportService.importConfirmed(bank.id, items, { ...source, name: 'b.docx' });
    await QuestionRepository.delete(imported[0].id);
    saved = await BankRepository.getById(bank.id);
    expect(saved?.docxSources?.map(s => s.name)).toEqual(['a.docx', 'b.docx']);
    expect(saved?.docxSources?.[0].questions[0].original.content).toBe('Câu mẫu');
    expect(saved?.docxSources?.[0].questions[0].questionId).toBe(imported[0].id);
    expect(await QuestionRepository.getByBankId(bank.id)).toHaveLength(1);
  });
  it('rolls back questions when saving their source fails', async () => {
    const bank = await BankRepository.create('Test');
    const update = vi.spyOn(db.banks, 'update').mockRejectedValueOnce(new Error('disk full'));
    await expect(DocxQuestionImportService.importConfirmed(bank.id, confirmAllValid(createQuestionImportReview(result).items), { name: 'a.docx', base64: 'test' })).rejects.toThrow('disk full');
    update.mockRestore();
    expect(await QuestionRepository.getByBankId(bank.id)).toHaveLength(0);
    expect((await BankRepository.getById(bank.id))?.docxSources).toBeUndefined();
  });
});

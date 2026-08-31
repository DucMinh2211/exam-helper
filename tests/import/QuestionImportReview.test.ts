import { describe, expect, it, vi } from 'vitest';
import {
  canImportReview,
  confirmAllValid,
  createQuestionImportReview,
  setReviewDecision,
  skipAllErrors,
  updateReviewQuestion,
} from '../../src/core/import/review/QuestionImportReview';
import type { ParsedQuestion, QuestionParseResult } from '../../src/core/import/parsers/QuestionDocumentParser';
import { DocxQuestionImportService } from '../../src/application/import/DocxQuestionImportService';
import { QuestionRepository } from '../../src/data/repositories/QuestionRepository';

function parsedQuestion(overrides: Partial<ParsedQuestion> = {}): ParsedQuestion {
  return {
    key: '1|MULTIPLE_CHOICE|1',
    topic: 'CHỦ ĐỀ 1',
    lesson: 'BÀI 1',
    section: 'PHẦN I',
    number: 1,
    type: 'MULTIPLE_CHOICE',
    content: 'Nội dung câu hỏi',
    choices: ['Một', 'Hai', 'Ba', 'Bốn'],
    answer: 0,
    confidence: 1,
    rawText: 'Câu 1. Nội dung câu hỏi',
    source: { blockStart: 1, blockEnd: 5 },
    issues: [],
    ...overrides,
  };
}

function parseResult(questions: ParsedQuestion[]): QuestionParseResult {
  return {
    parserId: 'TEST_PARSER',
    parserVersion: '1.0.0',
    questions,
    warnings: [],
    confidence: 1,
  };
}

describe('QuestionImportReview', () => {
  it('blocks import until valid questions are confirmed and errors are handled', () => {
    const result = parseResult([
      parsedQuestion(),
      parsedQuestion({ key: '1|MULTIPLE_CHOICE|2', number: 2, answer: null }),
    ]);
    let items = createQuestionImportReview(result).items;

    expect(items.map((item) => item.status)).toEqual(['valid', 'error']);
    items = confirmAllValid(items);
    expect(items.map((item) => item.status)).toEqual(['confirmed', 'error']);
    expect(canImportReview(items)).toBe(false);

    items = setReviewDecision(items, items[1].id, 'skipped');
    expect(canImportReview(items)).toBe(true);
  });

  it('revalidates immediately after edits and preserves the edited marker', () => {
    const result = parseResult([parsedQuestion({ answer: null, confidence: 0.5 })]);
    let items = createQuestionImportReview(result).items;
    expect(items[0].issues.map((issue) => issue.code)).toContain('INVALID_MC_ANSWER');

    items = updateReviewQuestion(items, items[0].id, (question) => ({ ...question, answer: 2 }));
    expect(items[0].status).toBe('valid');
    expect(items[0].wasEdited).toBe(true);

    items = setReviewDecision(items, items[0].id, 'confirmed');
    expect(items[0].status).toBe('confirmed');
    expect(canImportReview(items)).toBe(true);
  });

  it('recomputes duplicate keys and invalidates a previous confirmation', () => {
    const result = parseResult([
      parsedQuestion(),
      parsedQuestion({ key: '1|MULTIPLE_CHOICE|2', number: 2 }),
    ]);
    let items = confirmAllValid(createQuestionImportReview(result).items);
    expect(canImportReview(items)).toBe(true);

    items = updateReviewQuestion(items, items[1].id, (question) => ({ ...question, number: 1 }));
    expect(items.every((item) => item.status === 'error')).toBe(true);
    expect(items.every((item) => item.decision === 'pending')).toBe(true);
    expect(canImportReview(items)).toBe(false);
  });

  it('maps only confirmed questions to the selected bank', async () => {
    const result = parseResult([
      parsedQuestion(),
      parsedQuestion({ key: '1|MULTIPLE_CHOICE|2', number: 2 }),
    ]);
    let items = createQuestionImportReview(result).items;
    items = setReviewDecision(items, items[0].id, 'confirmed');
    items = setReviewDecision(items, items[1].id, 'skipped');
    const importMany = vi.spyOn(QuestionRepository, 'importMany').mockResolvedValue([]);

    await DocxQuestionImportService.importConfirmed('bank-123', items);

    expect(importMany).toHaveBeenCalledOnce();
    expect(importMany.mock.calls[0][0]).toEqual([
      expect.objectContaining({ bankId: 'bank-123', type: 'MULTIPLE_CHOICE', title: 'Câu 1', answer: 0 }),
    ]);
    importMany.mockRestore();
  });

  it('can skip every erroneous question in one action', () => {
    const result = parseResult([
      parsedQuestion(),
      parsedQuestion({ key: '1|MULTIPLE_CHOICE|2', number: 2, answer: null }),
      parsedQuestion({ key: '1|MULTIPLE_CHOICE|3', number: 3, content: '' }),
    ]);
    let items = createQuestionImportReview(result).items;

    items = skipAllErrors(items);

    expect(items.map((item) => item.status)).toEqual(['valid', 'skipped', 'skipped']);
    expect(items[0].decision).toBe('pending');
  });
});

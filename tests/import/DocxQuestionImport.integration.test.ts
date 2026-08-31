// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DocxReader } from '../../src/infrastructure/document/docx/DocxReader';
import { TrailingAnswerKeyParser } from '../../src/core/import/parsers/TrailingAnswerKeyParser';
import type { DocumentModel } from '../../src/core/import/models/DocumentModel';

describe('TrailingAnswerKeyParser', () => {
  it('parses both supported question types and joins answers by lesson/type/number', () => {
    const document: DocumentModel = {
      blocks: [
        { type: 'paragraph', index: 0, text: 'CHỦ ĐỀ 1: Lịch sử', rawText: 'CHỦ ĐỀ 1: Lịch sử' },
        { type: 'paragraph', index: 1, text: 'BÀI 2. Bài mẫu', rawText: 'BÀI 2. Bài mẫu' },
        { type: 'paragraph', index: 2, text: 'PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN', rawText: 'PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN' },
        { type: 'paragraph', index: 3, text: 'Câu 1. Nội dung câu hỏi', rawText: 'Câu 1. Nội dung câu hỏi' },
        { type: 'paragraph', index: 4, text: 'A. Một', rawText: 'A. Một' },
        { type: 'paragraph', index: 5, text: 'B. Hai', rawText: 'B. Hai' },
        { type: 'paragraph', index: 6, text: 'C. Ba', rawText: 'C. Ba' },
        { type: 'paragraph', index: 7, text: 'D. Bốn', rawText: 'D. Bốn' },
        { type: 'paragraph', index: 8, text: 'PHẦN II. LỰA CHỌN ĐÚNG - SAI', rawText: 'PHẦN II. LỰA CHỌN ĐÚNG - SAI' },
        { type: 'paragraph', index: 9, text: 'Câu 1: Tư liệu', rawText: 'Câu 1: Tư liệu' },
        { type: 'paragraph', index: 10, text: 'a. Ý một', rawText: 'a. Ý một' },
        { type: 'paragraph', index: 11, text: 'b. Ý hai', rawText: 'b. Ý hai' },
        { type: 'paragraph', index: 12, text: 'c. Ý ba', rawText: 'c. Ý ba' },
        { type: 'paragraph', index: 13, text: 'd. Ý bốn', rawText: 'd. Ý bốn' },
        {
          type: 'table',
          index: 14,
          rows: [
            ['Bài', '2'],
            ['1.A', '2.C', '3.B'],
            ['1', '2'],
            ['Đ', 'S'],
            ['S', 'Đ'],
            ['Đ', 'S'],
            ['S', 'Đ'],
          ],
          rawText: 'Bài | 2\n1.A | 2.C | 3.B\n1 | 2\nĐ | S\nS | Đ\nĐ | S\nS | Đ',
        },
      ],
    };

    const result = new TrailingAnswerKeyParser().parse(document);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].answer).toBe(0);
    expect(result.questions[1].answer).toEqual([true, false, true, false]);
    expect(result.questions[0].key).not.toBe(result.questions[1].key);
  });

  it('reads the repository DOCX fixture while preserving paragraphs and tables', async () => {
    const buffer = await readFile('exam-samples/file bộ đề sử 12.docx');
    const document = await DocxReader.read(buffer);
    const result = new TrailingAnswerKeyParser().parse(document);
    expect(document.blocks.some((block) => block.type === 'paragraph')).toBe(true);
    expect(document.blocks.some((block) => block.type === 'table')).toBe(true);
    expect(result.questions.length).toBeGreaterThan(100);
    expect(new Set(result.questions.map((question) => question.type))).toEqual(
      new Set(['MULTIPLE_CHOICE', 'TRUE_FALSE']),
    );
    expect(result.questions.filter((question) => question.answer !== null).length).toBeGreaterThan(500);
  });
});

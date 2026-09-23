// @vitest-environment jsdom
import { readdir, readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { DocxReader } from '../../src/infrastructure/document/docx/DocxReader';
import { TrailingAnswerKeyParser } from '../../src/core/import/parsers/TrailingAnswerKeyParser';

describe('formatted sample banks', () => {
  it('recognizes every lesson document', async () => {
    const folder = 'exam-samples/Câu TN theo bài SGK 12 mới';
    for (const name of await readdir(folder)) {
      const document = await DocxReader.read(await readFile(`${folder}/${name}`));
      const parser = new TrailingAnswerKeyParser();
      const result = parser.parse(document);
      const expected = [
        ['Bài 1 -', 54, 0], ['BÀI 10', 28, 1], ['BÀI 11', 40, 0], ['Bài 14', 35, 0],
        ['Bài 2', 66, 2], ['Bài 3', 28, 1], ['Bài 4', 34, 2], ['Bài 5', 30, null],
        ['BÀI 6', 49, 3], ['Bài 7', 52, 2], ['BÀI 8', 73, 2],
      ].find(([prefix]) => name.startsWith(String(prefix)))!;
      expect(result.questions.length, name).toBe(expected[1]);
      expect(result.questions[0].answer, name).toBe(expected[2]);
      expect(parser.detect(document).confidence).toBeGreaterThanOrEqual(0.35);
      expect(result.questions.length).toBeGreaterThan(10);
    }
  }, 60000);
});



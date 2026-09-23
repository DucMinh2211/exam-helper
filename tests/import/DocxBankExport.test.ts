// @vitest-environment jsdom
import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DocxReader } from '../../src/infrastructure/document/docx/DocxReader';
import { exportSourceDocx } from '../../src/infrastructure/document/docx/DocxBankWriter';
import { TrailingAnswerKeyParser } from '../../src/core/import/parsers/TrailingAnswerKeyParser';
import type { Question, MCQuestion, TFQuestion } from '../../src/core/entities/Question';
import type { ParsedQuestion } from '../../src/core/import/parsers/QuestionDocumentParser';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parser = new TrailingAnswerKeyParser();
function bankQuestion(q: ParsedQuestion, id: string): Question {
  return { id, bankId: 'bank', createdAt: 1, title: `Câu ${q.number}`, content: q.content, tags: q.tags ?? [...new Set([q.topic, q.lesson, q.section, q.level].filter(Boolean))], type: q.type,
    choices: q.choices, ...(q.type === 'MULTIPLE_CHOICE' ? { answer: q.answer } : { answers: q.answer }) } as Question;
}
async function setup(bytes: Uint8Array) {
  const parsed = parser.parse(await DocxReader.read(bytes));
  const questions = parsed.questions.map((q, index) => bankQuestion(q, String(index)));
  return { questions, source: { name: 'sample.docx', base64: Buffer.from(bytes).toString('base64'), questions: parsed.questions.map((original, index) => ({ original, questionId: String(index) })) } };
}
async function fixture(body: string) {
  const zip = new JSZip();
  zip.file('word/document.xml', `<w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`);
  zip.file('word/header1.xml', '<original-header/>');
  return zip.generateAsync({ type: 'uint8array' });
}
const r = (text: string, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const p = (runs: string) => `<w:p>${runs}</w:p>`;
const red = '<w:color w:val="FF0000"/>';
const u = '<w:u w:val="single"/>';

describe('DOCX bank round trip', () => {
  it('imports difficulty headings and exports edited tags without duplicating them', async () => {
    const questionXml = (n: number) => p(r(`Câu ${n}. Test`)) + ['A. một', 'B. hai', 'C. ba', 'D. bốn'].map((c, i) => p(r(c, i === 0 ? red : ''))).join('');
    const bytes = await fixture(p(r('BÀI 1. Bài mẫu')) + p(r('I. NHẬN BIẾT (2 câu)')) + questionXml(1) + questionXml(2)
      + p(r('II. THÔNG HIỂU')) + questionXml(3) + p(r('III. VẬN DỤNG CAO')) + questionXml(4)
      + p(r('BÀI 2. Bài khác')) + questionXml(5));
    const { questions, source } = await setup(bytes);
    expect(source.questions.map(q => q.original.level)).toEqual(['Nhận biết', 'Nhận biết', 'Thông hiểu', 'Vận dụng cao', undefined]);
    expect(questions[0].tags).toContain('Nhận biết');
    questions[0].tags = ['Thông hiểu', 'Tag mới', 'Tag, có dấu phẩy'];
    questions[1].content = 'Câu đã sửa';
    const output = await exportSourceDocx(source, questions);
    const reimported = await setup(output);
    expect(reimported.questions[0].tags).toEqual(questions[0].tags);
    expect(reimported.questions[1].tags).toEqual(questions[1].tags);
    expect(reimported.questions[1].content).toBe('Câu đã sửa');
    expect((reimported.questions[1] as MCQuestion).choices[3]).toBe('bốn');
    reimported.questions[0].tags = [];
    const nextOutput = await exportSourceDocx(reimported.source, reimported.questions);
    const final = await setup(nextOutput);
    expect(final.questions[0].tags).toEqual([]);
    expect(final.source.questions[0].original.tagFields).toHaveLength(1);
    expect(final.source.questions[1].original.tagFields).toHaveLength(1);
  });

  it('accepts bare question numbers and keeps numbered lists inside a question', async () => {
    const bytes = await fixture(p(r('1. Tư liệu')) + p(r('1. Dòng liệt kê đầu')) + p(r('2. Dòng liệt kê thứ hai'))
      + p(r('A. một', red) + r(' B. hai C. ba D. bốn')) + p(r('2) Câu tiếp A. một B. hai C. ba D. bốn', red)));
    const { questions, source } = await setup(bytes);
    expect(questions).toHaveLength(2);
    expect(questions[0].content).toContain('2. Dòng liệt kê thứ hai');
    expect(source.questions.map(q => q.original.number)).toEqual([1, 2]);
    questions[0].tags = ['Mới'];
    const exported = await exportSourceDocx(source, questions);
    expect((await setup(exported)).questions[0].tags).toEqual(['Mới']);
  });

  it('adds tags below a question sharing its paragraph with the next question', async () => {
    const bytes = await fixture(p(r('Câu 1. Một A. một B. hai C. ba D. bốn Câu 2. Hai A. một B. hai C. ba D. bốn', red)));
    const { questions, source } = await setup(bytes);
    questions[0].tags = ['Tag 1']; questions[1].tags = ['Tag 2'];
    const parsed = await setup(await exportSourceDocx(source, questions));
    expect(parsed.questions.map(q => q.tags)).toEqual([['Tag 1'], ['Tag 2']]);
  });
  it('detects partial markings, ignores stem/whitespace/disabled underline, and separates inline options', async () => {
    const bytes = await fixture(p(r('Câu 1. ') + r('không', red) + r(' đúng?'))
      + p(r('A. một ') + r('B', u) + r('. hai C. ba D. bốn'))
      + p(r('Câu 2. Test')) + p(r('A. một ') + r(' ', red) + r('B. hai ', '<w:u w:val="none"/>') + r('C. ba ') + r('D. b', red) + r('ốn')));
    const { source } = await setup(bytes);
    expect(source.questions.map(q => q.original.answer)).toEqual([1, 3]);
    expect(source.questions[0].original.choices).toEqual(['một', 'hai', 'ba', 'bốn']);
  });

  it('requires review for ambiguous markings', async () => {
    const bytes = await fixture(p(r('Câu 1. Test')) + p(r('A. một', red)) + p(r('B. hai', u)) + p(r('C. ba')) + p(r('D. bốn')));
    const { source } = await setup(bytes);
    expect(source.questions[0].original.answer).toBeNull();
    expect(source.questions[0].original.issues.some(i => i.code === 'AMBIGUOUS_ANSWER')).toBe(true);
  });

  it('round-trips edited text/answers with shared runs and retains all other package entries', async () => {
    const bytes = await fixture(p(r('BÀI 1. Test')) + p(r('Câu 1. Test')) + p(r('A. một B. hai C. ba D. bốn', red)));
    const { questions, source } = await setup(bytes);
    const q = questions[0] as MCQuestion;
    q.title = 'Câu 99'; q.content = 'Nội dung đã sửa & kiểm tra'; q.choices = ['một', 'lựa chọn mới dài hơn', 'ba', 'bốn']; q.answer = 1;
    const output = await exportSourceDocx(source, questions);
    const parsed = parser.parse(await DocxReader.read(output));
    expect(parsed.questions[0]).toMatchObject({ number: 99, content: q.content, choices: q.choices, answer: 1 });
    const zip = await JSZip.loadAsync(output);
    expect(await zip.file('word/header1.xml')!.async('string')).toBe('<original-header/>');
    expect(await zip.file('word/document.xml')!.async('string')).toContain('w:pgSz');
  });

  it('updates explicit true/false answer annotations separately from statement text', async () => {
    const bytes = await fixture(p(r('Câu 1. Tư liệu')) + ['a. Một (Đ)', 'b. Hai (S)', 'c. Ba (Đúng)', 'd. Bốn (Sai)'].map(t => p(r(t))).join(''));
    const { questions, source } = await setup(bytes);
    expect((questions[0] as TFQuestion).choices).toEqual(['Một', 'Hai', 'Ba', 'Bốn']);
    (questions[0] as TFQuestion).answers = [false, true, false, true];
    const parsed = parser.parse(await DocxReader.read(await exportSourceDocx(source, questions)));
    expect(parsed.questions[0].answer).toEqual([false, true, false, true]);
  });

  it('exports all-false answers even when only some source statements have annotations', async () => {
    const bytes = await fixture(p(r('Câu 1. Tư liệu')) + ['a. Một', 'b. Hai (S)', 'c. Ba', 'd. Bốn (Sai)'].map((t, i) => p(r(t, i === 0 ? red : ''))).join(''));
    const { questions, source } = await setup(bytes);
    (questions[0] as TFQuestion).answers = [false, false, false, false];
    const parsed = parser.parse(await DocxReader.read(await exportSourceDocx(source, questions)));
    expect(parsed.questions[0].answer).toEqual([false, false, false, false]);
  });

  it('preserves each supplied DOCX byte-for-byte when nothing was changed, and exports edits', async () => {
    const folder = 'exam-samples/Câu TN theo bài SGK 12 mới';
    for (const name of await readdir(folder)) {
      const bytes = await readFile(`${folder}/${name}`);
      const { questions, source } = await setup(bytes);
      expect(Buffer.from(await exportSourceDocx(source, questions)).equals(bytes), name).toBe(true);
      const index = questions.findIndex((q) => q.type === 'MULTIPLE_CHOICE' && typeof (q as MCQuestion).answer === 'number');
      const q = questions[index] as MCQuestion;
      q.content += ' KIỂM TRA XUẤT'; q.choices = q.choices.map((c, i) => i === 2 ? 'Lựa chọn đã sửa' : c); q.answer = 2;
      const exported = await exportSourceDocx(source, questions);
      const imported = parser.parse(await DocxReader.read(exported));
      expect(imported.questions[index].content, name).toBe(q.content);
      expect(imported.questions[index].choices, name).toEqual(q.choices);
      expect(imported.questions[index].answer, name).toBe(2);
      const before = await JSZip.loadAsync(bytes), after = await JSZip.loadAsync(exported);
      for (const path of Object.keys(before.files).filter(p => p !== 'word/document.xml' && !before.files[p].dir)) {
        expect(await after.file(path)!.async('base64'), `${name}: ${path}`).toBe(await before.file(path)!.async('base64'));
      }
    }
  }, 60000);

  it('removes deleted/skipped questions and appends new questions', async () => {
    const bytes = await fixture([1, 2].map(n => p(r(`Câu ${n}. Test`)) + ['A. một', 'B. hai', 'C. ba', 'D. bốn'].map((c, i) => p(r(c, i === 0 ? red : ''))).join('')).join(''));
    const { questions, source } = await setup(bytes);
    const addition = { ...questions[1], id: 'new', title: 'Câu 3' };
    const output = await exportSourceDocx(source, [questions[1]], [addition]);
    expect(parser.parse(await DocxReader.read(output)).questions.map(q => q.number)).toEqual([2, 3]);
  });

  it('keeps multi-paragraph content in its original paragraphs after appending text', async () => {
    const bytes = await fixture(p(r('Câu 1. Đoạn đầu', '<w:b/>')) + p(r('Đoạn hai', '<w:i/>')) + ['A. một', 'B. hai', 'C. ba', 'D. bốn'].map((c, i) => p(r(c, i === 0 ? red : ''))).join(''));
    const { questions, source } = await setup(bytes);
    questions[0].content += ' thêm nội dung';
    const output = await exportSourceDocx(source, questions);
    const xml = await (await JSZip.loadAsync(output)).file('word/document.xml')!.async('string');
    expect(xml).toContain(p(r('Câu 1. Đoạn đầu', '<w:b/>')));
    expect(parser.parse(await DocxReader.read(output)).questions[0].content).toBe(questions[0].content);
  });

  it('keeps neighboring questions when deleting one from a shared table', async () => {
    const questionXml = (n: number) => p(r(`Câu ${n}. Test`)) + ['A. một', 'B. hai', 'C. ba', 'D. bốn'].map((c, i) => p(r(c, i === 0 ? red : ''))).join('');
    const bytes = await fixture(`<w:tbl><w:tr><w:tc>${questionXml(1)}${questionXml(2)}</w:tc></w:tr></w:tbl>`);
    const { questions, source } = await setup(bytes);
    const output = await exportSourceDocx(source, [questions[1]]);
    expect(parser.parse(await DocxReader.read(output)).questions.map(q => q.number)).toEqual([2]);
  });

  it('exports a missing choice repaired in review instead of losing the repair', async () => {
    const bytes = await fixture(p(r('Câu 1. Test')) + ['A. một', 'B. hai', 'B. ba', 'D. bốn'].map((c, i) => p(r(c, i === 0 ? red : ''))).join(''));
    const { questions, source } = await setup(bytes);
    (questions[0] as MCQuestion).choices = ['một', 'hai', 'ba', 'bốn'];
    const output = await exportSourceDocx(source, questions);
    expect(parser.parse(await DocxReader.read(output)).questions[0].choices).toEqual(['một', 'hai', 'ba', 'bốn']);
  });

  it('updates the original answer table when true/false answers change', async () => {
    const name = 'exam-samples/Câu TN theo bài SGK 12 mới/Bài 1 - THPT Ba Đình (đã sửa).docx';
    const { questions, source } = await setup(await readFile(name));
    const index = questions.findIndex(q => q.type === 'TRUE_FALSE');
    const q = questions[index] as TFQuestion;
    q.answers = q.answers.map(a => !a);
    q.title = 'Câu 99';
    const output = await exportSourceDocx(source, questions);
    const parsed = parser.parse(await DocxReader.read(output));
    expect(parsed.questions[index].answer).toEqual(q.answers);
    expect(parsed.questions[index].number).toBe(99);
    expect(parsed.questions[index].answerFields).toHaveLength(4);
  });
});

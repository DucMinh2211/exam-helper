import type { DocumentBlock, DocumentModel, SourceRange, TableBlock, DocumentLine, TextRange } from '../models/DocumentModel';
import type {
  ImportIssue,
  ParsedQuestion,
  ParserDetection,
  QuestionDocumentParser,
  QuestionParseResult,
} from './QuestionDocumentParser';

export const TRAILING_ANSWER_KEY_FORMAT_ID = 'DOCX_QUESTION_BANK_WITH_TRAILING_ANSWER_KEY_V1';

type ParsedType = ParsedQuestion['type'];

interface Scope {
  level?: string;
  topic?: string;
  lesson?: string;
  section?: string;
  type: ParsedType;
}

interface DraftQuestion extends Scope {
  tags?: string[];
  tagFields: TextRange[];
  inlineAnswers: Map<string, boolean>;
  inlineAnswerFields: TextRange[];
  fields: NonNullable<ParsedQuestion['fields']>;
  markedChoices: Set<string>;
  number: number;
  content: string[];
  choices: Map<string, string[]>;
  activeChoice?: string;
  raw: string[];
  source: SourceRange;
}

interface AnswerKey {
  fields: Map<string, TextRange[]>;
  numbers: Map<string, TextRange[]>;
  multipleChoice: Map<string, number>;
  trueFalse: Map<string, boolean[]>;
  sourceBlocks: Set<number>;
}

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeHeading = (value: string) =>
  normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase();

function lessonId(value?: string): string {
  const normalized = normalizeHeading(value ?? '');
  return normalized.match(/\bBAI\s*[:.-]?\s*(\d+)/)?.[1] ?? normalized;
}

function questionKey(lesson: string | undefined, type: ParsedType, number: number): string {
  return `${lessonId(lesson)}|${type}|${number}`;
}

function linesFromBlock(block: DocumentBlock): string[] {
  if (block.type === 'paragraph') return block.text.split(/\r?\n/);
  return block.rows.flatMap((row) => row.flatMap((cell) => cell.split(/\r?\n/)));
}

function sourceLines(block: DocumentBlock): DocumentLine[] {
  const lines = block.lines ?? linesFromBlock(block).map((text) => ({ text, marked: [], range: { paragraph: -1, start: 0, end: text.length } }));
  return lines.flatMap((line) => {
    if (!/^\s*(?:Câu\s+\d+\s*[.:]|\d+\s*[.)])/i.test(line.text)) return [line];
    const boundaries = new Set([0, line.text.length]);
    for (const match of line.text.matchAll(/(?:^|\s)(Câu\s+\d+\s*[.:]|[A-D]\s*[.)])/gi)) {
      if (/^Câu/i.test(match[1]) && match.index! > 0 && !/[A-D]\s*[.)]/.test(line.text.slice(0, match.index))) continue;
      boundaries.add(match.index! + match[0].length - match[1].length);
    }
    const offsets = [...boundaries].sort((a, b) => a - b);
    return offsets.slice(0, -1).map((start, i) => ({ ...line, text: line.text.slice(start, offsets[i + 1]), range: range(line, start, offsets[i + 1]) }));
  });
}

function range(line: DocumentLine, start = 0, end = line.text.length): TextRange {
  return { paragraph: line.range.paragraph, start: line.range.start + start, end: line.range.start + end };
}

function trimmedRange(line: DocumentLine, start = 0, end = line.text.length): TextRange {
  const text = line.text.slice(start, end);
  return range(line, start + text.length - text.trimStart().length, end - (text.length - text.trimEnd().length));
}

function findLessonInTable(table: TableBlock): string | undefined {
  const cells = table.rows.flat().map(normalizeWhitespace);
  for (let index = 0; index < cells.length; index += 1) {
    const combined = `${cells[index]} ${cells[index + 1] ?? ''}`;
    const match = normalizeHeading(combined).match(/\bBAI\s*[:.-]?\s*(\d+)/);
    if (match) return match[1];
  }
  return undefined;
}

function parseMultipleChoiceKeys(table: TableBlock): Array<[number, number]> {
  const matches: Array<[number, number]> = [];
  for (const cell of table.rows.flat()) {
    const compact = normalizeWhitespace(cell);
    const pattern = /(?:^|\s)(\d+)\s*[.:-]?\s*([A-D])(?=\s|[.,;]|$)/gi;
    for (const match of compact.matchAll(pattern)) {
      matches.push([Number(match[1]), match[2].toUpperCase().charCodeAt(0) - 65]);
    }
  }
  return matches;
}

function truthValue(value: string): boolean | null {
  const normalized = normalizeHeading(value).replace(/[.,;:]/g, '');
  if (normalized === 'D' || normalized === 'DUNG') return true;
  if (normalized === 'S' || normalized === 'SAI') return false;
  return null;
}

function parseTrueFalseKeys(table: TableBlock): Array<[number, boolean[]]> {
  const matches: Array<[number, boolean[]]> = [];
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    const numberRow = table.rows[rowIndex].map((cell) => Number(normalizeWhitespace(cell).replace(/[.:]/g, '')));
    const numericColumns = numberRow
      .map((number, column) => ({ number, column }))
      .filter(({ number }) => Number.isInteger(number) && number > 0);
    if (numericColumns.length < 2) continue;

    for (const { number, column } of numericColumns) {
      const answers = [1, 2, 3, 4]
        .map((offset) => truthValue(table.rows[rowIndex + offset]?.[column] ?? ''));
      if (answers.every((answer) => answer !== null)) {
        matches.push([number, answers as boolean[]]);
      }
    }
  }
  return matches;
}

function extractAnswerKey(document: DocumentModel): AnswerKey {
  const result: AnswerKey = {
    fields: new Map(),
    numbers: new Map(),
    multipleChoice: new Map(),
    trueFalse: new Map(),
    sourceBlocks: new Set(),
  };

  let activeLesson: string | undefined;
  let contextLesson: string | undefined;
  let lessonHeadingBlock: number | undefined;

  for (const block of document.blocks) {
    if (block.type === 'paragraph') {
      const heading = normalizeHeading(block.text).match(/^BAI\s*[:.-]?\s*(\d+)/);
      if (heading) contextLesson = heading[1];
      const exactLesson = normalizeHeading(block.text).match(/^BAI\s*[:.-]?\s*(\d+)\s*[.:-]?$/);
      if (exactLesson) {
        activeLesson = exactLesson[1];
        lessonHeadingBlock = block.index;
      } else if (normalizeWhitespace(block.text)) {
        activeLesson = undefined;
        lessonHeadingBlock = undefined;
      }
      continue;
    }

    const lesson = findLessonInTable(block) ?? activeLesson ?? contextLesson;

    // Common school templates: Câu | Lệnh hỏi | Đáp án, repeated across columns.
    const labeledAnswers: Array<{ number: number; answers: boolean[]; fields: TextRange[] }> = [];
    block.rows.forEach((row, rowIndex) => row.forEach((cell, column) => {
      const number = Number(cell.trim());
      if (!Number.isInteger(number) || number < 1) return;
      const numberLine = block.cellLines?.[rowIndex]?.[column]?.find((line) => line.text.trim());
      if (numberLine) result.numbers.set(questionKey(lesson, 'TRUE_FALSE', number), [trimmedRange(numberLine)]);
      const label = normalizeWhitespace(row[column + 1] ?? '');
      if (/^a[.)]$/i.test(label)) {
        const answers = [0, 1, 2, 3].map((offset) => truthValue(block.rows[rowIndex + offset]?.[column + 2] ?? ''));
        if (answers.every((answer) => answer !== null)) labeledAnswers.push({ number, answers: answers as boolean[],
          fields: [0, 1, 2, 3].flatMap((offset) => (block.cellLines?.[rowIndex + offset]?.[column + 2] ?? []).filter((line) => line.text.trim()).map((line) => trimmedRange(line))),
        });
      } else if (/^A\s*B\s*C\s*D$/i.test(label)) {
        const lines = block.cellLines?.[rowIndex]?.[column + 2]?.filter((line) => line.text.trim()) ?? [];
        const answers = lines.map((line) => truthValue(line.text));
        if (answers.length === 4 && answers.every((answer) => answer !== null)) labeledAnswers.push({ number, answers: answers as boolean[], fields: lines.map((line) => trimmedRange(line)) });
      }
    }));
    if (labeledAnswers.length) {
      result.sourceBlocks.add(block.index);
      for (const entry of labeledAnswers) {
        const key = questionKey(lesson, 'TRUE_FALSE', entry.number);
        result.trueFalse.set(key, entry.answers);
        result.fields.set(key, entry.fields);
      }
      continue;
    }
    if (!lesson) continue;

    const mc = parseMultipleChoiceKeys(block);
    const tf = parseTrueFalseKeys(block);
    if (mc.length < 3 && tf.length < 2) continue;

    result.sourceBlocks.add(block.index);
    if (lessonHeadingBlock !== undefined) result.sourceBlocks.add(lessonHeadingBlock);
    for (const [number, answer] of mc) {
      result.multipleChoice.set(questionKey(lesson, 'MULTIPLE_CHOICE', number), answer);
    }
    for (const [number, answer] of tf) {
      result.trueFalse.set(questionKey(lesson, 'TRUE_FALSE', number), answer);
    }
    for (const line of block.lines ?? []) {
      for (const match of line.text.matchAll(/(?:^|\s)(\d+)\s*[.:-]?\s*([A-D])(?=\s|[.,;]|$)/gi)) {
        const start = match.index! + match[0].lastIndexOf(match[2]);
        result.fields.set(questionKey(lesson, 'MULTIPLE_CHOICE', Number(match[1])), [range(line, start, start + 1)]);
        const numberStart = match.index! + match[0].indexOf(match[1]);
        result.numbers.set(questionKey(lesson, 'MULTIPLE_CHOICE', Number(match[1])), [range(line, numberStart, numberStart + match[1].length)]);
      }
    }
    block.rows.forEach((row, rowIndex) => {
      row.forEach((cell, column) => {
        const number = Number(normalizeWhitespace(cell).replace(/[.:]/g, ''));
        if (!number || !tf.some(([n]) => n === number)) return;
        const lines = [1, 2, 3, 4].map((offset) => block.cellLines?.[rowIndex + offset]?.[column]?.[0]);
        if (lines.every((line) => line && truthValue(line.text) !== null)) {
          result.fields.set(questionKey(lesson, 'TRUE_FALSE', number), lines.map((line) => trimmedRange(line!)));
          const numberLine = block.cellLines?.[rowIndex]?.[column]?.[0];
          if (numberLine) result.numbers.set(questionKey(lesson, 'TRUE_FALSE', number), [trimmedRange(numberLine)]);
        }
      });
    });
  }

  return result;
}

function headingValue(line: string, heading: 'CHU DE' | 'BAI' | 'PHAN'): string | null {
  const normalized = normalizeHeading(line);
  if (heading === 'BAI' && !/^BAI\s*[:.-]?\s*\d+\b/.test(normalized)) return null;
  const pattern = new RegExp(`^${heading}\\s*(?:\\d+|[IVXLCDM]+)?\\s*[.:\\-]?\\s*`);
  return pattern.test(normalized) ? normalizeWhitespace(line) : null;
}

function sectionType(section: string): ParsedType {
  const normalized = normalizeHeading(section);
  return normalized.includes('DUNG') && normalized.includes('SAI') ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE';
}

function issue(
  code: string,
  message: string,
  severity: ImportIssue['severity'],
  source: SourceRange,
  key?: string,
): ImportIssue {
  return { code, message, severity, source, questionKey: key };
}

function finalizeDraft(draft: DraftQuestion, answerKey: AnswerKey): ParsedQuestion {
  const key = questionKey(draft.lesson, draft.type, draft.number);
  const labels = draft.type === 'MULTIPLE_CHOICE' ? ['A', 'B', 'C', 'D'] : ['a', 'b', 'c', 'd'];
  const choices = labels.map((label) => normalizeWhitespace((draft.choices.get(label) ?? []).join(' ')));
  const issues: ImportIssue[] = [];

  if (!normalizeWhitespace(draft.content.join(' '))) {
    issues.push(issue('MISSING_CONTENT', 'Câu hỏi thiếu nội dung.', 'error', draft.source, key));
  }
  const missingLabels = labels.filter((_, index) => !choices[index]);
  if (missingLabels.length) {
    issues.push(issue('MISSING_CHOICES', `Thiếu lựa chọn/mệnh đề: ${missingLabels.join(', ')}.`, 'error', draft.source, key));
  }

  let answer = draft.type === 'MULTIPLE_CHOICE'
    ? answerKey.multipleChoice.get(key) ?? null
    : answerKey.trueFalse.get(key) ?? null;
  if (draft.type === 'TRUE_FALSE' && answer === null) {
    if (labels.every((label) => draft.inlineAnswers.has(label))) answer = labels.map((label) => draft.inlineAnswers.get(label)!);
    else if (draft.markedChoices.size) answer = labels.map((label) => draft.markedChoices.has(label));
  }
  const markedIndices = labels.flatMap((label, index) => draft.markedChoices.has(label) ? [index] : []);
  if (draft.type === 'MULTIPLE_CHOICE' && markedIndices.length) {
    if (markedIndices.length > 1 || (answer !== null && answer !== markedIndices[0])) {
      answer = null;
      issues.push(issue('AMBIGUOUS_ANSWER', 'Định dạng đánh dấu nhiều đáp án hoặc mâu thuẫn với bảng đáp án. Hãy chọn lại.', 'error', draft.source, key));
    } else answer = markedIndices[0];
  }
  if (answer === null) {
    issues.push(issue('MISSING_ANSWER', 'Không tìm thấy đáp án rõ ràng từ gạch chân, chữ đỏ hoặc bảng đáp án.', 'error', draft.source, key));
  }

  const confidence = Math.max(0, 1 - issues.filter((item) => item.severity === 'error').length * 0.25);
  return {
    level: draft.level,
    tags: draft.tags,
    tagFields: draft.tagFields,
    answerFields: answerKey.fields.get(key) ?? (draft.inlineAnswerFields.length ? labels.map((_, index) => draft.inlineAnswerFields[index] ?? null) : undefined),
    answerNumberFields: answerKey.numbers.get(key),
    fields: draft.fields,
    key,
    topic: draft.topic,
    lesson: draft.lesson,
    section: draft.section,
    number: draft.number,
    type: draft.type,
    content: normalizeWhitespace(draft.content.join(' ')),
    choices,
    answer,
    confidence,
    rawText: draft.raw.join('\n'),
    source: draft.source,
    issues,
  };
}

export class TrailingAnswerKeyParser implements QuestionDocumentParser {
  readonly id = TRAILING_ANSWER_KEY_FORMAT_ID;
  readonly version = '1.0.0';

  detect(document: DocumentModel): ParserDetection {
    const text = document.blocks.map((block) => block.rawText).join('\n');
    const headings = [/(?:^|\n)\s*CHỦ\s*ĐỀ/i, /(?:^|\n)\s*BÀI/i, /(?:^|\n)\s*PHẦN/i]
      .filter((pattern) => pattern.test(text)).length;
    const questionCount = text.match(/(?:^|\n)\s*(?:Câu\s+\d+\s*[.:]|\d+\s*[.)])/gi)?.length ?? 0;
    const answerKey = extractAnswerKey(document);
    const hasAnswerKey = answerKey.sourceBlocks.size > 0;
    const hasMarks = document.blocks.some((block) => block.lines?.some((line) => line.marked.length));
    const confidence = Math.min(1, headings * 0.15 + Math.min(questionCount, 10) * 0.025 + (hasAnswerKey || (questionCount && hasMarks) ? 0.4 : 0));
    const reasons = [
      headings ? `Nhận diện ${headings}/3 cấp tiêu đề.` : 'Không thấy hệ thống tiêu đề.',
      `Tìm thấy ${questionCount} câu hỏi.`,
      hasAnswerKey ? `Tìm thấy ${answerKey.sourceBlocks.size} bảng đáp án theo bài.` : 'Không thấy bảng đáp án theo bài.',
    ];
    return { confidence, reasons };
  }

  parse(document: DocumentModel): QuestionParseResult {
    const answerKey = extractAnswerKey(document);
    const scope: Scope = { type: 'MULTIPLE_CHOICE' };
    const drafts: DraftQuestion[] = [];
    let current: DraftQuestion | null = null;

    const finish = () => {
      if (current) drafts.push(current);
      current = null;
    };

    for (const block of document.blocks) {
      if (answerKey.sourceBlocks.has(block.index)) {
        finish();
        continue;
      }

      for (const sourceLine of sourceLines(block)) {
        const rawLine = sourceLine.text;
        const line = normalizeWhitespace(rawLine);
        if (!line) continue;
        if (/^(?:[-–.\s]*HẾT[-–.\s]*|ĐÁP ÁN.*|PHẢN HỒI.*|Bottom of Form)$/i.test(line)) { finish(); continue; }
        if (/^Câu hỏi đúng\s*[-–]?\s*sai/i.test(line)) { finish(); scope.type = 'TRUE_FALSE'; continue; }

        const topic = headingValue(line, 'CHU DE');
        const lesson = headingValue(line, 'BAI');
        const section = headingValue(line.replace(/^[IVX]+\s*[.)]\s*/i, ''), 'PHAN')
          ?? (/^(?:[IVX]+[.)]\s*)?(?:CÂU\s*)?TRẮC NGHIỆM.*ĐÚNG.*SAI/i.test(line) ? line : null);
        if (topic || lesson || section) {
          finish();
          if (topic) { scope.topic = topic; scope.level = undefined; }
          if (lesson) { scope.lesson = lesson; scope.level = undefined; }
          if (section) {
            scope.section = section;
            scope.type = sectionType(section);
            scope.level = undefined;
          }
          continue;
        }

        const level = line.match(/^(?:(?:[IVX]+|\d+)\s*[.):-]\s*)?(NHẬN BIẾT|THÔNG HIỂU|VẬN DỤNG(?:\s+CAO)?)(?:\s*[:.-]?\s*(?:\(.*\)|\d+\s*câu))?\s*$/i);
        if (level) {
          finish();
          const levels: Record<string, string> = { 'NHAN BIET': 'Nhận biết', 'THONG HIEU': 'Thông hiểu', 'VAN DUNG': 'Vận dụng', 'VAN DUNG CAO': 'Vận dụng cao' };
          scope.level = levels[normalizeHeading(level[1])];
          continue;
        }

        // Bare numbering starts a question only outside an unfinished question.
        // This keeps numbered quotations/lists in an existing stem intact.
        const question: RegExpMatchArray | null = line.match(/^Câu\s+(\d+)\s*[.:]\s*(.*)$/i)
          ?? ((!current || current.choices.size >= 2) ? line.match(/^(\d+)\s*[.)]\s*(.+)$/) : null);
        if (question) {
          finish();
          current = {
            ...scope,
            tagFields: [],
            type: /đọc|tư liệu|thông tin/i.test(question[2]) && answerKey.trueFalse.has(questionKey(scope.lesson, 'TRUE_FALSE', Number(question[1]))) ? 'TRUE_FALSE' : scope.type,
            number: Number(question[1]),
            content: question[2] ? [question[2]] : [],
            choices: new Map(),
            inlineAnswers: new Map(), inlineAnswerFields: [],
            markedChoices: new Set(),
            fields: {
              title: [range(sourceLine, rawLine.search(/\S/), rawLine.search(/[.:)]/))],
              content: [trimmedRange(sourceLine, rawLine.search(/[.:)]/) + 1)],
              choices: [[], [], [], []], labels: [[], [], [], []],
            },
            raw: [rawLine],
            source: { blockStart: block.index, blockEnd: block.index },
          };
          continue;
        }
        if (!current) continue;

        current.source.blockEnd = block.index;
        current.raw.push(rawLine);
        const tagsLine = rawLine.match(/^\s*tags\s*:\s*(.*)$/i);
        if (tagsLine) {
          // Explicit exported tags override inherited headings, including an empty list.
          try {
            const value: unknown = JSON.parse(tagsLine[1]);
            if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) throw new Error('Not tags');
            current.tags = [...new Set(value.map((tag: string) => tag.trim()).filter(Boolean))];
          } catch {
            current.tags = [...new Set(tagsLine[1].split(/[,;]/).map((tag) => tag.trim()).filter(Boolean))];
          }
          current.tagFields.push(trimmedRange(sourceLine));
          continue;
        }
        // Word may put two/four options in one paragraph, including A/C then B/D.
        const matches = [...rawLine.matchAll(/(?:^|(?<=[\s.!?;]))([A-Da-d])\s*[.),]\s*/g)];
        if ((matches[0]?.[1] === 'a' || sourceLine.automaticLabel === 'a') && !current.choices.size) current.type = 'TRUE_FALSE';
        const labels = current.type === 'MULTIPLE_CHOICE' ? 'ABCD' : 'abcd';
        const choices = matches.filter((match) => labels.includes(current!.type === 'TRUE_FALSE' ? match[1].toLowerCase() : match[1]));
        const automaticLabel = current.type === 'TRUE_FALSE' ? sourceLine.automaticLabel?.toLowerCase() : sourceLine.automaticLabel;
        if (choices.length || (automaticLabel && labels.includes(automaticLabel))) {
          const entries = choices.length ? choices.map((match, index) => ({
            label: current!.type === 'TRUE_FALSE' ? match[1].toLowerCase() : match[1], start: match.index!, contentStart: match.index! + match[0].length,
            end: choices[index + 1]?.index ?? rawLine.length,
          })) : [{ label: automaticLabel!, start: 0, contentStart: 0, end: rawLine.length }];
          for (const entry of entries) {
            current.activeChoice = entry.label;
            const index = labels.indexOf(entry.label);
            const choiceText = rawLine.slice(entry.contentStart, entry.end);
            const explicit = current.type === 'TRUE_FALSE' ? choiceText.match(/\((Đ|S|Đúng|Sai)\)\s*[.]?\s*$/i) : null;
            const contentEnd = explicit ? entry.contentStart + explicit.index! : entry.end;
            if (explicit) {
              current.inlineAnswers.set(entry.label, truthValue(explicit[1])!);
              current.inlineAnswerFields[index] = range(sourceLine, contentEnd + 1, contentEnd + 1 + explicit[1].length);
            }
            current.choices.set(entry.label, [rawLine.slice(entry.contentStart, contentEnd)]);
            current.fields.choices[index].push(trimmedRange(sourceLine, entry.contentStart, contentEnd));
            current.fields.labels[index].push(range(sourceLine, entry.start, entry.contentStart));
            if (sourceLine.marked.some((mark) => {
              const start = Math.max(mark.start, sourceLine.range.start + entry.start);
              const end = Math.min(mark.end, sourceLine.range.start + entry.end);
              return start < end && rawLine.slice(start - sourceLine.range.start, end - sourceLine.range.start).trim();
            })) current.markedChoices.add(entry.label);
          }
        } else if (current.activeChoice) {
          current.choices.get(current.activeChoice)?.push(line);
          current.fields.choices[labels.indexOf(current.activeChoice)].push(trimmedRange(sourceLine));
          if (sourceLine.marked.some((mark) => mark.start < sourceLine.range.end && mark.end > sourceLine.range.start)) {
            current.markedChoices.add(current.activeChoice);
          }
        } else {
          current.content.push(line);
          current.fields.content.push(trimmedRange(sourceLine));
        }
      }
    }
    finish();

    const questions = drafts.map((draft) => finalizeDraft(draft, answerKey));
    const warnings = questions.flatMap((question) => question.issues);
    const seen = new Map<string, ParsedQuestion>();
    for (const question of questions) {
      const duplicate = seen.get(question.key);
      if (duplicate) {
        const duplicateIssue = issue('DUPLICATE_QUESTION_NUMBER', 'Trùng số câu trong cùng bài và phần.', 'error', question.source, question.key);
        question.issues.push(duplicateIssue);
        warnings.push(duplicateIssue);
        question.confidence = Math.min(question.confidence, 0.5);
      } else {
        seen.set(question.key, question);
      }
    }

    for (const key of [...answerKey.multipleChoice.keys(), ...answerKey.trueFalse.keys()]) {
      if (!seen.has(key)) {
        const source = { blockStart: 0, blockEnd: document.blocks.length - 1 };
        warnings.push(issue('EXTRA_ANSWER', `Bảng đáp án có khóa ${key} nhưng không tìm thấy câu hỏi.`, 'warning', source, key));
      }
    }

    const confidence = questions.length
      ? questions.reduce((sum, question) => sum + question.confidence, 0) / questions.length
      : 0;
    return { parserId: this.id, parserVersion: this.version, questions, warnings, confidence };
  }
}

import type { DocumentBlock, DocumentModel, SourceRange, TableBlock } from '../models/DocumentModel';
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
  topic?: string;
  lesson?: string;
  section?: string;
  type: ParsedType;
}

interface DraftQuestion extends Scope {
  number: number;
  content: string[];
  choices: Map<string, string[]>;
  activeChoice?: string;
  raw: string[];
  source: SourceRange;
}

interface AnswerKey {
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
    multipleChoice: new Map(),
    trueFalse: new Map(),
    sourceBlocks: new Set(),
  };

  let activeLesson: string | undefined;
  let lessonHeadingBlock: number | undefined;

  for (const block of document.blocks) {
    if (block.type === 'paragraph') {
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

    const lesson = findLessonInTable(block) ?? activeLesson;
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
  }

  return result;
}

function headingValue(line: string, heading: 'CHU DE' | 'BAI' | 'PHAN'): string | null {
  const normalized = normalizeHeading(line);
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

  const answer = draft.type === 'MULTIPLE_CHOICE'
    ? answerKey.multipleChoice.get(key) ?? null
    : answerKey.trueFalse.get(key) ?? null;
  if (answer === null) {
    issues.push(issue('MISSING_ANSWER', 'Không tìm thấy đáp án tương ứng trong bảng đáp án.', 'error', draft.source, key));
  }

  const confidence = Math.max(0, 1 - issues.filter((item) => item.severity === 'error').length * 0.25);
  return {
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
    const questionCount = text.match(/(?:^|\n)\s*Câu\s+\d+\s*[.:]/gi)?.length ?? 0;
    const answerKey = extractAnswerKey(document);
    const hasAnswerKey = answerKey.sourceBlocks.size > 0;
    const confidence = Math.min(1, headings * 0.15 + Math.min(questionCount, 10) * 0.025 + (hasAnswerKey ? 0.3 : 0));
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

      for (const rawLine of linesFromBlock(block)) {
        const line = normalizeWhitespace(rawLine);
        if (!line) continue;

        const topic = headingValue(line, 'CHU DE');
        const lesson = headingValue(line, 'BAI');
        const section = headingValue(line, 'PHAN');
        if (topic || lesson || section) {
          finish();
          if (topic) scope.topic = topic;
          if (lesson) scope.lesson = lesson;
          if (section) {
            scope.section = section;
            scope.type = sectionType(section);
          }
          continue;
        }

        const question = line.match(/^Câu\s+(\d+)\s*[.:]\s*(.*)$/i);
        if (question) {
          finish();
          current = {
            ...scope,
            number: Number(question[1]),
            content: question[2] ? [question[2]] : [],
            choices: new Map(),
            raw: [rawLine],
            source: { blockStart: block.index, blockEnd: block.index },
          };
          continue;
        }
        if (!current) continue;

        current.source.blockEnd = block.index;
        current.raw.push(rawLine);
        const choicePattern = current.type === 'MULTIPLE_CHOICE'
          ? /^([A-D])\s*[.)]\s*(.*)$/
          : /^([a-d])\s*[.)]\s*(.*)$/;
        const choice = line.match(choicePattern);
        if (choice) {
          current.activeChoice = current.type === 'MULTIPLE_CHOICE' ? choice[1] : choice[1].toLowerCase();
          current.choices.set(current.activeChoice, [choice[2]]);
        } else if (current.activeChoice) {
          current.choices.get(current.activeChoice)?.push(line);
        } else {
          current.content.push(line);
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

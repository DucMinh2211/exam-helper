import type { ParsedQuestion, QuestionParseResult } from '../parsers/QuestionDocumentParser';

export type ReviewStatus = 'valid' | 'warning' | 'error' | 'confirmed' | 'skipped';
export type ReviewDecision = 'pending' | 'confirmed' | 'skipped';
export type EditableAnswer = number | Array<boolean | null> | null;

export interface ReviewValidationIssue {
  code: string;
  message: string;
  suggestion: string;
  severity: 'warning' | 'error';
}

export interface EditableImportedQuestion {
  level?: string;
  tags?: string[];
  topic?: string;
  lesson?: string;
  section?: string;
  number: number;
  type: ParsedQuestion['type'];
  content: string;
  choices: string[];
  answer: EditableAnswer;
}

export interface QuestionReviewItem {
  id: string;
  original: ParsedQuestion;
  question: EditableImportedQuestion;
  issues: ReviewValidationIssue[];
  decision: ReviewDecision;
  status: ReviewStatus;
  wasEdited: boolean;
}

export interface QuestionImportReviewSession {
  parserId: string;
  parserVersion: string;
  sourceWarnings: QuestionParseResult['warnings'];
  items: QuestionReviewItem[];
}

function structuralIssues(
  question: EditableImportedQuestion,
  original: ParsedQuestion,
  wasEdited: boolean,
): ReviewValidationIssue[] {
  const issues: ReviewValidationIssue[] = [];
  if (!Number.isInteger(question.number) || question.number < 1) {
    issues.push({
      code: 'INVALID_NUMBER',
      message: 'Số câu phải là số nguyên lớn hơn 0.',
      suggestion: 'Nhập lại số câu theo đúng vị trí trong bài.',
      severity: 'error',
    });
  }
  if (!question.content.trim()) {
    issues.push({
      code: 'MISSING_CONTENT',
      message: 'Câu hỏi thiếu nội dung.',
      suggestion: 'Đối chiếu nội dung DOCX gốc và nhập nội dung câu hỏi.',
      severity: 'error',
    });
  }
  if (question.choices.length !== 4 || question.choices.some((choice) => !choice.trim())) {
    issues.push({
      code: 'INVALID_CHOICES',
      message: 'Format này yêu cầu đủ 4 lựa chọn hoặc mệnh đề.',
      suggestion: 'Điền đủ nội dung A/B/C/D hoặc a/b/c/d.',
      severity: 'error',
    });
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    if (typeof question.answer !== 'number'
      || !Number.isInteger(question.answer)
      || question.answer < 0
      || question.answer >= question.choices.length) {
      issues.push({
        code: 'INVALID_MC_ANSWER',
        message: 'Chưa có đáp án trắc nghiệm hợp lệ.',
        suggestion: 'Chọn một đáp án đúng trong A/B/C/D.',
        severity: 'error',
      });
    }
  } else if (!Array.isArray(question.answer)
    || question.answer.length !== question.choices.length
    || question.answer.some((answer) => typeof answer !== 'boolean')) {
    issues.push({
      code: 'INVALID_TF_ANSWERS',
      message: 'Chưa xác định đủ đáp án đúng/sai cho 4 mệnh đề.',
      suggestion: 'Chọn Đúng hoặc Sai cho từng mệnh đề.',
      severity: 'error',
    });
  }
  if (!wasEdited && original.confidence < 0.75) {
    issues.push({
      code: 'LOW_CONFIDENCE',
      message: `Parser chỉ đạt độ tin cậy ${Math.round(original.confidence * 100)}% cho câu này.`,
      suggestion: 'Đối chiếu nội dung DOCX gốc trước khi xác nhận.',
      severity: 'warning',
    });
  }
  return issues;
}

function reviewKey(question: EditableImportedQuestion): string {
  return `${question.lesson ?? ''}|${question.type}|${question.number}`;
}

function deriveStatus(item: Pick<QuestionReviewItem, 'decision' | 'issues'>): ReviewStatus {
  if (item.decision === 'skipped') return 'skipped';
  if (item.issues.some((issue) => issue.severity === 'error')) return 'error';
  if (item.decision === 'confirmed') return 'confirmed';
  if (item.issues.length) return 'warning';
  return 'valid';
}

export function revalidateReviewItems(items: QuestionReviewItem[]): QuestionReviewItem[] {
  const duplicateCounts = new Map<string, number>();
  for (const item of items) {
    if (item.decision === 'skipped') continue;
    const key = reviewKey(item.question);
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  return items.map((item) => {
    const issues = structuralIssues(item.question, item.original, item.wasEdited);
    if (item.decision !== 'skipped' && (duplicateCounts.get(reviewKey(item.question)) ?? 0) > 1) {
      issues.push({
        code: 'DUPLICATE_QUESTION_NUMBER',
        message: 'Trùng số câu trong cùng bài và loại câu hỏi.',
        suggestion: 'Sửa số câu hoặc bỏ qua một trong các câu bị trùng.',
        severity: 'error',
      });
    }
    const decision = item.decision === 'confirmed' && issues.some((issue) => issue.severity === 'error')
      ? 'pending'
      : item.decision;
    const next = { ...item, decision, issues };
    return { ...next, status: deriveStatus(next) };
  });
}

export function createQuestionImportReview(result: QuestionParseResult): QuestionImportReviewSession {
  const items = result.questions.map<QuestionReviewItem>((question, index) => {
    const editable: EditableImportedQuestion = {
      level: question.level,
      tags: question.tags ? [...question.tags] : undefined,
      topic: question.topic,
      lesson: question.lesson,
      section: question.section,
      number: question.number,
      type: question.type,
      content: question.content,
      choices: [...question.choices],
      answer: Array.isArray(question.answer) ? [...question.answer] : question.answer,
    };
    return {
      id: `${question.key}@${question.source.blockStart}:${index}`,
      original: question,
      question: editable,
      issues: [],
      decision: 'pending',
      status: 'valid',
      wasEdited: false,
    };
  });
  return {
    parserId: result.parserId,
    parserVersion: result.parserVersion,
    sourceWarnings: result.warnings,
    items: revalidateReviewItems(items),
  };
}

export function updateReviewQuestion(
  items: QuestionReviewItem[],
  id: string,
  update: (question: EditableImportedQuestion) => EditableImportedQuestion,
): QuestionReviewItem[] {
  return revalidateReviewItems(items.map((item) => item.id === id
    ? { ...item, question: update(item.question), decision: 'pending', wasEdited: true }
    : item));
}

export function setReviewDecision(
  items: QuestionReviewItem[],
  id: string,
  decision: ReviewDecision,
): QuestionReviewItem[] {
  const target = items.find((item) => item.id === id);
  if (!target) return items;
  if (decision === 'confirmed' && target.issues.some((issue) => issue.severity === 'error')) {
    throw new Error('Câu hỏi vẫn còn lỗi bắt buộc. Hãy sửa hoặc bỏ qua câu này.');
  }
  return revalidateReviewItems(items.map((item) => item.id === id ? { ...item, decision } : item));
}

export function confirmAllValid(items: QuestionReviewItem[]): QuestionReviewItem[] {
  return revalidateReviewItems(items.map((item) =>
    item.decision === 'pending' && !item.issues.some((issue) => issue.severity === 'error')
      ? { ...item, decision: 'confirmed' }
      : item));
}

export function skipAllErrors(items: QuestionReviewItem[]): QuestionReviewItem[] {
  return revalidateReviewItems(items.map((item) =>
    item.decision !== 'skipped' && item.issues.some((issue) => issue.severity === 'error')
      ? { ...item, decision: 'skipped' }
      : item));
}

export function canImportReview(items: QuestionReviewItem[]): boolean {
  return items.some((item) => item.decision === 'confirmed')
    && items.every((item) => (item.decision === 'confirmed' && !item.issues.some((issue) => issue.severity === 'error'))
      || item.decision === 'skipped');
}

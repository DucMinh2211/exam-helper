import type { Bank } from '../../core/entities/Bank';
import type { Question, NewQuestion, MCQuestion, TFQuestion } from '../../core/entities/Question';
import type { QuestionParseResult } from '../../core/import/parsers/QuestionDocumentParser';
import type { QuestionReviewItem } from '../../core/import/review/QuestionImportReview';

export interface DocxImportOptions { mode: 'append' | 'update'; targetSourceId?: string }
export type ImportAction = 'new' | 'update' | 'unchanged' | 'skipped' | 'conflict';
export interface DocxImportOperation {
  itemId: string;
  action: ImportAction;
  targetId?: string;
  existing?: Question;
  data?: NewQuestion;
  changes: string[];
  error?: string;
}
export const sourceKey = (bank: Bank, index: number) => bank.docxSources?.[index].id ?? `legacy:${index}`;
const text = (value: string) => value.replace(/\s+/g, ' ').trim();

export function buildDocxImportPlan(bank: Bank, existing: Question[], items: QuestionReviewItem[], source: QuestionParseResult['sourceDocx'], options: DocxImportOptions) {
  const sameBank = source?.bankId === bank.id;
  const target = options.targetSourceId ?? (sameBank ? source?.sourceId : undefined);
  const sourceIndex = (bank.docxSources ?? []).findIndex((_, index) => sourceKey(bank, index) === target);
  const previous = bank.docxSources?.[sourceIndex];
  if (options.mode === 'update' && sameBank && source?.sourceId && target !== source.sourceId) {
    throw new Error('File có định danh nguồn khác. Chọn đúng file nguồn đã xuất để cập nhật.');
  }
  if (options.mode === 'update' && !previous && !(sameBank && source?.sourceId && (!options.targetSourceId || options.targetSourceId === source.sourceId))) {
    throw new Error('Chọn file nguồn trong ngân hàng để đối chiếu trước khi cập nhật.');
  }
  const byId = new Map(existing.map(q => [q.id, q]));
  const operations: DocxImportOperation[] = items.map(item => {
    let targetId: string | undefined;
    let error: string | undefined;
    if (options.mode === 'update') {
      const documentId = item.original.documentQuestionId;
      if (documentId && sameBank && byId.has(documentId)) targetId = documentId;
      else if (!documentId || !sameBank) {
        const candidates = previous?.questions.filter(entry => entry.questionId && byId.has(entry.questionId)
          && (documentId && entry.original.documentQuestionId === documentId || entry.original.key === item.original.key)) ?? [];
        const ids = [...new Set(candidates.map(entry => entry.questionId!))];
        if (ids.length > 1) error = 'Có nhiều câu gốc cùng bài, loại và số câu. Bỏ qua câu này hoặc dùng file DOCX mới xuất có định danh.';
        else targetId = ids[0];
      }
    }
    const old = targetId ? byId.get(targetId) : undefined;
    const q = item.question;
    // A missing Tags line preserves the current Bank tags; an empty Tags: clears them.
    const tags = [...new Set(q.tags ?? (old ? old.tags : [q.topic, q.lesson, q.section, q.level].filter((tag): tag is string => Boolean(tag))))];
    const base = { bankId: bank.id, title: `Câu ${q.number}`, content: q.content.trim(), tags };
    let data: Extract<NewQuestion, { type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' }> | undefined;
    if (q.type === 'MULTIPLE_CHOICE' && typeof q.answer === 'number') data = { ...base, type: q.type, choices: q.choices.map(c => c.trim()), answer: q.answer };
    else if (q.type === 'TRUE_FALSE' && Array.isArray(q.answer) && q.answer.every(a => typeof a === 'boolean')) {
      data = { ...base, type: q.type, choices: q.choices.map(c => c.trim()), answers: q.answer as boolean[] };
    }
    const changes: string[] = [];
    if (old && data) {
      if (old.type !== data.type) changes.push('Loại câu');
      if (old.title !== data.title) changes.push('Số câu');
      if (text(old.content) !== text(data.content)) changes.push('Nội dung');
      if (JSON.stringify(old.tags) !== JSON.stringify(data.tags)) changes.push('Tags');
      const oldChoices = old.type === 'ESSAY' ? [] : (old as MCQuestion | TFQuestion).choices;
      if (JSON.stringify(oldChoices.map(text)) !== JSON.stringify(data.choices.map(text))) changes.push('Lựa chọn');
      const oldAnswer = old.type === 'TRUE_FALSE' ? (old as TFQuestion).answers : (old as MCQuestion).answer;
      const newAnswer = data.type === 'TRUE_FALSE' ? data.answers : data.answer;
      if (JSON.stringify(oldAnswer) !== JSON.stringify(newAnswer)) changes.push('Đáp án');
    }
    const action: ImportAction = item.decision === 'skipped' ? 'skipped' : error ? 'conflict' : !old ? 'new' : changes.length ? 'update' : 'unchanged';
    return { itemId: item.id, action, targetId, existing: old, data, changes, error };
  });
  const seen = new Map<string, DocxImportOperation>();
  for (const op of operations) {
    if (op.action === 'skipped' || !op.targetId) continue;
    const duplicate = seen.get(op.targetId);
    if (duplicate) {
      op.action = duplicate.action = 'conflict';
      op.error = duplicate.error = 'Hai câu trong DOCX cùng trỏ đến một câu trong Bank. Bỏ qua bản trùng trước khi cập nhật.';
    } else seen.set(op.targetId, op);
  }
  return { operations, sourceIndex };
}

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCheck, Eye, FileText, SkipForward } from 'lucide-react';
import { DocxQuestionImportService } from '../../../application/import/DocxQuestionImportService';
import {
  canImportReview,
  confirmAllValid,
  createQuestionImportReview,
  setReviewDecision,
  skipAllErrors,
  updateReviewQuestion,
  type EditableImportedQuestion,
  type QuestionReviewItem,
  type ReviewStatus,
} from '../../../core/import/review/QuestionImportReview';
import type { QuestionParseResult } from '../../../core/import/parsers/QuestionDocumentParser';

type ReviewFilter = 'all' | 'needs-review' | ReviewStatus;

interface DocxReviewWorkspaceProps {
  bankId: string;
  fileName: string;
  result: QuestionParseResult;
  onImported: (count: number) => void | Promise<void>;
}

const statusStyle: Record<ReviewStatus, { label: string; className: string }> = {
  valid: { label: 'Hợp lệ', className: 'bg-green-100 text-green-700' },
  warning: { label: 'Cảnh báo', className: 'bg-amber-100 text-amber-700' },
  error: { label: 'Lỗi', className: 'bg-red-100 text-red-700' },
  confirmed: { label: 'Đã xác nhận', className: 'bg-blue-100 text-blue-700' },
  skipped: { label: 'Bỏ qua', className: 'bg-gray-200 text-gray-600' },
};

const filters: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'needs-review', label: 'Cần xử lý' },
  { id: 'error', label: 'Lỗi' },
  { id: 'warning', label: 'Cảnh báo' },
  { id: 'valid', label: 'Hợp lệ' },
  { id: 'confirmed', label: 'Đã xác nhận' },
  { id: 'skipped', label: 'Bỏ qua' },
];

function hasBlockingError(item: QuestionReviewItem): boolean {
  return item.issues.some((issue) => issue.severity === 'error');
}

export default function DocxReviewWorkspace({ bankId, fileName, result, onImported }: DocxReviewWorkspaceProps) {
  const [session, setSession] = useState(() => createQuestionImportReview(result));
  const [filter, setFilter] = useState<ReviewFilter>('needs-review');
  const [selectedId, setSelectedId] = useState(() => {
    const initial = createQuestionImportReview(result).items;
    return (initial.find((item) => item.status === 'error' || item.status === 'warning') ?? initial[0])?.id ?? '';
  });
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);

  const counts = useMemo(() => session.items.reduce<Record<ReviewStatus, number>>((summary, item) => {
    summary[item.status] += 1;
    return summary;
  }, { valid: 0, warning: 0, error: 0, confirmed: 0, skipped: 0 }), [session.items]);

  const visibleItems = useMemo(() => session.items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'needs-review') return item.status === 'error' || item.status === 'warning' || item.status === 'valid';
    return item.status === filter;
  }), [filter, session.items]);

  const selected = session.items.find((item) => item.id === selectedId) ?? visibleItems[0] ?? session.items[0];
  const confirmedCount = session.items.filter((item) => item.decision === 'confirmed').length;
  const fixedCount = session.items.filter((item) => item.wasEdited && item.decision === 'confirmed').length;
  const sourceWarningCount = session.sourceWarnings.filter((warning) => warning.severity === 'warning').length;

  const updateSelected = (update: (question: EditableImportedQuestion) => EditableImportedQuestion) => {
    if (!selected) return;
    setMessage('');
    setSession((current) => ({ ...current, items: updateReviewQuestion(current.items, selected.id, update) }));
  };

  const decide = (item: QuestionReviewItem, decision: 'pending' | 'confirmed' | 'skipped') => {
    try {
      setMessage('');
      setSession((current) => ({ ...current, items: setReviewDecision(current.items, item.id, decision) }));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái.');
    }
  };

  const skip = (item: QuestionReviewItem) => {
    if (item.decision === 'skipped') {
      decide(item, 'pending');
      return;
    }
    if (window.confirm(`Bỏ qua Câu ${item.question.number}? Câu này sẽ không được import.`)) decide(item, 'skipped');
  };

  const skipEveryError = () => {
    const errorCount = session.items.filter((item) => item.status === 'error').length;
    if (!errorCount) return;
    if (window.confirm(`Bỏ qua toàn bộ ${errorCount} câu đang lỗi? Các câu này sẽ không được import.`)) {
      setMessage('');
      setSession((current) => ({ ...current, items: skipAllErrors(current.items) }));
    }
  };

  const importQuestions = async () => {
    setImporting(true);
    setMessage('');
    try {
      const imported = await DocxQuestionImportService.importConfirmed(bankId, session.items);
      await onImported(imported.length);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể import câu hỏi.');
    } finally {
      setImporting(false);
    }
  };

  if (!selected) return <p className="rounded-xl bg-amber-50 p-4 text-amber-700">Không tìm thấy câu hỏi để review.</p>;

  const answerArray = Array.isArray(selected.question.answer) ? selected.question.answer : [null, null, null, null];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-4 text-sm">
        <FileText size={20} className="text-blue-600" />
        <span className="font-bold text-gray-800">{fileName}</span>
        <span className="text-gray-500">{session.items.length} câu</span>
        <span className="font-bold text-red-600">{counts.error} lỗi</span>
        <span className="font-bold text-amber-600">{counts.warning} cảnh báo</span>
        <span className="ml-auto text-xs text-gray-400">{session.parserId} · v{session.parserVersion}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === item.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {item.label}{item.id !== 'all' && item.id !== 'needs-review' && ` (${counts[item.id]})`}
          </button>
        ))}
        <button
          type="button"
          disabled={counts.error === 0}
          onClick={skipEveryError}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        >
          <SkipForward size={15} /> Bỏ qua tất cả câu lỗi
        </button>
        <button
          type="button"
          onClick={() => setSession((current) => ({ ...current, items: confirmAllValid(current.items) }))}
          className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
        >
          <CheckCheck size={15} /> Xác nhận tất cả mục hợp lệ
        </button>
      </div>

      <div className="grid min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 lg:grid-cols-[280px_1fr]">
        <aside className="max-h-[680px] overflow-auto border-b border-gray-200 bg-gray-50 p-2 lg:border-b-0 lg:border-r">
          {visibleItems.length === 0 && <p className="p-5 text-center text-sm text-gray-500">Không có mục phù hợp bộ lọc.</p>}
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`mb-1 w-full rounded-xl p-3 text-left ${selected.id === item.id ? 'bg-white shadow-sm ring-2 ring-blue-500' : 'hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-gray-800">Câu {item.question.number}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle[item.status].className}`}>{statusStyle[item.status].label}</span>
              </div>
              <p className="mt-1 truncate text-xs text-gray-500">{item.question.lesson || 'Chưa xác định bài'}</p>
              <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.question.content || 'Chưa có nội dung'}</p>
            </button>
          ))}
        </aside>

        <section className="max-h-[680px] space-y-5 overflow-auto p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
            <span>{selected.question.topic || 'Chưa có chủ đề'}</span><span>›</span>
            <span>{selected.question.lesson || 'Chưa có bài'}</span><span>›</span>
            <span>{selected.question.section || 'Chưa có phần'}</span>
            <span className={`ml-auto rounded-full px-3 py-1 ${statusStyle[selected.status].className}`}>{statusStyle[selected.status].label}</span>
          </div>

          {selected.issues.length > 0 && (
            <div className="space-y-2">
              {selected.issues.map((issue) => (
                <div key={issue.code} className={`rounded-xl border p-3 text-sm ${issue.severity === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  <p className="flex items-center gap-2 font-bold"><AlertTriangle size={16} /> {issue.message}</p>
                  <p className="mt-1 text-xs opacity-80">Gợi ý: {issue.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs font-black uppercase text-gray-500">
              Loại câu hỏi
              <select
                value={selected.question.type}
                onChange={(event) => updateSelected((question) => ({
                  ...question,
                  type: event.target.value as EditableImportedQuestion['type'],
                  answer: null,
                }))}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case text-gray-800"
              >
                <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
                <option value="TRUE_FALSE">Đúng / Sai</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase text-gray-500">
              Số câu
              <input
                type="number"
                min={1}
                value={selected.question.number}
                onChange={(event) => updateSelected((question) => ({ ...question, number: Number(event.target.value) }))}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold normal-case text-gray-800"
              />
            </label>
          </div>

          <label className="block text-xs font-black uppercase text-gray-500">
            Nội dung
            <textarea
              value={selected.question.content}
              onChange={(event) => updateSelected((question) => ({ ...question, content: event.target.value }))}
              className="mt-2 min-h-28 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium normal-case text-gray-800"
            />
          </label>

          <div className="space-y-3">
            <p className="text-xs font-black uppercase text-gray-500">Lựa chọn và đáp án</p>
            {selected.question.choices.map((choice, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 sm:flex-row sm:items-center">
                <span className="w-6 text-sm font-black text-gray-500">{String.fromCharCode((selected.question.type === 'MULTIPLE_CHOICE' ? 65 : 97) + index)}</span>
                <input
                  value={choice}
                  onChange={(event) => updateSelected((question) => ({
                    ...question,
                    choices: question.choices.map((current, choiceIndex) => choiceIndex === index ? event.target.value : current),
                  }))}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
                {selected.question.type === 'TRUE_FALSE' && (
                  <select
                    value={answerArray[index] === null ? '' : String(answerArray[index])}
                    onChange={(event) => updateSelected((question) => {
                      const answers = Array.isArray(question.answer) ? [...question.answer] : [null, null, null, null];
                      answers[index] = event.target.value === '' ? null : event.target.value === 'true';
                      return { ...question, answer: answers };
                    })}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    <option value="">Chưa chọn</option>
                    <option value="true">Đúng</option>
                    <option value="false">Sai</option>
                  </select>
                )}
              </div>
            ))}
            {selected.question.type === 'MULTIPLE_CHOICE' && (
              <label className="block text-xs font-black uppercase text-gray-500">
                Đáp án đúng
                <select
                  value={typeof selected.question.answer === 'number' ? selected.question.answer : ''}
                  onChange={(event) => updateSelected((question) => ({ ...question, answer: event.target.value === '' ? null : Number(event.target.value) }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case text-gray-800"
                >
                  <option value="">Chưa chọn</option>
                  {selected.question.choices.map((_, index) => <option key={index} value={index}>{String.fromCharCode(65 + index)}</option>)}
                </select>
              </label>
            )}
          </div>

          <details className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-700"><Eye size={16} /> Nội dung DOCX gốc · block {selected.original.source.blockStart}–{selected.original.source.blockEnd}</summary>
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-gray-600">{selected.original.rawText}</pre>
          </details>

          <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={() => skip(selected)} className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200">
              <SkipForward size={17} /> {selected.decision === 'skipped' ? 'Khôi phục' : 'Bỏ qua câu'}
            </button>
            <button
              type="button"
              disabled={hasBlockingError(selected) || selected.decision === 'skipped'}
              onClick={() => decide(selected, selected.decision === 'confirmed' ? 'pending' : 'confirmed')}
              className="ml-auto flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Check size={17} /> {selected.decision === 'confirmed' ? 'Bỏ xác nhận' : 'Xác nhận câu'}
            </button>
          </div>
        </section>
      </div>

      {message && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</div>}

      {sourceWarningCount > 0 && (
        <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <summary className="cursor-pointer text-sm font-bold">{sourceWarningCount} cảnh báo cấp tài liệu vẫn được giữ lại</summary>
          <div className="mt-3 max-h-40 space-y-2 overflow-auto">
            {session.sourceWarnings.filter((warning) => warning.severity === 'warning').map((warning, index) => (
              <p key={`${warning.code}-${index}`} className="rounded-lg bg-white/70 p-2 text-xs">
                {warning.message} <span className="text-amber-600">(block {warning.source.blockStart}–{warning.source.blockEnd})</span>
              </p>
            ))}
          </div>
        </details>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <h3 className="font-black text-gray-900">Tổng kết trước khi import</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-center text-sm md:grid-cols-5">
          <div><strong className="block text-xl text-blue-700">{confirmedCount}</strong>Đã xác nhận</div>
          <div><strong className="block text-xl text-purple-700">{fixedCount}</strong>Đã sửa</div>
          <div><strong className="block text-xl text-gray-600">{counts.skipped}</strong>Bỏ qua</div>
          <div><strong className="block text-xl text-red-600">{counts.error}</strong>Lỗi còn lại</div>
          <div><strong className="block text-xl text-amber-600">{sourceWarningCount + counts.warning}</strong>Cảnh báo</div>
        </div>
        <button
          type="button"
          disabled={!canImportReview(session.items) || importing}
          onClick={() => void importQuestions()}
          className="mt-4 w-full rounded-2xl bg-green-600 py-3 font-black text-white shadow-lg shadow-green-100 hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          {importing ? 'Đang import trong transaction...' : `Import ${confirmedCount} câu vào ngân hàng hiện tại`}
        </button>
        {!canImportReview(session.items) && <p className="mt-2 text-center text-xs text-gray-500">Hãy sửa hoặc bỏ qua các lỗi, sau đó xác nhận tất cả câu sẽ import.</p>}
      </div>
    </div>
  );
}

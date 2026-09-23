import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Edit2, FileUp, Download, Search, X } from 'lucide-react';
import { BankService } from '../../../core/services/BankService';
import { QuestionService } from '../../../core/services/QuestionService';
import { BankExportImportService } from '../../../core/services/BankExportImportService';
import type { Bank } from '../../../core/entities/Bank';
import type { Question, MCQuestion, TFQuestion, EssayQuestion } from '../../../core/entities/Question';
import ImportDocxPanel from './ImportDocxPanel';
import QuestionEditorDrawer from './QuestionEditorDrawer';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const typeLabels = { MULTIPLE_CHOICE: 'Trắc nghiệm', TRUE_FALSE: 'Đúng / Sai', ESSAY: 'Tự luận' };

export default function BankEditor() {
  const { id } = useParams<{ id: string }>();
  const [bank, setBank] = useState<Bank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  // undefined = closed, null = new question, object = edit existing question.
  const [editing, setEditing] = useState<Question | null | undefined>(undefined);
  const [showDocxImport, setShowDocxImport] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const availableTags = [...new Set(questions.flatMap(q => q.tags))].sort((a, b) => a.localeCompare(b, 'vi'));
  const filtered = questions.filter(q => (!typeFilter || q.type === typeFilter)
    && (!tagFilter || q.tags.includes(tagFilter))
    && normalize([q.title, q.content, ...q.tags, ...(q.type === 'ESSAY' ? [] : (q as MCQuestion | TFQuestion).choices)].join(' ')).includes(normalize(search.trim())));
  const currentIndex = editing ? filtered.findIndex(q => q.id === editing.id) : -1;
  const clearFilters = () => { setSearch(''); setTypeFilter(''); setTagFilter(''); };

  async function loadData(bankId: string) {
    const data = await BankService.getBankDetails(bankId);
    if (!data) throw new Error('Không tìm thấy ngân hàng.');
    setBank(data);
    setQuestions(await QuestionService.getQuestionsByBank(bankId));
  }
  useEffect(() => {
    if (id) void loadData(id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Không thể tải ngân hàng.'));
  }, [id]);

  const remove = async (q: Question) => {
    if (!window.confirm(`Xóa ${q.title} khỏi ngân hàng?`)) return;
    setDeleting(q.id); setError('');
    try {
      await QuestionService.deleteQuestion(q.id);
      setQuestions(current => current.filter(item => item.id !== q.id));
      setNotice(`Đã xóa ${q.title}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xóa câu hỏi.'); }
    finally { setDeleting(null); }
  };
  const onSaved = (q: Question, next?: Question) => {
    setQuestions(current => current.some(item => item.id === q.id) ? current.map(item => item.id === q.id ? q : item) : [q, ...current]);
    setNotice(`Đã lưu ${q.title}. Thay đổi sẽ có trong lần xuất DOCX tiếp theo.`);
    setEditing(next);
  };
  if (!bank) return <p role={error ? 'alert' : 'status'} className="p-8 text-center text-slate-500">{error || 'Đang tải ngân hàng…'}</p>;

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center gap-3">
      <Link to="/" aria-label="Về danh sách ngân hàng" className="rounded-xl border p-2.5 text-slate-500 hover:bg-slate-50"><ArrowLeft size={20}/></Link>
      <div className="min-w-0 flex-1"><h1 className="break-words text-2xl font-bold text-slate-900">{bank.name}</h1><p className="mt-1 text-sm text-slate-500">{questions.length} câu hỏi · Chọn câu để chỉnh sửa</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowDocxImport(visible => !visible)} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileUp size={17}/>Import / cập nhật DOCX</button>
        <button type="button" disabled={exporting} onClick={async () => {
          setExporting(true); setError('');
          try { await BankExportImportService.exportToDocx(bank.id); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xuất DOCX.'); }
          finally { setExporting(false); }
        }} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={17}/>{exporting ? 'Đang xuất…' : 'Export DOCX'}</button>
        <button type="button" onClick={() => setEditing(null)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={18}/>Thêm câu hỏi</button>
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <div role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle2 size={17}/><span className="flex-1">{notice}</span><button type="button" aria-label="Ẩn thông báo" onClick={() => setNotice('')}><X size={16}/></button></div>}
    {showDocxImport && id && <ImportDocxPanel bankId={id} onClose={() => setShowDocxImport(false)} onImported={async count => {
      await loadData(id); setShowDocxImport(false); setNotice(`Đã xử lý ${count} câu từ DOCX. Ngân hàng đã được cập nhật.`);
    }}/>}
    <section aria-label="Lọc câu hỏi" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="min-w-0 text-xs font-semibold text-slate-600">Tìm câu hỏi
          <div className="relative mt-1"><Search size={17} className="absolute top-3 left-3 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm nội dung, số câu, đáp án…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-9 text-sm outline-none focus:border-blue-500"/>{search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearch('')} className="absolute top-3 right-3 text-slate-400"><X size={16}/></button>}</div>
        </label>
        <label className="min-w-0 text-xs font-semibold text-slate-600">Loại câu<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"><option value="">Tất cả loại</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-slate-600">Tag / mức độ<select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"><option value="">Tất cả tag</option>{tagFilter && !availableTags.includes(tagFilter) && <option value={tagFilter}>{tagFilter}</option>}{availableTags.map(tag => <option value={tag} key={tag}>{tag}</option>)}</select></label>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Hiển thị {filtered.length}/{questions.length} câu hỏi</span>{(search || tagFilter || typeFilter) && <button type="button" onClick={clearFilters} className="font-semibold text-blue-600">Xóa bộ lọc</button>}</div>
    </section>
    <div className="space-y-3">
      {filtered.map(q => <article key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => setEditing(q)} className="min-w-0 flex-1 text-left group">
            <span className="mb-1 block text-xs font-medium text-slate-400">{typeLabels[q.type]}</span>
            <h2 className="font-bold text-slate-900 group-hover:text-blue-600">{q.title}</h2>
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{q.content}</p>
          </button>
          <button type="button" onClick={() => setEditing(q)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><Edit2 size={15}/>Sửa</button>
          <button type="button" disabled={deleting === q.id} onClick={() => void remove(q)} aria-label={`Xóa ${q.title}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 size={17}/></button>
        </div>
        {q.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{q.tags.map(tag => <button type="button" onClick={() => setTagFilter(tag)} key={tag} title={`Lọc theo ${tag}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-blue-100 hover:text-blue-700">{tag}</button>)}</div>}
        <details className="mt-3 border-t border-slate-100 pt-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500">Xem đầy đủ câu hỏi và đáp án</summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{q.content}</p>
          {q.type !== 'ESSAY' ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{(q as MCQuestion | TFQuestion).choices.map((choice, index) => {
            const correct = q.type === 'MULTIPLE_CHOICE' ? (q as MCQuestion).answer === index : (q as TFQuestion).answers[index];
            return <div key={index} className={`rounded-lg border p-3 text-sm ${correct ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-100 bg-slate-50 text-slate-600'}`}><strong className="mr-2">{String.fromCharCode((q.type === 'TRUE_FALSE' ? 97 : 65) + index)}.</strong>{choice}{q.type === 'TRUE_FALSE' && <span className="ml-2 font-semibold">({correct ? 'Đúng' : 'Sai'})</span>}{q.type === 'MULTIPLE_CHOICE' && correct && <CheckCircle2 size={14} className="ml-2 inline"/>}</div>;
          })}</div> : (q as EssayQuestion).answer && <p className="mt-3 text-sm text-green-800">Đáp án tham khảo: {(q as EssayQuestion).answer}</p>}
        </details>
      </article>)}
      {filtered.length === 0 && <div className="rounded-2xl border border-dashed p-12 text-center"><p className="font-semibold text-slate-600">{questions.length ? 'Không có câu phù hợp với bộ lọc.' : 'Ngân hàng chưa có câu hỏi.'}</p><button type="button" onClick={questions.length ? clearFilters : () => setEditing(null)} className="mt-3 text-sm font-semibold text-blue-600">{questions.length ? 'Xóa bộ lọc' : 'Soạn câu hỏi đầu tiên'}</button></div>}
    </div>
    {editing !== undefined && <QuestionEditorDrawer key={editing?.id ?? 'new'} bankId={bank.id} question={editing} availableTags={availableTags}
      previous={currentIndex > 0 ? filtered[currentIndex - 1] : undefined} next={currentIndex >= 0 ? filtered[currentIndex + 1] : undefined}
      onNavigate={setEditing} onClose={() => setEditing(undefined)} onSaved={onSaved} />}
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Save, Trash2, X } from 'lucide-react';
import type { Question, QuestionType, MCQuestion, TFQuestion, EssayQuestion, NewQuestion } from '../../../core/entities/Question';
import { QuestionService } from '../../../core/services/QuestionService';

interface Props {
  bankId: string;
  question: Question | null;
  availableTags: string[];
  previous?: Question;
  next?: Question;
  onNavigate: (question: Question) => void;
  onClose: () => void;
  onSaved: (question: Question, next?: Question) => void;
}
const fieldClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function QuestionEditorDrawer({ bankId, question, availableTags, previous, next, onNavigate, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(question?.title ?? '');
  const [content, setContent] = useState(question?.content ?? '');
  const [type, setType] = useState<QuestionType>(question?.type ?? 'MULTIPLE_CHOICE');
  const [choices, setChoices] = useState<string[]>(question && question.type !== 'ESSAY' ? [...(question as MCQuestion | TFQuestion).choices] : ['', '', '', '']);
  const [answer, setAnswer] = useState(question?.type === 'MULTIPLE_CHOICE' ? (question as MCQuestion).answer : 0);
  const [answers, setAnswers] = useState<boolean[]>(question?.type === 'TRUE_FALSE' ? [...(question as TFQuestion).answers] : choices.map(() => false));
  const [essayAnswer, setEssayAnswer] = useState(question?.type === 'ESSAY' ? (question as EssayQuestion).answer ?? '' : '');
  const [tags, setTags] = useState<string[]>([...(question?.tags ?? [])]);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const snapshot = JSON.stringify({ title, content, type, choices, answer, answers, essayAnswer, tags });
  const initial = useRef(snapshot);
  const dirty = snapshot !== initial.current || Boolean(tagDraft.trim());
  const suggestions = [...new Set(['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao', ...availableTags])].filter(tag => !tags.includes(tag)).slice(0, 12);

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);

  const leave = (destination?: Question) => {
    if (saving) return;
    if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi để tiếp tục?')) return;
    if (destination) onNavigate(destination); else onClose();
  };
  const addTag = (value = tagDraft) => {
    const tag = value.trim();
    if (tag) setTags(current => current.includes(tag) ? current : [...current, tag]);
    if (value === tagDraft) setTagDraft('');
  };
  const removeChoice = (index: number) => {
    setChoices(current => current.filter((_, i) => i !== index));
    setAnswers(current => current.filter((_, i) => i !== index));
    setAnswer(current => index === current ? -1 : current > index ? current - 1 : current);
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (!title.trim() || !content.trim()) { setError('Điền tiêu đề và nội dung câu hỏi.'); return; }
    if (type !== 'ESSAY' && (choices.length < 2 || choices.some(choice => !choice.trim()))) { setError('Cần ít nhất hai lựa chọn và điền đầy đủ nội dung từng lựa chọn.'); return; }
    if (type === 'MULTIPLE_CHOICE' && (answer < 0 || answer >= choices.length)) { setError('Chọn một đáp án đúng.'); return; }
    const base = { bankId, title: title.trim(), content: content.trim(), tags: [...new Set([...tags, tagDraft.trim()].filter(Boolean))] };
    const data: NewQuestion = type === 'ESSAY' ? { ...base, type, answer: essayAnswer.trim() }
      : type === 'MULTIPLE_CHOICE' ? { ...base, type, choices: choices.map(c => c.trim()), answer }
        : { ...base, type, choices: choices.map(c => c.trim()), answers: choices.map((_, i) => Boolean(answers[i])) };
    const goNext = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'next';
    setSaving(true);
    try {
      let saved: Question;
      if (question) {
        await QuestionService.updateQuestion(question.id, data);
        saved = { ...question, ...data } as Question;
      } else saved = await QuestionService.createQuestion(data);
      onSaved(saved, goNext ? next : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu câu hỏi. Nội dung đang sửa vẫn được giữ ở đây.');
    } finally { setSaving(false); }
  };

  return <dialog ref={dialog} aria-labelledby="question-editor-heading" onCancel={event => { event.preventDefault(); leave(); }}
    className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-3xl border-0 bg-slate-50 p-0 shadow-2xl backdrop:bg-slate-900/35">
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b bg-white px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{question ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi'}</p>
          <h2 id="question-editor-heading" className="truncate text-lg font-bold text-slate-900">{question?.title || 'Soạn câu hỏi mới'}</h2>
          <p className="text-xs text-slate-500">{saving ? 'Đang lưu…' : dirty ? 'Có thay đổi chưa lưu' : 'Nội dung đang lưu trong Bank'}</p>
        </div>
        {question && <div className="flex gap-1">
          <button type="button" disabled={!previous || saving} onClick={() => leave(previous)} aria-label="Câu trước" title="Câu trước trong danh sách đang lọc" className="rounded-lg border p-2 disabled:opacity-30"><ArrowLeft size={18}/></button>
          <button type="button" disabled={!next || saving} onClick={() => leave(next)} aria-label="Câu tiếp" title="Câu tiếp trong danh sách đang lọc" className="rounded-lg border p-2 disabled:opacity-30"><ArrowRight size={18}/></button>
        </div>}
        <button type="button" onClick={() => leave()} disabled={saving} aria-label="Đóng chỉnh sửa" className="rounded-lg p-2 hover:bg-slate-100"><X size={22}/></button>
      </header>
      <form id="question-editor-form" onSubmit={save} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
        <fieldset disabled={saving} className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <label className="space-y-1.5 text-sm font-semibold">Tiêu đề<input autoFocus className={fieldClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="Câu 1" required /></label>
            <label className="space-y-1.5 text-sm font-semibold">Loại câu<select className={fieldClass} value={type} onChange={e => setType(e.target.value as QuestionType)}><option value="MULTIPLE_CHOICE">Trắc nghiệm</option><option value="TRUE_FALSE">Đúng / Sai</option><option value="ESSAY">Tự luận</option></select></label>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold">Nội dung<textarea className={`${fieldClass} min-h-40 resize-y leading-relaxed`} value={content} onChange={e => setContent(e.target.value)} required placeholder="Nội dung câu hỏi hoặc đoạn tư liệu…" /></label>
          {type !== 'ESSAY' && <section className="space-y-3">
            <div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold">{type === 'MULTIPLE_CHOICE' ? 'Lựa chọn và đáp án' : 'Các mệnh đề'}</h3><p className="text-xs text-slate-500">{type === 'MULTIPLE_CHOICE' ? 'Chọn ô tròn ở đáp án đúng.' : 'Chọn Đúng hoặc Sai cho từng mệnh đề.'}</p></div>
              <button type="button" onClick={() => { setChoices(c => [...c, '']); setAnswers(a => [...a, false]); }} className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><Plus size={15}/>Thêm</button>
            </div>
            {choices.map((choice, index) => <div key={index} className={`rounded-xl border bg-white p-3 ${type === 'MULTIPLE_CHOICE' && answer === index ? 'border-green-400 ring-1 ring-green-100' : 'border-slate-200'}`}>
              <div className="mb-2 flex items-center gap-2">
                {type === 'MULTIPLE_CHOICE' && <input type="radio" name="correct-answer" checked={answer === index} onChange={() => setAnswer(index)} aria-label={`Đáp án ${String.fromCharCode(65 + index)} đúng`} className="h-4 w-4 accent-green-600"/>}
                <span className="text-sm font-bold">{String.fromCharCode((type === 'TRUE_FALSE' ? 97 : 65) + index)}.</span>
                {type === 'MULTIPLE_CHOICE' && answer === index && <span className="text-xs font-semibold text-green-700">Đáp án đúng</span>}
                {type === 'TRUE_FALSE' && <div className="flex gap-1">{[true, false].map(value => <button key={String(value)} type="button" aria-pressed={Boolean(answers[index]) === value} onClick={() => setAnswers(current => current.map((a, i) => i === index ? value : a))} className={`rounded-md px-3 py-1 text-xs font-semibold ${Boolean(answers[index]) === value ? value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>{value ? 'Đúng' : 'Sai'}</button>)}</div>}
                <button type="button" disabled={choices.length <= 2} onClick={() => removeChoice(index)} aria-label={`Xóa lựa chọn ${index + 1}`} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 size={16}/></button>
              </div>
              <textarea aria-label={`Nội dung lựa chọn ${index + 1}`} rows={2} className={`${fieldClass} resize-y border-slate-100`} value={choice} onChange={e => setChoices(current => current.map((c, i) => i === index ? e.target.value : c))} required />
            </div>)}
          </section>}
          {type === 'ESSAY' && <label className="block space-y-1.5 text-sm font-semibold">Đáp án tham khảo<textarea className={`${fieldClass} min-h-32`} value={essayAnswer} onChange={e => setEssayAnswer(e.target.value)} /></label>}
          <section className="space-y-3"><div><h3 className="font-semibold">Tags / mức độ</h3><p className="text-xs text-slate-500">Tags được ghi dưới câu hỏi khi xuất DOCX.</p></div>
            <div className="flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1.5 text-sm text-blue-800">{tag}<button type="button" aria-label={`Xóa tag ${tag}`} onClick={() => setTags(current => current.filter(t => t !== tag))} className="rounded p-0.5 hover:bg-blue-200"><X size={14}/></button></span>)}{!tags.length && <span className="text-sm text-slate-400">Chưa có tag</span>}</div>
            <div className="flex gap-2"><input aria-label="Tag mới" className={fieldClass} value={tagDraft} onChange={e => setTagDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Nhập tag rồi Enter…"/><button type="button" onClick={() => addTag()} disabled={!tagDraft.trim()} className="shrink-0 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-40">Thêm tag</button></div>
            <div className="flex flex-wrap gap-1.5">{suggestions.map(tag => <button key={tag} type="button" onClick={() => addTag(tag)} className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-700">+ {tag}</button>)}</div>
          </section>
        </fieldset>
      </form>
      <footer className="shrink-0 border-t bg-white px-5 py-4">
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" disabled={saving} onClick={() => leave()} className="mr-auto rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Đóng</button>
          {next && <button type="submit" form="question-editor-form" value="next" disabled={saving} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-40">Lưu & câu tiếp</button>}
          <button type="submit" form="question-editor-form" value="close" disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><Save size={16}/>{saving ? 'Đang lưu…' : 'Lưu & đóng'}</button>
        </div>
      </footer>
    </div>
  </dialog>;
}

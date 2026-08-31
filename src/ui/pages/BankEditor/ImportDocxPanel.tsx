import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from 'lucide-react';
import {
  DOCX_MAX_FILE_SIZE,
  DocxQuestionImportService,
  type DocxImportStage,
} from '../../../application/import/DocxQuestionImportService';
import type { QuestionParseResult } from '../../../core/import/parsers/QuestionDocumentParser';

interface ImportDocxPanelProps {
  onClose: () => void;
}

const stages: Array<{ id: DocxImportStage; label: string }> = [
  { id: 'reading', label: 'Đọc file' },
  { id: 'detecting', label: 'Nhận diện format' },
  { id: 'parsing', label: 'Parse câu hỏi' },
  { id: 'validating', label: 'Kiểm tra dữ liệu' },
];

export default function ImportDocxPanel({ onClose }: ImportDocxPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<DocxImportStage | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuestionParseResult | null>(null);

  const processFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    setResult(null);
    try {
      const parsed = await DocxQuestionImportService.preview(file, setStage);
      setResult(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xử lý file DOCX.');
    } finally {
      setStage(null);
    }
  };

  const blockingErrors = result?.warnings.filter((item) => item.severity === 'error').length ?? 0;

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border-2 border-blue-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-black text-gray-900">Import câu hỏi từ DOCX</h2>
          <p className="mt-1 text-sm text-gray-500">Dữ liệu mới chỉ được đọc và kiểm tra, chưa ghi vào ngân hàng.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100" aria-label="Đóng">
          <X size={22} />
        </button>
      </div>

      <div className="space-y-5 p-6">
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(event) => void processFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void processFile(event.dataTransfer.files[0]);
          }}
          className={`flex w-full flex-col items-center rounded-2xl border-2 border-dashed p-8 transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`}
        >
          <Upload className="mb-3 text-blue-600" size={30} />
          <span className="font-bold text-gray-800">Chọn hoặc kéo-thả file .docx</span>
          <span className="mt-1 text-xs text-gray-500">Tối đa {DOCX_MAX_FILE_SIZE / 1024 / 1024} MB</span>
        </button>

        {stage && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {stages.map((item) => {
              const currentIndex = stages.findIndex((candidate) => candidate.id === stage);
              const itemIndex = stages.findIndex((candidate) => candidate.id === item.id);
              return (
                <div key={item.id} className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${itemIndex <= currentIndex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {item.label}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <AlertTriangle className="shrink-0" size={20} /> {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-4 text-sm">
              <FileText size={20} className="text-blue-600" />
              <span className="font-bold text-gray-800">{fileName}</span>
              <span className="text-gray-500">{result.questions.length} câu hỏi</span>
              <span className={blockingErrors ? 'font-bold text-red-600' : 'font-bold text-green-600'}>
                {blockingErrors ? `${blockingErrors} lỗi bắt buộc` : 'Không có lỗi bắt buộc'}
              </span>
              <span className="ml-auto text-xs text-gray-400">{result.parserId} · {Math.round(result.confidence * 100)}%</span>
            </div>

            <div className="max-h-96 space-y-3 overflow-auto pr-1">
              {result.questions.map((question) => (
                <div key={`${question.key}-${question.source.blockStart}`} className={`rounded-xl border p-4 ${question.issues.length ? 'border-amber-200 bg-amber-50' : 'border-green-100 bg-green-50/40'}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
                    {question.issues.length ? <AlertTriangle size={15} className="text-amber-600" /> : <CheckCircle2 size={15} className="text-green-600" />}
                    <span>{question.topic}</span><span>›</span><span>{question.lesson}</span><span>›</span><span>{question.section}</span>
                  </div>
                  <p className="font-bold text-gray-900">Câu {question.number}. {question.content}</p>
                  {question.issues.map((item) => <p key={item.code} className="mt-2 text-xs font-semibold text-amber-700">{item.message}</p>)}
                </div>
              ))}
            </div>

            <button type="button" disabled className="w-full cursor-not-allowed rounded-2xl bg-gray-200 py-3 font-bold text-gray-500">
              Tiếp tục review và xác nhận (đang phát triển)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

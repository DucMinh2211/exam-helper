import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Upload, X } from 'lucide-react';
import {
  DOCX_MAX_FILE_SIZE,
  DocxQuestionImportService,
  type DocxImportStage,
} from '../../../application/import/DocxQuestionImportService';
import type { QuestionParseResult } from '../../../core/import/parsers/QuestionDocumentParser';
import DocxReviewWorkspace from './DocxReviewWorkspace';
import { BankRepository } from '../../../data/repositories/BankRepository';
import { sourceKey, type DocxImportOptions } from '../../../application/import/DocxImportPlan';

interface ImportDocxPanelProps {
  bankId: string;
  onClose: () => void;
  onImported: (count: number) => void | Promise<void>;
}

const stages: Array<{ id: DocxImportStage; label: string }> = [
  { id: 'reading', label: 'Đọc file' },
  { id: 'detecting', label: 'Nhận diện format' },
  { id: 'parsing', label: 'Parse câu hỏi' },
  { id: 'validating', label: 'Kiểm tra dữ liệu' },
];

export default function ImportDocxPanel({ bankId, onClose, onImported }: ImportDocxPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<DocxImportStage | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuestionParseResult | null>(null);
  const [mode, setMode] = useState<DocxImportOptions['mode']>('append');
  const [targetSourceId, setTargetSourceId] = useState('');
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const options = useMemo(() => ({ mode, targetSourceId: targetSourceId || undefined }), [mode, targetSourceId]);

  const processFile = async (file?: File) => {
    if (!file) return;
    const request = ++requestId.current;
    setFileName(file.name);
    setError('');
    setResult(null);
    try {
      const parsed = await DocxQuestionImportService.preview(file, stage => { if (request === requestId.current) setStage(stage); });
      const bank = await BankRepository.getById(bankId);
      if (request !== requestId.current) return;
      const knownSources = (bank?.docxSources ?? []).map((source, index) => ({ id: sourceKey(bank!, index), name: source.name }));
      setSources(knownSources);
      const identity = parsed.sourceDocx?.bankId === bankId;
      const names = knownSources.filter(source => source.name === file.name);
      const match = identity ? knownSources.find(source => source.id === parsed.sourceDocx?.sourceId) : names.length === 1 ? names[0] : undefined;
      setMode(identity || match ? 'update' : 'append');
      setTargetSourceId(match?.id ?? '');
      setResult(parsed);
    } catch (cause) {
      if (request === requestId.current) setError(cause instanceof Error ? cause.message : 'Không thể xử lý file DOCX.');
    } finally {
      if (request === requestId.current) setStage(null);
    }
  };

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border-2 border-blue-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-black text-gray-900">Import câu hỏi từ DOCX</h2>
          <p className="mt-1 text-sm text-gray-500">Dữ liệu mới chỉ được đọc và kiểm tra, chưa ghi vào ngân hàng.</p>
          <p className="mt-1 text-sm text-gray-500">Nhận đáp án từ chữ đỏ hoặc gạch chân, kể cả chỉ một phần lựa chọn. File gốc được lưu để Export DOCX sau khi sửa.</p>
        </div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100" aria-label="Đóng">
          <X size={22} />
        </button>
      </div>

      <div className="space-y-5 p-6">
        <input
          ref={inputRef}
          type="file"
          disabled={busy}
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(event) => void processFile(event.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) void processFile(event.dataTransfer.files[0]);
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

        {result && <>
          <fieldset disabled={busy} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <legend className="px-1 font-bold">Cách nhập file</legend>
            <label className="flex items-start gap-2 text-sm"><input type="radio" name="docx-mode" checked={mode === 'update'} onChange={() => setMode('update')} className="mt-1" />
              <span><strong>Cập nhật thay đổi</strong><br />Câu đã có giữ nguyên ID; câu mới được thêm. Câu vắng trong file vẫn giữ trong Bank.</span>
            </label>
            <label className="flex items-start gap-2 text-sm"><input type="radio" name="docx-mode" checked={mode === 'append'} onChange={() => setMode('append')} className="mt-1" />
              <span><strong>Thêm thành câu mới</strong><br />Tạo bản mới cho mọi câu đã xác nhận, kể cả câu đang có trong Bank.</span>
            </label>
            {mode === 'update' && <label className="block text-sm font-semibold">File nguồn cần cập nhật
              <select value={targetSourceId} onChange={e => setTargetSourceId(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2">
                <option value="">{result.sourceDocx?.bankId === bankId ? 'Theo định danh trong DOCX đã xuất' : 'Chọn file đã import trước đây…'}</option>
                {sources.map(source => <option value={source.id} key={source.id}>{source.name}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-gray-600">File cũ không có định danh sẽ được đối chiếu theo bài, loại câu và số câu trong nguồn đã chọn.</span>
            </label>}
          </fieldset>
          <DocxReviewWorkspace key={`${fileName}-${result.questions.length}`} bankId={bankId} fileName={fileName} result={result} options={options} onBusyChange={setBusy} onImported={onImported} />
        </>}
      </div>
    </div>
  );
}

import React, { useRef, useState } from 'react';
import { Database, Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DataService } from '../../../core/services/DataService';

const SettingsPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleBackup = async () => {
    try {
      await DataService.backupData();
      setMessage({ type: 'success', text: 'Sao lưu dữ liệu thành công! File đã được tải xuống.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi sao lưu.' });
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('CẢNH BÁO: Việc khôi phục sẽ ghi đè lên dữ liệu hiện tại (nếu trùng ID). Bạn nên sao lưu dữ liệu hiện tại trước. Bạn có chắc muốn tiếp tục?')) {
      e.target.value = ''; // Reset input
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await DataService.restoreData(file);
      setMessage({ type: 'success', text: 'Khôi phục dữ liệu thành công! Vui lòng tải lại trang để thấy thay đổi.' });
      // Optional: window.location.reload();
    } catch (error: any) {
      setMessage({ type: 'error', text: `Lỗi khôi phục: ${error.message}` });
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Database className="text-blue-600" />
        Quản lý Dữ liệu & Cài đặt
      </h1>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
            <Download size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Sao lưu dữ liệu (Backup)</h2>
          <p className="text-gray-500 text-sm mb-6">
            Tải xuống toàn bộ dữ liệu (Ngân hàng, Câu hỏi, Đề thi, Mẫu đề) dưới dạng file .json. Bạn có thể dùng file này để khôi phục dữ liệu trên máy khác.
          </p>
          <button 
            onClick={handleBackup}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Tải xuống bản sao lưu
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600">
            <Upload size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Khôi phục dữ liệu (Restore)</h2>
          <p className="text-gray-500 text-sm mb-6">
            Khôi phục dữ liệu từ file backup (.json). Dữ liệu mới sẽ được gộp vào dữ liệu hiện có.
          </p>
          
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          
          <button 
            onClick={handleRestoreClick}
            disabled={loading}
            className="w-full py-3 bg-white border-2 border-orange-500 text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Chọn file backup để khôi phục'}
          </button>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
          <AlertTriangle size={16} /> Lưu ý
        </h3>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>Dữ liệu được lưu trữ hoàn toàn trên trình duyệt của bạn (IndexedDB).</li>
          <li>Nếu bạn xóa cache trình duyệt hoặc cài lại máy, dữ liệu sẽ mất nếu không sao lưu.</li>
          <li>Hãy thường xuyên sao lưu dữ liệu để tránh rủi ro.</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPage;

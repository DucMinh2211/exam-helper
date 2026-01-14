import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Upload, MoreVertical, FileJson, FileSpreadsheet, Download } from 'lucide-react';
import { BankService } from '../../../core/services/BankService';
import { BankExportImportService } from '../../../core/services/BankExportImportService';
import type { Bank } from '../../../core/entities/Bank';

const Dashboard: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [newBankName, setNewBankName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Menu dropdown state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadBanks();
    
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadBanks = async () => {
    const list = await BankService.listAllBanks();
    setBanks(list);
  };

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return;
    
    await BankService.createNewBank(newBankName);
    setNewBankName('');
    setShowModal(false);
    loadBanks();
  };

  const handleDeleteBank = async (id: string) => {
    if (window.confirm('Bạn có chắc muốn xóa ngân hàng này và toàn bộ câu hỏi bên trong?')) {
      await BankService.removeBank(id);
      loadBanks();
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.json')) {
        await BankExportImportService.importFromJSON(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        await BankExportImportService.importFromExcel(file);
      } else {
        alert('Định dạng file không hỗ trợ! Chỉ chấp nhận .json hoặc .xlsx');
        return;
      }
      alert('Nhập ngân hàng thành công!');
      loadBanks();
    } catch (error: any) {
      alert(`Lỗi nhập file: ${error.message}`);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Ngân hàng câu hỏi</h1>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".json,.xlsx,.xls" 
            onChange={handleFileChange}
          />
          <button 
            onClick={handleImportClick}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload size={20} />
            <span>Nhập tệp</span>
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Tạo mới</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {banks.map(bank => (
          <div key={bank.id} className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow group relative">
            <Link to={`/bank/${bank.id}`} className="block">
              <h3 className="font-bold text-lg text-gray-800 mb-1 truncate pr-8">{bank.name}</h3>
              <p className="text-sm text-gray-500">
                {bank.description || `Ngày tạo: ${new Date(bank.createdAt).toLocaleDateString('vi-VN')}`}
              </p>
            </Link>
            
            {/* Menu Button */}
            <div className="absolute top-4 right-4" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setOpenMenuId(openMenuId === bank.id ? null : bank.id)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical size={20} />
              </button>
              
              {openMenuId === bank.id && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                  <button 
                    onClick={() => { BankExportImportService.exportToExcel(bank.id); setOpenMenuId(null); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm hover:bg-green-50 hover:text-green-700 text-gray-700"
                  >
                    <FileSpreadsheet size={16} className="text-green-600" /> Xuất Excel (.xlsx)
                  </button>
                  <button 
                    onClick={() => { BankExportImportService.exportToJSON(bank.id); setOpenMenuId(null); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm hover:bg-yellow-50 hover:text-yellow-700 text-gray-700"
                  >
                    <FileJson size={16} className="text-yellow-600" /> Xuất JSON
                  </button>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <button 
                    onClick={() => { handleDeleteBank(bank.id); setOpenMenuId(null); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 hover:text-red-700 text-red-600 font-medium"
                  >
                    <Trash2 size={16} /> Xóa ngân hàng
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {banks.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <p className="text-gray-500 font-medium mb-2">Chưa có ngân hàng nào.</p>
            <button onClick={() => setShowModal(true)} className="text-blue-600 font-bold hover:underline">
              Tạo ngân hàng đầu tiên
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl transform transition-all scale-100">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Tạo ngân hàng mới</h2>
            <form onSubmit={handleCreateBank}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Tên ngân hàng</label>
                <input 
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ví dụ: Toán Lớp 10 - Chương 1"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md"
                >
                  Tạo ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
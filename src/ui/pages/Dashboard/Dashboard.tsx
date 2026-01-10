import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { BankService } from '../../../core/services/BankService';
import type { Bank } from '../../../core/entities/Bank';

const Dashboard: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [newBankName, setNewBankName] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadBanks();
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Ngân hàng câu hỏi</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>Tạo ngân hàng mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {banks.map(bank => (
          <div key={bank.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow group relative">
            <Link to={`/bank/${bank.id}`} className="block">
              <h3 className="font-semibold text-lg text-gray-800 mb-1">{bank.name}</h3>
              <p className="text-sm text-gray-500">
                Ngày tạo: {new Date(bank.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </Link>
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.preventDefault(); handleDeleteBank(bank.id); }}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {banks.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 border-2 border-dashed rounded-xl">
            Chưa có ngân hàng nào. Hãy tạo một cái mới!
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Tạo ngân hàng mới</h2>
            <form onSubmit={handleCreateBank}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên ngân hàng</label>
                <input 
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ví dụ: Toán Lớp 10 - Chương 1"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

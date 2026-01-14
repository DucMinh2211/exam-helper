import React, { useState, useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import { BankService } from '../../../core/services/BankService';
import type { Bank } from '../../../core/entities/Bank';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, bankIds: string[]) => void;
}

const CreateExamModal: React.FC<Props> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadBanks();
      setName('');
      setSelectedBankIds([]);
    }
  }, [isOpen]);

  const loadBanks = async () => {
    const list = await BankService.listAllBanks();
    setBanks(list);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedBankIds.length === 0) return;
    onCreate(name, selectedBankIds);
  };

  const toggleBank = (id: string) => {
    setSelectedBankIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl transform transition-all scale-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Tạo đề thi thủ công</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Tên đề thi</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ví dụ: Đề Ôn tập chương 1"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Layers size={16} /> Chọn ngân hàng nguồn
            </label>
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-xl p-2 bg-gray-50">
              {banks.map(bank => (
                <div 
                  key={bank.id}
                  onClick={() => toggleBank(bank.id)}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${
                    selectedBankIds.includes(bank.id) 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-white border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedBankIds.includes(bank.id)}
                    onChange={() => {}} // handled by div click
                    className="w-5 h-5 mr-3 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-800">{bank.name}</div>
                    <div className="text-xs text-gray-500">{new Date(bank.createdAt).toLocaleDateString('vi-VN')}</div>
                  </div>
                </div>
              ))}
              {banks.length === 0 && <div className="text-center text-gray-500 py-4">Chưa có ngân hàng nào.</div>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={!name.trim() || selectedBankIds.length === 0}
              className="flex-1 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              Tạo ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExamModal;

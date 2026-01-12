import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Tag as TagIcon, Layers, Info } from 'lucide-react';
import { BankService } from '../../../core/services/BankService';
import { ExamSeedService } from '../../../core/services/ExamSeedService';
import { QuestionService } from '../../../core/services/QuestionService';
import type { Bank } from '../../../core/entities/Bank';
import type { ExamSeed, QuestionBlock } from '../../../core/entities/ExamSeed';
import { v4 as uuidv4 } from 'uuid';

const ExamSeedEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Data sources
  const [availableBanks, setAvailableBanks] = useState<Bank[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<QuestionBlock[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  // Load tags whenever selected banks change to help user pick tags
  useEffect(() => {
    updateAvailableTags();
  }, [selectedBankIds]);

  const loadData = async () => {
    setLoading(true);
    const banks = await BankService.listAllBanks();
    setAvailableBanks(banks);

    if (id && id !== 'new') {
      const seed = await ExamSeedService.getSeedById(id);
      if (seed) {
        setName(seed.name);
        setDescription(seed.description || '');
        setSelectedBankIds(seed.bankIds);
        setBlocks(seed.questionBlocks);
      }
    } else {
      // Default new seed
      setBlocks([{ id: uuidv4(), numberOfQuestions: 5, tags: [] }]);
    }
    setLoading(false);
  };

  const updateAvailableTags = async () => {
    if (selectedBankIds.length === 0) {
      setAllTags([]);
      return;
    }
    
    const tagsSet = new Set<string>();
    for (const bId of selectedBankIds) {
      const questions = await QuestionService.getQuestionsByBank(bId);
      questions.forEach(q => q.tags.forEach(t => tagsSet.add(t)));
    }
    setAllTags(Array.from(tagsSet));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Vui lòng nhập tên mẫu đề thi');
      return;
    }
    if (selectedBankIds.length === 0) {
      alert('Vui lòng chọn ít nhất một ngân hàng câu hỏi');
      return;
    }

    const seedData = {
      name,
      description,
      bankIds: selectedBankIds,
      questionBlocks: blocks,
    };

    try {
      if (id && id !== 'new') {
        await ExamSeedService.updateSeed(id, seedData);
      } else {
        await ExamSeedService.createSeed(seedData);
      }
      navigate('/seeds');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleBank = (bankId: string) => {
    setSelectedBankIds(prev => 
      prev.includes(bankId) ? prev.filter(i => i !== bankId) : [...prev, bankId]
    );
  };

  const addBlock = () => {
    setBlocks([...blocks, { id: uuidv4(), numberOfQuestions: 5, tags: [] }]);
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
  };

  const updateBlock = (blockId: string, updates: Partial<QuestionBlock>) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, ...updates } : b));
  };

  const toggleTagInBlock = (blockId: string, tag: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const newTags = block.tags.includes(tag) 
      ? block.tags.filter(t => t !== tag) 
      : [...block.tags, tag];
    
    updateBlock(blockId, { tags: newTags });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/seeds" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            {id === 'new' ? 'Tạo mẫu đề thi mới' : 'Chỉnh sửa mẫu đề thi'}
          </h1>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-md font-bold"
        >
          <Save size={20} />
          Lưu mẫu đề
        </button>
      </div>

      <div className="space-y-6">
        {/* Section: Thông tin chung */}
        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-700">
            <Info size={18} className="text-blue-500" />
            Thông tin chung
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Tên mẫu đề thi</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ví dụ: Đề kiểm tra Giữa kỳ 1 - Toán 10"
                className="w-full border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 font-semibold"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Mô tả (Không bắt buộc)</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Mô tả mục đích hoặc cấu trúc của đề..."
                className="w-full border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 min-h-[80px]"
              />
            </div>
          </div>
        </section>

        {/* Section: Chọn ngân hàng nguồn */}
        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-700">
            <Layers size={18} className="text-orange-500" />
            Ngân hàng câu hỏi nguồn
          </h2>
          <p className="text-sm text-gray-500 mb-4">Chọn các ngân hàng chứa câu hỏi bạn muốn sử dụng cho mẫu đề này.</p>
          <div className="flex flex-wrap gap-2">
            {availableBanks.map(bank => (
              <button
                key={bank.id}
                onClick={() => toggleBank(bank.id)}
                className={`px-4 py-2 rounded-xl border-2 transition-all font-medium ${
                  selectedBankIds.includes(bank.id)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                }`}
              >
                {bank.name}
              </button>
            ))}
            {availableBanks.length === 0 && (
              <div className="text-orange-500 text-sm font-medium italic">
                Bạn chưa có ngân hàng câu hỏi nào. Hãy tạo ngân hàng trước.
              </div>
            )}
          </div>
        </section>

        {/* Section: Cấu trúc khối câu hỏi */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-lg font-bold text-gray-700">Cấu trúc các khối câu hỏi</h2>
            <button 
              onClick={addBlock}
              className="flex items-center gap-2 text-blue-600 font-bold hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors"
            >
              <Plus size={18} /> Thêm khối
            </button>
          </div>

          {blocks.map((block, index) => (
            <div key={block.id} className="bg-white border-2 border-gray-100 rounded-2xl p-6 relative hover:border-blue-200 transition-all">
              <button 
                onClick={() => removeBlock(block.id)}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 p-1"
                title="Xóa khối"
              >
                <Trash2 size={18} />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Số lượng câu</label>
                  <input 
                    type="number" 
                    min="1"
                    value={block.numberOfQuestions}
                    onChange={e => updateBlock(block.id, { numberOfQuestions: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                  />
                  <p className="text-[10px] text-gray-400 mt-2 italic font-medium">Khối #{index + 1}</p>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Lọc theo Nhãn (Tags)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {block.tags.map(tag => (
                      <span key={tag} className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 uppercase tracking-wider">
                        {tag}
                        <button onClick={() => toggleTagInBlock(block.id, tag)}><X size={12}/></button>
                      </span>
                    ))}
                    {block.tags.length === 0 && <span className="text-xs text-gray-400 italic">Lấy ngẫu nhiên không theo nhãn</span>}
                  </div>
                  
                  <div className="border-t pt-3">
                    <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Gợi ý nhãn từ ngân hàng đã chọn:</p>
                    <div className="flex flex-wrap gap-1">
                      {allTags.filter(t => !block.tags.includes(t)).map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTagInBlock(block.id, tag)}
                          className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-md hover:bg-gray-200 transition-colors uppercase"
                        >
                          + {tag}
                        </button>
                      ))}
                      {allTags.length === 0 && <span className="text-[10px] text-gray-400 italic">Hãy chọn ngân hàng để thấy nhãn câu hỏi</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {blocks.length === 0 && (
            <div className="text-center py-10 bg-gray-50 border-2 border-dashed rounded-2xl text-gray-400 italic">
              Nhấn "Thêm khối" để bắt đầu thiết kế cấu trúc đề.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// Simple X icon for tags
const X: React.FC<{size?: number}> = ({size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default ExamSeedEditor;

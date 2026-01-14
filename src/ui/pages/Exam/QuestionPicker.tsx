import React, { useState, useEffect } from 'react';
import { X, Search, Plus } from 'lucide-react';
import type { Question } from '../../../core/entities/Question';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  availableQuestions: Question[];
  currentQuestionIds: string[];
  onAdd: (selectedIds: string[]) => void;
}

const QuestionPicker: React.FC<Props> = ({ isOpen, onClose, availableQuestions, currentQuestionIds, onAdd }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  
  // Get all unique tags
  const allTags = Array.from(new Set(availableQuestions.flatMap(q => q.tags)));

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchTerm('');
      setSelectedTag('');
    }
  }, [isOpen]);

  const filteredQuestions = availableQuestions.filter(q => {
    const isNotAdded = !currentQuestionIds.includes(q.id);
    const matchesSearch = q.content.toLowerCase().includes(searchTerm.toLowerCase()) || q.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag ? q.tags.includes(selectedTag) : true;
    return isNotAdded && matchesSearch && matchesTag;
  });

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleAdd = () => {
    onAdd(Array.from(selectedIds));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Thêm câu hỏi vào đề</h2>
            <p className="text-xs text-gray-500">{filteredQuestions.length} câu hỏi khả dụng</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm nội dung câu hỏi..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
             <button 
                onClick={() => setSelectedTag('')}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${!selectedTag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                Tất cả
              </button>
            {allTags.map(tag => (
              <button 
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? '' : tag)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${tag === selectedTag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {filteredQuestions.map(q => (
            <div 
              key={q.id}
              onClick={() => toggleSelection(q.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedIds.has(q.id) 
                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                  : 'border-white bg-white hover:border-gray-200 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                   <div className="flex gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">
                        {q.type.replace('_', ' ')}
                      </span>
                      {q.tags.map(t => (
                        <span key={t} className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                          {t}
                        </span>
                      ))}
                   </div>
                   <h4 className="font-bold text-gray-800 text-sm mb-1">{q.title}</h4>
                   <p className="text-sm text-gray-600 line-clamp-2">{q.content}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.has(q.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                  {selectedIds.has(q.id) && <Plus size={14} className="text-white" />}
                </div>
              </div>
            </div>
          ))}
          {filteredQuestions.length === 0 && (
             <div className="text-center py-10 text-gray-400 italic">Không tìm thấy câu hỏi phù hợp.</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-between items-center">
          <span className="font-bold text-gray-600">{selectedIds.size} câu được chọn</span>
          <button 
            disabled={selectedIds.size === 0}
            onClick={handleAdd}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-200"
          >
            Thêm vào đề thi
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionPicker;

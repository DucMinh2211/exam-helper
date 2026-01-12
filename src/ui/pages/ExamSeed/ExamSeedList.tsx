import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, FileCog, Play, Edit } from 'lucide-react';
import { ExamSeedService } from '../../../core/services/ExamSeedService';
import { ExamService } from '../../../core/services/ExamService';
import type { ExamSeed } from '../../../core/entities/ExamSeed';

const ExamSeedList: React.FC = () => {
  const [seeds, setSeeds] = useState<ExamSeed[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadSeeds();
  }, []);

  const loadSeeds = async () => {
    const list = await ExamSeedService.listAllSeeds();
    setSeeds(list);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc muốn xóa mẫu đề này?')) {
      await ExamSeedService.deleteSeed(id);
      loadSeeds();
    }
  };

  const handleGenerateExam = async (seed: ExamSeed) => {
    const examName = prompt('Nhập tên cho đề thi mới:', `${seed.name} - ${new Date().toLocaleDateString('vi-VN')}`);
    if (!examName) return;

    try {
      const newExam = await ExamService.generateExamFromSeed(seed.id, examName);
      alert(`Đã sinh đề thi "${newExam.name}" thành công với ${newExam.questionIds.length} câu hỏi!`);
      navigate(`/exams/${newExam.id}`);
    } catch (error: any) {
      alert('Lỗi sinh đề: ' + error.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileCog className="text-blue-600" />
          Mẫu Đề Thi (Templates)
        </h1>
        <Link 
          to="/seeds/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold"
        >
          <Plus size={20} />
          <span>Tạo mẫu mới</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {seeds.map(seed => (
          <div key={seed.id} className="bg-white border-2 border-transparent hover:border-blue-100 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all group relative flex flex-col">
            <h3 className="font-bold text-xl text-gray-800 mb-2 truncate">{seed.name}</h3>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">
              {seed.description || 'Không có mô tả'}
            </p>
            
            <div className="flex gap-2 mb-6">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                {seed.bankIds.length} Ngân hàng
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 px-2 py-1 rounded-md">
                {seed.questionBlocks.length} Khối
              </span>
            </div>
            
            <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
               <button 
                onClick={() => handleGenerateExam(seed)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
              >
                <Play size={18} fill="currentColor" />
                Sinh Đề
              </button>
              <Link 
                to={`/seeds/${seed.id}`}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                title="Chỉnh sửa"
              >
                <Edit size={20} />
              </Link>
              <button 
                onClick={() => handleDelete(seed.id)}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="Xóa mẫu"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}

        {seeds.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <FileCog className="text-gray-300" size={32} />
            </div>
            <p className="text-gray-500 font-medium">Chưa có mẫu đề thi nào.</p>
            <p className="text-sm text-gray-400 mt-1">Hãy tạo mẫu để sinh đề thi tự động nhanh chóng.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamSeedList;
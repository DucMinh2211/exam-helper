import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, FileText, Play } from 'lucide-react';
import { ExamService } from '../../../core/services/ExamService';
import type { Exam } from '../../../core/entities/Exam';
import CreateExamModal from './CreateExamModal';

const ExamList: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    const list = await ExamService.listAllExams();
    setExams(list);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Xóa đề thi này?')) {
      await ExamService.deleteExam(id);
      loadExams();
    }
  };

  const handleCreateManual = async (name: string, bankIds: string[]) => {
    try {
      const newExam = await ExamService.createManualExam(name, bankIds);
      setIsModalOpen(false);
      navigate(`/exams/${newExam.id}`);
    } catch (error) {
      alert('Có lỗi xảy ra khi tạo đề thi.');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-blue-600" />
          Danh sách Đề Thi
        </h1>
        <div className="flex gap-3">
          <Link 
            to="/seeds"
            className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            <Play size={18} />
            <span>Sinh đề từ mẫu</span>
          </Link>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold"
          >
            <Plus size={20} />
            <span>Tạo thủ công</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow flex items-center justify-between group">
            <Link to={`/exams/${exam.id}`} className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-lg text-gray-800">{exam.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {exam.questionIds.length} câu hỏi
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Ngày tạo: {new Date(exam.createdAt).toLocaleDateString('vi-VN')} {new Date(exam.createdAt).toLocaleTimeString('vi-VN')}
              </p>
            </Link>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleDelete(exam.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Xóa đề thi"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}

        {exams.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <FileText className="text-gray-300" size={32} />
            </div>
            <p className="text-gray-500 font-medium">Chưa có đề thi nào.</p>
            <div className="mt-4 flex justify-center gap-4">
               <button onClick={() => setIsModalOpen(true)} className="text-blue-600 font-bold hover:underline">
                 Tạo thủ công
               </button>
               <span className="text-gray-300">|</span>
               <Link to="/seeds" className="text-blue-600 font-bold hover:underline">
                Tạo từ mẫu
              </Link>
            </div>
          </div>
        )}
      </div>
      
      <CreateExamModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateManual}
      />
    </div>
  );
};

export default ExamList;
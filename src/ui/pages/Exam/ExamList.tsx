import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, FileText, Play } from 'lucide-react';
import { ExamService } from '../../../core/services/ExamService';
import type { Exam } from '../../../core/entities/Exam';

const ExamList: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);

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
          {/* <Link 
            to="/exams/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Tạo thủ công</span>
          </Link> */}
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
            <div className="mt-4">
              <Link to="/seeds" className="text-blue-600 font-bold hover:underline">
                Tạo đề thi từ mẫu ngay &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamList;

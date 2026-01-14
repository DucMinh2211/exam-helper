import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Calendar, Printer, Edit, Plus, Trash2, Save, Download, FileJson, FileType } from 'lucide-react';
import { ExamService } from '../../../core/services/ExamService';
import { ExportService } from '../../../core/services/ExportService';
import type { Exam } from '../../../core/entities/Exam';
import type { Question, MCQuestion, TFQuestion } from '../../../core/entities/Question';
import QuestionPicker from './QuestionPicker';

const ExamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  
  // Export Menu State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadExam(id);
    }
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [id]);

  const loadExam = async (examId: string) => {
    try {
      const data = await ExamService.getExamDetailsWithQuestions(examId);
      setExam(data.exam);
      setQuestions(data.questions);
      
      const allQs = await ExamService.getAvailableQuestionsForExam(examId);
      setAvailableQuestions(allQs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveQuestion = async (qId: string) => {
    if (!exam) return;
    const newQuestionIds = exam.questionIds.filter(id => id !== qId);
    setExam({ ...exam, questionIds: newQuestionIds });
    setQuestions(questions.filter(q => q.id !== qId));
    await ExamService.updateExamQuestions(exam.id, newQuestionIds);
  };

  const handleAddQuestions = async (selectedIds: string[]) => {
    if (!exam) return;
    const newQuestionIds = [...exam.questionIds, ...selectedIds];
    await ExamService.updateExamQuestions(exam.id, newQuestionIds);
    loadExam(exam.id);
  };

  if (loading) return <div className="p-12 text-center text-gray-500 font-medium">Đang tải đề thi...</div>;
  if (!exam) return <div className="p-12 text-center text-red-500">Không tìm thấy đề thi!</div>;

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/exams" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{exam.name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <FileText size={14} /> {questions.length} câu hỏi
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 relative">
          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button 
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors font-bold"
            >
              <Download size={18} /> Xuất file
            </button>
            
            {isExportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => { ExportService.exportToDocx(exam, questions); setIsExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2 text-left hover:bg-blue-50 hover:text-blue-700 text-gray-700"
                >
                  <FileType size={16} className="text-blue-600" /> Xuất ra Word (.docx)
                </button>
                <button 
                  onClick={() => { ExportService.exportToPdf(exam.name, 'exam-content'); setIsExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2 text-left hover:bg-red-50 hover:text-red-700 text-gray-700"
                >
                  <Printer size={16} className="text-red-600" /> Xuất ra PDF
                </button>
                <button 
                  onClick={() => { ExportService.exportToJson(exam, questions); setIsExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2 text-left hover:bg-yellow-50 hover:text-yellow-700 text-gray-700"
                >
                  <FileJson size={16} className="text-yellow-600" /> Xuất ra JSON
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors font-bold ${
              isEditing 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isEditing ? <><Save size={18} /> Hoàn tất</> : <><Edit size={18} /> Sửa đề</>}
          </button>
        </div>
      </div>

      {/* Exam Content (Wrapped with ID for PDF capture) */}
      <div 
        id="exam-content"
        className={`bg-white border rounded-3xl shadow-sm p-12 print:shadow-none print:border-none print:p-0 relative ${isEditing ? 'border-blue-300 ring-4 ring-blue-50' : ''}`}
      >
        
        {isEditing && (
           <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse print:hidden z-10">
             Chế độ chỉnh sửa
           </div>
        )}

        <div className="text-center border-b pb-6 mb-8 print:mb-4">
          <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900 mb-2">{exam.name}</h2>
          <p className="text-gray-500 italic">Mã đề: {exam.id.slice(0, 8)}</p>
        </div>

        <div className="space-y-8">
          {questions.map((q, index) => (
            <div key={q.id} className="break-inside-avoid group relative">
              {/* Delete Button (Only in Edit Mode) */}
              {isEditing && (
                <button 
                  onClick={() => handleRemoveQuestion(q.id)}
                  className="absolute -left-12 top-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors print:hidden"
                  title="Xóa câu hỏi này"
                >
                  <Trash2 size={20} />
                </button>
              )}

              <div className="flex gap-4">
                <div className="font-bold text-blue-600 whitespace-nowrap pt-0.5 print:text-black">
                  Câu {index + 1}:
                </div>
                <div className="flex-1">
                  <div className="text-gray-900 font-medium mb-3 whitespace-pre-line leading-relaxed">
                    {q.content}
                  </div>

                  {/* Multiple Choice Options */}
                  {q.type === 'MULTIPLE_CHOICE' && (q as MCQuestion).choices && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                      {(q as MCQuestion).choices.map((choice, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="font-bold text-sm text-gray-500 w-5">{String.fromCharCode(65 + i)}.</span>
                          <span className="text-gray-700">{choice}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* True/False Options */}
                  {q.type === 'TRUE_FALSE' && (q as TFQuestion).choices && (
                    <div className="mt-2 border rounded-xl overflow-hidden text-sm">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                          <tr>
                            <th className="px-4 py-2 w-16 text-center">Ý</th>
                            <th className="px-4 py-2 border-l">Nội dung</th>
                            <th className="px-4 py-2 w-20 border-l text-center">Đúng</th>
                            <th className="px-4 py-2 w-20 border-l text-center">Sai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(q as TFQuestion).choices.map((choice, i) => (
                            <tr key={i}>
                              <td className="px-4 py-3 text-center font-bold text-gray-500">{i + 1}</td>
                              <td className="px-4 py-3 border-l text-gray-700">{choice}</td>
                              <td className="px-4 py-3 border-l text-center">
                                <div className="w-4 h-4 border border-gray-300 rounded-full mx-auto print:border-black"></div>
                              </td>
                              <td className="px-4 py-3 border-l text-center">
                                <div className="w-4 h-4 border border-gray-300 rounded-full mx-auto print:border-black"></div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {/* Essay Space */}
                  {q.type === 'ESSAY' && (
                     <div className="mt-4 h-32 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 print:border-gray-300"></div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Question Button (Only in Edit Mode) */}
        {isEditing && (
          <div className="mt-8 pt-8 border-t border-dashed border-gray-200 print:hidden">
            <button 
              onClick={() => setIsPickerOpen(true)}
              className="w-full py-4 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors font-bold flex items-center justify-center gap-2"
            >
              <Plus size={24} />
              Thêm câu hỏi
            </button>
          </div>
        )}

        <div className="mt-12 pt-6 border-t text-center text-sm text-gray-400 print:block hidden">
          --- Hết ---
        </div>
      </div>
      
      {/* Question Picker Drawer */}
      <QuestionPicker 
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        availableQuestions={availableQuestions}
        currentQuestionIds={exam.questionIds}
        onAdd={handleAddQuestions}
      />
    </div>
  );
};

export default ExamDetail;

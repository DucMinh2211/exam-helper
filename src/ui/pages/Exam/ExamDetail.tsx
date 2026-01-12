import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Calendar, CheckCircle2, XCircle, Printer } from 'lucide-react';
import { ExamService } from '../../../core/services/ExamService';
import type { Exam } from '../../../core/entities/Exam';
import type { Question, MCQuestion, TFQuestion } from '../../../core/entities/Question';

const ExamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [banksMap, setBanksMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      loadExam(id);
    }
  }, [id]);

  const loadExam = async (examId: string) => {
    try {
      const data = await ExamService.getExamDetailsWithQuestions(examId);
      setExam(data.exam);
      setQuestions(data.questions);
      setBanksMap(data.banksMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
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
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl hover:bg-black transition-colors font-bold shadow-lg"
        >
          <Printer size={18} /> In đề thi
        </button>
      </div>

      {/* Exam Content */}
      <div className="bg-white border rounded-3xl shadow-sm p-8 print:shadow-none print:border-none print:p-0">
        <div className="text-center border-b pb-6 mb-8 print:mb-4">
          <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900 mb-2">{exam.name}</h2>
          <p className="text-gray-500 italic">Mã đề: {exam.id.slice(0, 8)}</p>
        </div>

        <div className="space-y-8">
          {questions.map((q, index) => (
            <div key={q.id} className="break-inside-avoid">
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
                          {/* Highlight answer ONLY in screen mode, hide in print */}
                          {/* {(q as MCQuestion).answer === i && (
                            <CheckCircle2 size={16} className="text-green-500 ml-2 print:hidden" />
                          )} */}
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
                                {/* <div className="w-4 h-4 border border-gray-300 rounded-full mx-auto"></div> */}
                                <input type="checkbox" disabled className="w-4 h-4 rounded-full"/>
                              </td>
                              <td className="px-4 py-3 border-l text-center">
                                <input type="checkbox" disabled className="w-4 h-4 rounded-full"/>
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

        <div className="mt-12 pt-6 border-t text-center text-sm text-gray-400 print:block hidden">
          --- Hết ---
        </div>
      </div>
    </div>
  );
};

export default ExamDetail;

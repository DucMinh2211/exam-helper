import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Tag as TagIcon, X, CheckCircle2, XCircle, PlusCircle, Edit2 } from 'lucide-react';
import { BankService } from '../../../core/services/BankService';
import { QuestionService } from '../../../core/services/QuestionService';
import type { Bank } from '../../../core/entities/Bank';
import type { Question, QuestionType, MCQuestion, TFQuestion } from '../../../core/entities/Question';

const BankEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [bank, setBank] = useState<Bank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  
  // Multiple Choice & True/False Shared State
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [mcCorrectAnswer, setMcCorrectAnswer] = useState<number>(0); // For MC
  const [tfAnswers, setTfAnswers] = useState<boolean[]>([false, false, false, false]); // For TF

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (bankId: string) => {
    const bankData = await BankService.getBankDetails(bankId);
    if (bankData) {
      setBank(bankData);
      const questionList = await QuestionService.getQuestionsByBank(bankId);
      setQuestions(questionList);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTags([]);
    setChoices(['', '', '', '']);
    setMcCorrectAnswer(0);
    setTfAnswers([false, false, false, false]);
    setEditingQuestionId(null);
    setType('MULTIPLE_CHOICE');
  };

  const handleEditClick = (q: Question) => {
    setEditingQuestionId(q.id);
    setTitle(q.title);
    setContent(q.content);
    setType(q.type);
    setTags(q.tags);

    if (q.type === 'MULTIPLE_CHOICE') {
      const mcQ = q as MCQuestion;
      setChoices(mcQ.choices);
      setMcCorrectAnswer(mcQ.answer);
    } else if (q.type === 'TRUE_FALSE') {
      const tfQ = q as TFQuestion;
      setChoices(tfQ.choices);
      setTfAnswers(tfQ.answers);
    } else {
      // Essay
      setChoices(['', '', '', '']);
    }

    setShowAddForm(true);
    // Scroll to form
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title.trim()) return;

    const baseData = {
      bankId: id,
      title,
      content,
      type,
      tags,
    };

    let finalData: any = baseData;

    if (type === 'MULTIPLE_CHOICE') {
      finalData = {
        ...baseData,
        choices: choices.filter(c => c.trim() !== ''),
        answer: mcCorrectAnswer,
      };
      // For editing, ensure choices array is aligned. 
      // Simplified: We assume user cleans up empty choices or we save as is.
      finalData.choices = choices; 
    } else if (type === 'TRUE_FALSE') {
       finalData = {
        ...baseData,
        choices: choices,
        answers: tfAnswers,
      };
    }

    if (editingQuestionId) {
      await QuestionService.updateQuestion(editingQuestionId, finalData);
    } else {
      await QuestionService.createQuestion(finalData);
    }

    // Reset form
    resetForm();
    setShowAddForm(false);
    loadData(id);
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (window.confirm('Xóa câu hỏi này?')) {
      await QuestionService.deleteQuestion(qId);
      if (id) loadData(id);
    }
  };

  const handleChoiceChange = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleTfChange = (index: number) => {
    const newTf = [...tfAnswers];
    newTf[index] = !newTf[index];
    setTfAnswers(newTf);
  };
  
  // Dynamic List Handlers
  const addChoice = () => {
    setChoices([...choices, '']);
    if (type === 'TRUE_FALSE') {
      setTfAnswers([...tfAnswers, false]);
    }
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 1) return; // Prevent removing last choice
    
    const newChoices = choices.filter((_, i) => i !== index);
    setChoices(newChoices);

    if (type === 'TRUE_FALSE') {
      const newTf = tfAnswers.filter((_, i) => i !== index);
      setTfAnswers(newTf);
    } else if (type === 'MULTIPLE_CHOICE') {
      // Adjust correct answer index if needed
      if (index === mcCorrectAnswer) {
        setMcCorrectAnswer(0); // Reset to first if selected was removed
      } else if (index < mcCorrectAnswer) {
        setMcCorrectAnswer(mcCorrectAnswer - 1);
      }
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
      }
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  if (!bank) return <div className="p-8 text-center text-gray-500 font-medium">Đang tải dữ liệu...</div>;

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 hover:bg-white shadow-sm border rounded-full transition-all text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">{bank.name}</h1>
          <p className="text-gray-500 font-medium flex items-center gap-2">
            <TagIcon size={14} />
            {questions.length} câu hỏi trong ngân hàng
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-6 mb-8 pr-2">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  #{questions.length - idx}
                </span>
                <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-600 rounded-lg uppercase tracking-wide">
                  {q.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEditClick(q)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                  title="Chỉnh sửa câu hỏi"
                >
                  <Edit2 size={20} />
                </button>
                <button 
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  title="Xóa câu hỏi"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-2">{q.title}</h3>
            <p className="text-gray-700 leading-relaxed mb-4 whitespace-pre-line">{q.content}</p>

            {/* Render Multiple Choice */}
            {q.type === 'MULTIPLE_CHOICE' && (q as MCQuestion).choices && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {(q as MCQuestion).choices.map((choice, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-xl border flex items-center gap-3 ${(q as MCQuestion).answer === i ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${(q as MCQuestion).answer === i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-sm font-medium">{choice}</span>
                    {(q as MCQuestion).answer === i && <CheckCircle2 size={16} className="ml-auto" />}
                  </div>
                ))}
              </div>
            )}

            {/* Render True/False */}
            {q.type === 'TRUE_FALSE' && (q as TFQuestion).choices && (
              <div className="space-y-2 mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                {(q as TFQuestion).choices.map((choice, i) => (
                  <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-gray-700 text-sm font-medium">{choice}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${(q as TFQuestion).answers[i] ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                      {(q as TFQuestion).answers[i] ? (
                        <>Đúng <CheckCircle2 size={12} /></>
                      ) : (
                        <>Sai <XCircle size={12} /></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {q.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                {q.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-full border border-blue-100 uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {questions.length === 0 && !showAddForm && (
          <div className="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl">
            <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Plus className="text-gray-300" size={32} />
            </div>
            <p className="text-gray-500 font-medium italic">Chưa có câu hỏi nào trong ngân hàng này.</p>
          </div>
        )}
      </div>

      {!showAddForm ? (
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-md py-4 border-t">
          <button 
            onClick={() => { resetForm(); setShowAddForm(true); }}
            className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200"
          >
            <Plus size={24} />
            Soạn câu hỏi mới
          </button>
        </div>
      ) : (
        <div className="bg-white border-2 border-blue-600 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-gray-900">
              {editingQuestionId ? 'Chỉnh sửa câu hỏi' : 'Soạn câu hỏi mới'}
            </h2>
            <button 
              onClick={() => { setShowAddForm(false); resetForm(); }}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleSaveQuestion} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Tiêu đề</label>
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                  placeholder="Câu 1, Bài 2..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Loại hình</label>
                <select 
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as QuestionType;
                    setType(newType);
                    // Reset choices/answers when switching type for clarity
                    if (newType === 'MULTIPLE_CHOICE' || newType === 'TRUE_FALSE') {
                       setChoices(['', '', '', '']);
                       setTfAnswers([false, false, false, false]);
                       setMcCorrectAnswer(0);
                    }
                  }}
                  className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                >
                  <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
                  <option value="TRUE_FALSE">Đúng / Sai (Mệnh đề)</option>
                  <option value="ESSAY">Tự luận</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nội dung câu hỏi</label>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] transition-all font-medium text-lg"
                placeholder="Nhập nội dung chính của câu hỏi..."
              />
            </div>

            {/* Form cho Trắc nghiệm */}
            {type === 'MULTIPLE_CHOICE' && (
              <div className="bg-blue-50/50 p-6 rounded-2xl space-y-4 border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                   <label className="block text-xs font-black text-blue-400 uppercase tracking-widest">Các lựa chọn</label>
                   <button type="button" onClick={addChoice} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                     <PlusCircle size={14} /> Thêm lựa chọn
                   </button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {choices.map((choice, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input 
                        type="radio"
                        name="correct-answer"
                        checked={mcCorrectAnswer === index}
                        onChange={() => setMcCorrectAnswer(index)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                        title="Đánh dấu đáp án đúng"
                      />
                      <span className="w-6 text-center text-xs font-bold text-gray-400">{String.fromCharCode(65 + index)}</span>
                      <input 
                        type="text"
                        value={choice}
                        onChange={(e) => handleChoiceChange(index, e.target.value)}
                        className={`flex-1 border-2 rounded-xl px-4 py-2 outline-none transition-all font-medium ${mcCorrectAnswer === index ? 'border-blue-500 bg-white shadow-sm' : 'border-gray-200 bg-white/50 focus:border-blue-300'}`}
                        placeholder={`Nội dung đáp án...`}
                      />
                      <button 
                        type="button" 
                        onClick={() => removeChoice(index)}
                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa lựa chọn này"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form cho Đúng/Sai */}
            {type === 'TRUE_FALSE' && (
              <div className="bg-purple-50/50 p-6 rounded-2xl space-y-4 border border-purple-100">
                <div className="flex justify-between items-center mb-2">
                   <label className="block text-xs font-black text-purple-400 uppercase tracking-widest">Các mệnh đề</label>
                   <button type="button" onClick={addChoice} className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
                     <PlusCircle size={14} /> Thêm mệnh đề
                   </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {choices.map((choice, index) => (
                    <div key={index} className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {index + 1}
                      </div>
                      <input 
                        type="text"
                        value={choice}
                        onChange={(e) => handleChoiceChange(index, e.target.value)}
                        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-purple-400 transition-all font-medium bg-white"
                        placeholder={`Mệnh đề số ${index + 1}...`}
                      />
                      <button
                        type="button"
                        onClick={() => handleTfChange(index)}
                        className={`w-24 py-2 rounded-xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-1 shrink-0 ${
                          tfAnswers[index] 
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
                            : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                        }`}
                      >
                        {tfAnswers[index] ? (
                          <>Đúng <CheckCircle2 size={16}/></>
                        ) : (
                          <>Sai <XCircle size={16}/></>
                        )}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => removeChoice(index)}
                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Xóa mệnh đề này"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nhãn phân loại (Gõ và nhấn Enter)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black rounded-lg uppercase tracking-wider shadow-sm">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <input 
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleAddTag}
                className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                placeholder="Ví dụ: Chương 1, Dễ, Toán..."
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => { setShowAddForm(false); resetForm(); }}
                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit"
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 font-black text-lg transition-all active:scale-[0.98]"
              >
                {editingQuestionId ? 'Cập nhật câu hỏi' : 'Lưu câu hỏi mới'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BankEditor;
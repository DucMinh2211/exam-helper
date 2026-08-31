import type { Exam } from '../../../core/entities/Exam';
import type { EssayQuestion, MCQuestion, Question, TFQuestion } from '../../../core/entities/Question';

interface ExamAnswerSheetProps {
  exam: Exam;
  questions: Question[];
}

export default function ExamAnswerSheet({ exam, questions }: ExamAnswerSheetProps) {
  return (
    <div id="answer-content" className="relative rounded-3xl border bg-white p-12 shadow-sm print:border-none print:p-0 print:shadow-none">
      <div className="mb-8 border-b pb-6 text-center print:mb-4">
        <p className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-blue-600 print:text-black">Đáp án</p>
        <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">{exam.name}</h2>
        <p className="mt-2 italic text-gray-500">Mã đề: {exam.id.slice(0, 8)}</p>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => {
          if (question.type === 'MULTIPLE_CHOICE') {
            const mc = question as MCQuestion;
            const label = String.fromCharCode(65 + mc.answer);
            return (
              <div key={question.id} className="break-inside-avoid rounded-xl border border-green-100 bg-green-50/60 p-4">
                <span className="font-black text-gray-900">Câu {index + 1}: </span>
                <span className="font-black text-green-700">{label}.</span>
                <span className="ml-2 text-gray-700">{mc.choices[mc.answer]}</span>
              </div>
            );
          }

          if (question.type === 'TRUE_FALSE') {
            const tf = question as TFQuestion;
            return (
              <div key={question.id} className="break-inside-avoid rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                <p className="mb-3 font-black text-gray-900">Câu {index + 1}</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {tf.choices.map((choice, choiceIndex) => (
                    <div key={choiceIndex} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                      <p className="font-black text-purple-700">{String.fromCharCode(97 + choiceIndex)}. {tf.answers[choiceIndex] ? 'Đúng' : 'Sai'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{choice}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          const essay = question as EssayQuestion;
          return (
            <div key={question.id} className="break-inside-avoid rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="font-black text-gray-900">Câu {index + 1}</p>
              <p className="mt-2 whitespace-pre-line text-gray-700">{essay.answer?.trim() || 'Chưa có đáp án mẫu.'}</p>
            </div>
          );
        })}
      </div>

      {questions.length === 0 && <p className="py-12 text-center italic text-gray-500">Đề thi chưa có câu hỏi.</p>}
      <div className="mt-12 hidden border-t pt-6 text-center text-sm text-gray-400 print:block">--- Hết đáp án ---</div>
    </div>
  );
}


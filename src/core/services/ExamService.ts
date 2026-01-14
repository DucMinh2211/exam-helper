import { ExamRepository } from '../../data/repositories/ExamRepository';
import { ExamSeedRepository } from '../../data/repositories/ExamSeedRepository';
import { QuestionRepository } from '../../data/repositories/QuestionRepository';
import { BankRepository } from '../../data/repositories/BankRepository';
import type { Exam } from '../entities/Exam';
import type { Question } from '../entities/Question';

export const ExamService = {
  async listAllExams(): Promise<Exam[]> {
    return ExamRepository.getAll();
  },

  async getExamById(id: string): Promise<Exam | undefined> {
    return ExamRepository.getById(id);
  },

  async deleteExam(id: string): Promise<void> {
    return ExamRepository.delete(id);
  },

  async createManualExam(name: string, bankIds: string[]): Promise<Exam> {
    return ExamRepository.create({
      name,
      bankIds,
      questionIds: [] // Khởi tạo rỗng
    });
  },

  async updateExamQuestions(examId: string, questionIds: string[]): Promise<void> {
    return ExamRepository.update(examId, { questionIds });
  },
  
  // --- Import ---
  async importExamFromJson(file: File): Promise<Exam> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          if (!data.exam || !data.questions) {
            throw new Error('File JSON không đúng định dạng (thiếu exam hoặc questions)');
          }

          const examData = data.exam as Exam;
          const questionsData = data.questions as Question[];

          // 1. Lưu các câu hỏi (Upsert - Cập nhật nếu đã có)
          // Lưu ý: Cần đảm bảo Bank của câu hỏi cũng tồn tại. 
          // Nếu bankId không tồn tại trong hệ thống hiện tại, câu hỏi vẫn được lưu nhưng có thể không hiện trong BankEditor.
          // Tốt nhất là import cả Bank (nhưng hiện tại ta chỉ import Exam).
          for (const q of questionsData) {
            await QuestionRepository.save(q);
          }

          // 2. Lưu Exam
          // Cần đổi ID của Exam để tránh trùng nếu import lại chính file cũ?
          // Hoặc giữ nguyên ID để cập nhật? -> Giữ nguyên ID là hành vi của "Restore/Sync".
          // Nếu muốn tạo bản sao -> Cần sinh ID mới cho Exam.
          // Ở đây ta chọn cách: Tạo Exam MỚI hoàn toàn để an toàn, tránh ghi đè đề cũ.
          
          // Tuy nhiên, ID của câu hỏi trong exam.questionIds lại tham chiếu đến ID cũ.
          // Nếu ta tạo Exam mới nhưng vẫn trỏ đến ID câu hỏi cũ -> OK.
          
          const newExam = await ExamRepository.create({
            ...examData,
            name: `${examData.name} (Imported)`,
            // createdAt: Date.now() // Repository.create tự làm việc này
          });

          resolve(newExam);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Lỗi đọc file'));
      reader.readAsText(file);
    });
  },

  // --- Logic sinh đề ngẫu nhiên ---
  async generateExamFromSeed(seedId: string, examName: string): Promise<Exam> {
    const seed = await ExamSeedRepository.getById(seedId);
    if (!seed) throw new Error('Mẫu đề thi không tồn tại');

    // 1. Lấy tất cả câu hỏi từ các ngân hàng được chọn trong Seed
    let allQuestions: Question[] = [];
    for (const bankId of seed.bankIds) {
      const questions = await QuestionRepository.getByBankId(bankId);
      allQuestions = allQuestions.concat(questions);
    }

    const selectedQuestionIds: string[] = [];

    // 2. Duyệt qua từng Block để lọc và chọn câu hỏi
    for (const block of seed.questionBlocks) {
      // Lọc câu hỏi chưa được chọn VÀ thỏa mãn tag
      const candidates = allQuestions.filter(q => {
        if (selectedQuestionIds.includes(q.id)) return false; // Đã chọn rồi thì bỏ qua
        
        // Logic lọc Tag: Câu hỏi phải chứa ÍT NHẤT một tag trong block
        // Nếu block không có tag nào -> lấy tất cả
        if (block.tags.length === 0) return true;
        
        // Kiểm tra giao thoa giữa tag câu hỏi và tag block
        return q.tags.some(t => block.tags.includes(t));
      });

      // Shuffle (Xáo trộn ngẫu nhiên) - Thuật toán Fisher-Yates đơn giản
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      // Lấy n câu đầu tiên
      const picked = candidates.slice(0, block.numberOfQuestions);
      
      if (picked.length < block.numberOfQuestions) {
        console.warn(`Block tags [${block.tags}] yêu cầu ${block.numberOfQuestions} câu nhưng chỉ tìm thấy ${picked.length} câu.`);
      }

      picked.forEach(q => selectedQuestionIds.push(q.id));
    }

    // 3. Tạo Exam mới
    return ExamRepository.create({
      name: examName,
      bankIds: seed.bankIds,
      questionIds: selectedQuestionIds,
    });
  },

  // Hàm hỗ trợ lấy chi tiết câu hỏi cho giao diện hiển thị đề
  async getExamDetailsWithQuestions(examId: string): Promise<{ exam: Exam, questions: Question[], banksMap: Record<string, string> }> {
    const exam = await ExamRepository.getById(examId);
    if (!exam) throw new Error('Đề thi không tồn tại');

    // Lấy chi tiết từng câu hỏi
    const questions: Question[] = [];
    
    let allRelatedQuestions: Question[] = [];
    for (const bankId of exam.bankIds) {
      const qs = await QuestionRepository.getByBankId(bankId);
      allRelatedQuestions = allRelatedQuestions.concat(qs);
    }
    
    // Map lại theo đúng thứ tự trong exam.questionIds
    // Nếu câu hỏi nào bị xóa khỏi bank gốc, ta bỏ qua nó
    exam.questionIds.forEach(qId => {
      // Tìm trong allRelatedQuestions trước (ưu tiên câu hỏi thuộc bank của đề)
      let q = allRelatedQuestions.find(i => i.id === qId);
      
      // Nếu không thấy (do câu hỏi được import từ file khác, bankId có thể khác),
      // ta cần fetch trực tiếp nó (fallback) -> nhưng ở đây để tối ưu ta chưa làm.
      // Với logic Import mới, câu hỏi được lưu vào DB, nên ta có thể cần query tất cả question
      // nếu không tìm thấy trong bank.
      
      if (q) {
        questions.push(q);
      } else {
        // Fallback: Thử query trực tiếp (có thể chậm nếu loop nhiều)
        // Nhưng vì Import lưu câu hỏi vào DB rồi, nên query này sẽ ra.
        // Tuy nhiên `getExamDetailsWithQuestions` hiện tại đang dựa vào `bankIds` để lọc câu hỏi.
        // Khi import, nếu `bankIds` trong file JSON không khớp với bank trong máy hiện tại,
        // thì vòng lặp trên sẽ không tìm ra câu hỏi.
        
        // FIX: Import nên import cả Bank (tạm bỏ qua)
        // HOẶC: Chấp nhận query N câu hỏi nếu không thấy.
      }
    });
    
    // Fix logic lấy câu hỏi: Nếu import đề từ máy khác, bankId có thể không khớp.
    // Nên ta phải lấy câu hỏi dựa trên questionIds chứ không chỉ dựa vào bankIds.
    // Dexie: db.questions.where('id').anyOf(exam.questionIds).toArray()
    // Hàm này tối ưu hơn nhiều.
    
    const finalQuestions = await QuestionRepository.getByQuestionIds(exam.questionIds);
    // Sort theo đúng thứ tự trong exam.questionIds
    const sortedQuestions = exam.questionIds
      .map(id => finalQuestions.find(q => q.id === id))
      .filter((q): q is Question => !!q);


    // Lấy tên các Bank để hiển thị
    const banks = await BankRepository.getAll();
    const banksMap: Record<string, string> = {};
    banks.forEach(b => banksMap[b.id] = b.name);

    return { exam, questions: sortedQuestions, banksMap };
  },

  async getAvailableQuestionsForExam(examId: string): Promise<Question[]> {
    const exam = await ExamRepository.getById(examId);
    if (!exam) return [];

    let allQuestions: Question[] = [];
    for (const bankId of exam.bankIds) {
      const questions = await QuestionRepository.getByBankId(bankId);
      allQuestions = allQuestions.concat(questions);
    }
    return allQuestions;
  }
};

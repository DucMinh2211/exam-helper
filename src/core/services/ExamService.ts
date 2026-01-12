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
    // Dexie không hỗ trợ where('id').in([...]), nên ta dùng Promise.all hoặc lấy all rồi lọc.
    // Vì số lượng câu hỏi trong 1 đề thường < 100, ta có thể fetch thủ công.
    // Tối ưu hơn: Lấy tất cả câu hỏi từ các bank liên quan rồi lọc map.
    
    // Cách đơn giản và an toàn nhất hiện tại:
    const questions: Question[] = [];
    // Lưu ý: Đây là N+1 query, nhưng với IndexedDB local thì rất nhanh. 
    // Tuy nhiên để tối ưu, ta nên lấy theo Bank.
    
    let allRelatedQuestions: Question[] = [];
    for (const bankId of exam.bankIds) {
      const qs = await QuestionRepository.getByBankId(bankId);
      allRelatedQuestions = allRelatedQuestions.concat(qs);
    }
    
    // Map lại theo đúng thứ tự trong exam.questionIds
    exam.questionIds.forEach(qId => {
      const q = allRelatedQuestions.find(i => i.id === qId);
      if (q) questions.push(q);
    });

    // Lấy tên các Bank để hiển thị
    const banks = await BankRepository.getAll();
    const banksMap: Record<string, string> = {};
    banks.forEach(b => banksMap[b.id] = b.name);

    return { exam, questions, banksMap };
  }
};

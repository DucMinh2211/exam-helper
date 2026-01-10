import { QuestionRepository } from '../../data/repositories/QuestionRepository';
import type { Question, MCQuestion, TFQuestion, EssayQuestion } from '../entities/Question';

export const QuestionService = {
  async getQuestionsByBank(bankId: string): Promise<Question[]> {
    return QuestionRepository.getByBankId(bankId);
  },

  async createQuestion(data: Omit<Question | MCQuestion | TFQuestion | EssayQuestion, 'id' | 'createdAt'>): Promise<Question> {
    if (!data.title.trim()) throw new Error('Question title is required');
    return QuestionRepository.create(data);
  },

  async deleteQuestion(id: string): Promise<void> {
    return QuestionRepository.delete(id);
  },

  async updateTags(id: string, tags: string[]): Promise<void> {
    return QuestionRepository.update(id, { tags });
  },

  async updateQuestion(id: string, data: Partial<Question | MCQuestion | TFQuestion | EssayQuestion>): Promise<void> {
    if (data.title && !data.title.trim()) throw new Error('Question title is required');
    return QuestionRepository.update(id, data);
  }
};

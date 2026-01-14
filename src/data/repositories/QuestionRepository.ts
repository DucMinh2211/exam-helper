import { db } from '../db';
import type { Question, MCQuestion, TFQuestion, EssayQuestion } from '../../core/entities/Question';
import { v4 as uuidv4 } from 'uuid';

export const QuestionRepository = {
  async getByBankId(bankId: string): Promise<Question[]> {
    return db.questions.where('bankId').equals(bankId).reverse().sortBy('createdAt');
  },

  async getByQuestionIds(ids: string[]): Promise<Question[]> {
    return db.questions.where('id').anyOf(ids).toArray();
  },

  async create(questionData: Omit<Question | MCQuestion | TFQuestion | EssayQuestion, 'id' | 'createdAt'>): Promise<Question> {
    const question = {
      ...questionData,
      id: uuidv4(),
      createdAt: Date.now(),
    } as Question;
    
    await db.questions.add(question);
    return question;
  },

  // Hàm này dùng để import, giữ nguyên ID từ file
  async save(question: Question): Promise<void> {
    await db.questions.put(question);
  },

  async update(id: string, updates: Partial<Question>): Promise<void> {
    await db.questions.update(id, updates);
  },

  async delete(id: string): Promise<void> {
    await db.questions.delete(id);
  },

  async addTag(id: string, tag: string): Promise<void> {
    const question = await db.questions.get(id);
    if (question && !question.tags.includes(tag)) {
      await db.questions.update(id, {
        tags: [...question.tags, tag]
      });
    }
  },

  async removeTag(id: string, tag: string): Promise<void> {
    const question = await db.questions.get(id);
    if (question) {
      await db.questions.update(id, {
        tags: question.tags.filter(t => t !== tag)
      });
    }
  }
};
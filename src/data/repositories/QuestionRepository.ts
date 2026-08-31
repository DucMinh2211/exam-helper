import { db } from '../db';
import type { Question, MCQuestion, TFQuestion, EssayQuestion, NewQuestion } from '../../core/entities/Question';
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

  async importMany(questionData: NewQuestion[]): Promise<Question[]> {
    return db.transaction('rw', db.questions, async () => {
      const timestamp = Date.now();
      const questions = questionData.map((data, index) => ({
        ...data,
        id: uuidv4(),
        // Repository reads newest-first; decreasing timestamps preserve DOCX order.
        createdAt: timestamp - index,
      })) as Question[];
      await db.questions.bulkAdd(questions);
      return questions;
    });
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

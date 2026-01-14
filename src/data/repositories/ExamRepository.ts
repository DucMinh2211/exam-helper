import { db } from '../db';
import type { Exam } from '../../core/entities/Exam';
import { v4 as uuidv4 } from 'uuid';

export const ExamRepository = {
  async getAll(): Promise<Exam[]> {
    return db.exams.orderBy('createdAt').reverse().toArray();
  },

  async getById(id: string): Promise<Exam | undefined> {
    return db.exams.get(id);
  },

  async create(examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<Exam> {
    const now = Date.now();
    const exam: Exam = {
      ...examData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    await db.exams.add(exam);
    return exam;
  },
  
  // Hàm này dùng để import, giữ nguyên ID từ file
  async save(exam: Exam): Promise<void> {
    await db.exams.put(exam);
  },

  async update(id: string, updates: Partial<Exam>): Promise<void> {
    await db.exams.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.exams.delete(id);
  }
};
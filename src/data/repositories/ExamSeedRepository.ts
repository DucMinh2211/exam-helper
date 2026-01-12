import { db } from '../db';
import type { ExamSeed } from '../../core/entities/ExamSeed';
import { v4 as uuidv4 } from 'uuid';

export const ExamSeedRepository = {
  async getAll(): Promise<ExamSeed[]> {
    return db.examSeeds.orderBy('createdAt').reverse().toArray();
  },

  async getById(id: string): Promise<ExamSeed | undefined> {
    return db.examSeeds.get(id);
  },

  async create(seedData: Omit<ExamSeed, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExamSeed> {
    const now = Date.now();
    const seed: ExamSeed = {
      ...seedData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    await db.examSeeds.add(seed);
    return seed;
  },

  async update(id: string, updates: Partial<ExamSeed>): Promise<void> {
    await db.examSeeds.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.examSeeds.delete(id);
  }
};

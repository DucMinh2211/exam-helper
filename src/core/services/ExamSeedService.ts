import { ExamSeedRepository } from '../../data/repositories/ExamSeedRepository';
import type { ExamSeed } from '../entities/ExamSeed';

export const ExamSeedService = {
  async listAllSeeds(): Promise<ExamSeed[]> {
    return ExamSeedRepository.getAll();
  },

  async getSeedById(id: string): Promise<ExamSeed | undefined> {
    return ExamSeedRepository.getById(id);
  },

  async createSeed(data: Omit<ExamSeed, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExamSeed> {
    if (!data.name.trim()) throw new Error('Exam Seed name is required');
    return ExamSeedRepository.create(data);
  },

  async updateSeed(id: string, data: Partial<ExamSeed>): Promise<void> {
    return ExamSeedRepository.update(id, data);
  },

  async deleteSeed(id: string): Promise<void> {
    return ExamSeedRepository.delete(id);
  }
};

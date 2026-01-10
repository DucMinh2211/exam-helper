import { db } from '../db';
import type { Bank } from '../../core/entities/Bank';
import { v4 as uuidv4 } from 'uuid';

export const BankRepository = {
  async getAll(): Promise<Bank[]> {
    return db.banks.toArray();
  },

  async getById(id: string): Promise<Bank | undefined> {
    return db.banks.get(id);
  },

  async create(name: string, description?: string): Promise<Bank> {
    const now = Date.now();
    const bank: Bank = {
      id: uuidv4(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
    };
    await db.banks.add(bank);
    return bank;
  },

  async update(id: string, updates: Partial<Bank>): Promise<void> {
    await db.banks.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.banks, db.questions, async () => {
      await db.questions.where('bankId').equals(id).delete();
      await db.banks.delete(id);
    });
  }
};

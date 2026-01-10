import { BankRepository } from '../../data/repositories/BankRepository';
import type { Bank } from '../entities/Bank';

export const BankService = {
  async listAllBanks(): Promise<Bank[]> {
    return BankRepository.getAll();
  },

  async createNewBank(name: string, description?: string): Promise<Bank> {
    if (!name.trim()) throw new Error('Bank name is required');
    return BankRepository.create(name, description);
  },

  async removeBank(id: string): Promise<void> {
    return BankRepository.delete(id);
  },

  async getBankDetails(id: string): Promise<Bank | undefined> {
    return BankRepository.getById(id);
  }
};

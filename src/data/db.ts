import Dexie, { type Table } from 'dexie';
import type { Bank } from '../core/entities/Bank';
import type { Question } from '../core/entities/Question';

export class AppDatabase extends Dexie {
  banks!: Table<Bank>;
  questions!: Table<Question>;

  constructor() {
    super('ExamHelperDB');
    this.version(1).stores({
      banks: 'id, name, createdAt',
      questions: 'id, bankId, type, *tags, createdAt' // *tags allows indexing elements within the array
    });
  }
}

export const db = new AppDatabase();

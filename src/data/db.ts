import Dexie, { type Table } from 'dexie';
import type { Bank } from '../core/entities/Bank';
import type { Question } from '../core/entities/Question';
import type { Exam } from '../core/entities/Exam';
import type { ExamSeed } from '../core/entities/ExamSeed';

export class AppDatabase extends Dexie {
  banks!: Table<Bank>;
  questions!: Table<Question>;
  exams!: Table<Exam>;
  examSeeds!: Table<ExamSeed>;

  constructor() {
    super('ExamHelperDB');
    this.version(1).stores({
      banks: 'id, name, createdAt',
      questions: 'id, bankId, type, *tags, createdAt',
      exams: 'id, name, createdAt',
      examSeeds: 'id, name, createdAt'
    });
  }
}

export const db = new AppDatabase();

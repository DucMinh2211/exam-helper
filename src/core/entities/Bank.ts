import type { ParsedQuestion } from '../import/parsers/QuestionDocumentParser';

export interface BankDocxSource {
  id?: string;
  name: string;
  base64: string;
  questions: Array<{ questionId?: string; original: ParsedQuestion }>;
}

export interface Bank {
  docxSources?: BankDocxSource[];
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

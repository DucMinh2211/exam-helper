import type { QuestionType } from '../../entities/Question';
import type { DocumentModel, SourceRange } from '../models/DocumentModel';

export type ImportIssueSeverity = 'warning' | 'error';

export interface ImportIssue {
  code: string;
  message: string;
  severity: ImportIssueSeverity;
  source: SourceRange;
  questionKey?: string;
}

export interface ParserDetection {
  confidence: number;
  reasons: string[];
}

export interface ParsedQuestion {
  key: string;
  topic?: string;
  lesson?: string;
  section?: string;
  number: number;
  type: Extract<QuestionType, 'MULTIPLE_CHOICE' | 'TRUE_FALSE'>;
  content: string;
  choices: string[];
  answer: number | boolean[] | null;
  confidence: number;
  rawText: string;
  source: SourceRange;
  issues: ImportIssue[];
}

export interface QuestionParseResult {
  parserId: string;
  parserVersion: string;
  questions: ParsedQuestion[];
  warnings: ImportIssue[];
  confidence: number;
}

export interface QuestionDocumentParser {
  readonly id: string;
  readonly version: string;
  detect(document: DocumentModel): ParserDetection;
  parse(document: DocumentModel): QuestionParseResult;
}

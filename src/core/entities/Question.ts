export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'ESSAY';

export interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
}

export interface MCQuestion extends Question {
  type: 'MULTIPLE_CHOICE';
  choices: string[];
  answer: number; // index of the correct choice
}

export interface TFQuestion extends Question {
  type: 'TRUE_FALSE';
  choices: string[];
  answers: boolean[]; // Array of booleans corresponding to choices
}

export interface EssayQuestion extends Question {
  type: 'ESSAY';
  answer?: string; // model answer
}

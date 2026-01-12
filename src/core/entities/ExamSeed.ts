export interface QuestionBlock {
  id: string;           // Định danh block (để dễ thao tác UI)
  numberOfQuestions: number;
  tags: string[];       // Các tag dùng để lọc câu hỏi
}

export interface ExamSeed {
  id: string;
  name: string;
  description?: string;
  bankIds: string[];            // Các ngân hàng nguồn
  questionBlocks: QuestionBlock[]; // Cấu hình các khối câu hỏi
  createdAt: number;
  updatedAt: number;
}

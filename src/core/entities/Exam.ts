export interface Exam {
  id: string;
  name: string;
  bankIds: string[];     // Danh sách các ngân hàng được sử dụng
  questionIds: string[]; // Danh sách ID các câu hỏi đã chọn
  createdAt: number;
  updatedAt: number;
}

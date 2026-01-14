import { db } from '../../data/db';
import { saveAs } from 'file-saver';

export const DataService = {
  // 1. Sao lưu toàn bộ dữ liệu
  async backupData() {
    try {
      const banks = await db.banks.toArray();
      const questions = await db.questions.toArray();
      const exams = await db.exams.toArray();
      const examSeeds = await db.examSeeds.toArray();

      const data = {
        metadata: {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          appName: 'ExamHelper'
        },
        data: {
          banks,
          questions,
          exams,
          examSeeds
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const fileName = `exam-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
      saveAs(blob, fileName);
      return true;
    } catch (error) {
      console.error('Backup failed:', error);
      throw new Error('Không thể sao lưu dữ liệu.');
    }
  },

  // 2. Khôi phục dữ liệu
  async restoreData(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const importData = JSON.parse(content);
          
          // Validate cơ bản
          if (!importData.metadata || importData.metadata.appName !== 'ExamHelper') {
            throw new Error('File không hợp lệ hoặc không phải file backup của Exam Helper.');
          }

          const { banks, questions, exams, examSeeds } = importData.data;

          // Sử dụng Transaction để đảm bảo toàn vẹn dữ liệu
          await db.transaction('rw', db.banks, db.questions, db.exams, db.examSeeds, async () => {
            // Chiến lược: Merge (Upsert) - Nếu ID trùng thì ghi đè, chưa có thì thêm mới
            // Nếu muốn Wipe-and-Replace (Xóa hết cũ thay bằng mới) thì dùng db.table.clear() trước.
            // Ở đây tôi chọn Merge để an toàn.

            if (banks?.length) await db.banks.bulkPut(banks);
            if (questions?.length) await db.questions.bulkPut(questions);
            if (exams?.length) await db.exams.bulkPut(exams);
            if (examSeeds?.length) await db.examSeeds.bulkPut(examSeeds);
          });

          resolve();
        } catch (err) {
          console.error('Restore failed:', err);
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Lỗi đọc file.'));
      reader.readAsText(file);
    });
  }
};

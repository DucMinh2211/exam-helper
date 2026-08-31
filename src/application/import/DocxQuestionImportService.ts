import { ParserRegistry } from '../../core/import/parsers/ParserRegistry';
import { TrailingAnswerKeyParser } from '../../core/import/parsers/TrailingAnswerKeyParser';
import { DocxReader } from '../../infrastructure/document/docx/DocxReader';
import type { NewQuestion } from '../../core/entities/Question';
import type { QuestionReviewItem } from '../../core/import/review/QuestionImportReview';
import { canImportReview } from '../../core/import/review/QuestionImportReview';
import { QuestionRepository } from '../../data/repositories/QuestionRepository';

export const DOCX_MAX_FILE_SIZE = 20 * 1024 * 1024;

const registry = new ParserRegistry().register(new TrailingAnswerKeyParser());

export type DocxImportStage = 'reading' | 'detecting' | 'parsing' | 'validating';

export const DocxQuestionImportService = {
  validateFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.docx')) throw new Error('Chỉ chấp nhận file .docx.');
    if (file.size > DOCX_MAX_FILE_SIZE) throw new Error('File DOCX không được vượt quá 20 MB.');
    if (!file.size) throw new Error('File DOCX đang trống.');
  },

  async preview(file: File, onStage?: (stage: DocxImportStage) => void) {
    this.validateFile(file);
    onStage?.('reading');
    const document = await DocxReader.read(file);
    onStage?.('detecting');
    const selected = registry.select(document);
    if (!selected || selected.detection.confidence < 0.35) {
      throw new Error('Không nhận diện được format ngân hàng câu hỏi trong DOCX.');
    }
    onStage?.('parsing');
    const result = selected.parser.parse(document);
    onStage?.('validating');
    return result;
  },

  async importConfirmed(bankId: string, items: QuestionReviewItem[]) {
    if (!bankId) throw new Error('Không xác định được ngân hàng đích.');
    if (!canImportReview(items)) throw new Error('Phiên review vẫn còn mục chưa được xử lý.');

    const questions = items
      .filter((item) => item.decision === 'confirmed')
      .map((item): NewQuestion => {
        const data = item.question;
        const tags = [data.topic, data.lesson, data.section].filter((tag): tag is string => Boolean(tag));
        const base = {
          bankId,
          title: `Câu ${data.number}`,
          content: data.content.trim(),
          tags,
        };
        if (data.type === 'MULTIPLE_CHOICE' && typeof data.answer === 'number') {
          return { ...base, type: 'MULTIPLE_CHOICE', choices: data.choices.map((choice) => choice.trim()), answer: data.answer };
        }
        if (data.type === 'TRUE_FALSE' && Array.isArray(data.answer)
          && data.answer.every((answer) => typeof answer === 'boolean')) {
          return { ...base, type: 'TRUE_FALSE', choices: data.choices.map((choice) => choice.trim()), answers: data.answer as boolean[] };
        }
        throw new Error(`Câu ${data.number} có dữ liệu đáp án không hợp lệ.`);
      });

    return QuestionRepository.importMany(questions);
  },
};

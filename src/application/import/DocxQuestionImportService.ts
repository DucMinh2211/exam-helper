import { ParserRegistry } from '../../core/import/parsers/ParserRegistry';
import { TrailingAnswerKeyParser } from '../../core/import/parsers/TrailingAnswerKeyParser';
import { DocxReader } from '../../infrastructure/document/docx/DocxReader';

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
};

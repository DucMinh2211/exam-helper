import type { DocumentModel } from '../models/DocumentModel';
import type { ParserDetection, QuestionDocumentParser, QuestionParseResult } from './QuestionDocumentParser';

export interface ParserSelection {
  parser: QuestionDocumentParser;
  detection: ParserDetection;
}

export class ParserRegistry {
  private readonly parsers = new Map<string, QuestionDocumentParser>();

  register(parser: QuestionDocumentParser): this {
    if (this.parsers.has(parser.id)) throw new Error(`Parser đã tồn tại: ${parser.id}`);
    this.parsers.set(parser.id, parser);
    return this;
  }

  select(document: DocumentModel): ParserSelection | null {
    let selected: ParserSelection | null = null;
    for (const parser of this.parsers.values()) {
      const detection = parser.detect(document);
      if (!selected || detection.confidence > selected.detection.confidence) {
        selected = { parser, detection };
      }
    }
    return selected;
  }

  parse(document: DocumentModel, minimumConfidence = 0.35): QuestionParseResult {
    const selected = this.select(document);
    if (!selected || selected.detection.confidence < minimumConfidence) {
      throw new Error('Không nhận diện được format ngân hàng câu hỏi trong DOCX.');
    }
    return selected.parser.parse(document);
  }
}

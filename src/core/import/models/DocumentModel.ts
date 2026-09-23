export interface SourceRange {
  blockStart: number;
  blockEnd: number;
}

export interface TextRange {
  paragraph: number;
  start: number;
  end: number;
}

export interface DocumentLine {
  text: string;
  range: TextRange;
  marked: Array<{ start: number; end: number }>;
  automaticLabel?: string;
}

interface DocumentBlockBase {
  index: number;
  rawText: string;
  lines?: DocumentLine[];
}

export interface ParagraphBlock extends DocumentBlockBase {
  type: 'paragraph';
  text: string;
}

export interface TableBlock extends DocumentBlockBase {
  cellLines?: DocumentLine[][][];
  type: 'table';
  rows: string[][];
}

export type DocumentBlock = ParagraphBlock | TableBlock;

/** Format-neutral document representation consumed by question parsers. */
export interface DocumentModel {
  blocks: DocumentBlock[];
}

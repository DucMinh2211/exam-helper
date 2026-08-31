export interface SourceRange {
  blockStart: number;
  blockEnd: number;
}

interface DocumentBlockBase {
  index: number;
  rawText: string;
}

export interface ParagraphBlock extends DocumentBlockBase {
  type: 'paragraph';
  text: string;
}

export interface TableBlock extends DocumentBlockBase {
  type: 'table';
  rows: string[][];
}

export type DocumentBlock = ParagraphBlock | TableBlock;

/** Format-neutral document representation consumed by question parsers. */
export interface DocumentModel {
  blocks: DocumentBlock[];
}

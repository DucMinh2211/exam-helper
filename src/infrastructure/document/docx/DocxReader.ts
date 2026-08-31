import JSZip from 'jszip';
import type { DocumentBlock, DocumentModel } from '../../../core/import/models/DocumentModel';

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function textFromParagraph(paragraph: Element): string {
  let text = '';

  for (const node of paragraph.getElementsByTagNameNS(WORD_NAMESPACE, '*')) {
    if (node.localName === 't') text += node.textContent ?? '';
    if (node.localName === 'tab') text += '\t';
    if (node.localName === 'br' || node.localName === 'cr') text += '\n';
  }

  return text;
}

function directChildren(element: Element, localName: string): Element[] {
  return Array.from(element.children).filter((child) => child.localName === localName);
}

function tableRows(table: Element): string[][] {
  return directChildren(table, 'tr').map((row) =>
    directChildren(row, 'tc').map((cell) =>
      directChildren(cell, 'p')
        .map(textFromParagraph)
        .filter(Boolean)
        .join('\n'),
    ),
  );
}

export class DocxReader {
  static async read(file: Blob | ArrayBuffer | Uint8Array): Promise<DocumentModel> {
    // `instanceof ArrayBuffer` is unreliable across browser/jsdom realms.
    const input = typeof (file as Blob).arrayBuffer === 'function'
      ? await (file as Blob).arrayBuffer()
      : file as ArrayBuffer | Uint8Array;
    const zip = await JSZip.loadAsync(input);
    const documentEntry = zip.file('word/document.xml');

    if (!documentEntry) throw new Error('DOCX không chứa word/document.xml.');

    const xml = await documentEntry.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    const parserError = document.querySelector('parsererror');
    if (parserError) throw new Error('Không thể đọc cấu trúc XML của DOCX.');

    const body = document.getElementsByTagNameNS(WORD_NAMESPACE, 'body')[0];
    if (!body) throw new Error('DOCX không có nội dung tài liệu.');

    const blocks: DocumentBlock[] = [];
    for (const child of Array.from(body.children)) {
      const index = blocks.length;
      if (child.localName === 'p') {
        const text = textFromParagraph(child);
        blocks.push({ type: 'paragraph', index, text, rawText: text });
      } else if (child.localName === 'tbl') {
        const rows = tableRows(child);
        blocks.push({
          type: 'table',
          index,
          rows,
          rawText: rows.map((row) => row.join(' | ')).join('\n'),
        });
      }
    }

    return { blocks };
  }
}

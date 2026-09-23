import JSZip from 'jszip';
import type { DocumentBlock, DocumentModel, DocumentLine } from '../../../core/import/models/DocumentModel';

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export function isRed(value: string): boolean {
  if (!/^[\da-f]{6}$/i.test(value)) return false;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return r >= 160 && r > g * 1.6 && r > b * 1.6;
}

const val = (element: Element | undefined, name: string) =>
  element?.getElementsByTagNameNS(WORD_NAMESPACE, name)[0]?.getAttributeNS(WORD_NAMESPACE, 'val') ?? '';

function textFromParagraph(paragraph: Element): string {
  let text = '';

  for (const node of paragraph.getElementsByTagNameNS(WORD_NAMESPACE, '*')) {
    if (node.parentElement?.localName !== 'r') continue;
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
    const stylesXml = await zip.file('word/styles.xml')?.async('string');
    const styles = new DOMParser().parseFromString(stylesXml ?? '<styles/>', 'application/xml');
    const styleMap = new Map(Array.from(styles.getElementsByTagNameNS(WORD_NAMESPACE, 'style'))
      .map((style) => [style.getAttributeNS(WORD_NAMESPACE, 'styleId'), style]));
    const property = (styleId: string, name: string, seen = new Set<string>()): string => {
      if (!styleId || seen.has(styleId)) return '';
      seen.add(styleId);
      const style = styleMap.get(styleId);
      return val(style, name) || property(val(style, 'basedOn'), name, seen);
    };
    const numberingXml = await zip.file('word/numbering.xml')?.async('string');
    const numbering = new DOMParser().parseFromString(numberingXml ?? '<numbering/>', 'application/xml');
    const nums = new Map(Array.from(numbering.getElementsByTagNameNS(WORD_NAMESPACE, 'num')).map((entry) => [entry.getAttributeNS(WORD_NAMESPACE, 'numId'), entry]));
    const abstracts = new Map(Array.from(numbering.getElementsByTagNameNS(WORD_NAMESPACE, 'abstractNum')).map((entry) => [entry.getAttributeNS(WORD_NAMESPACE, 'abstractNumId'), entry]));
    const counters = new Map<string, number>();
    const paragraphs = Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, 'p'));
    const paragraphLines = new Map<Element, DocumentLine[]>();
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const text = textFromParagraph(paragraph);
      const marked: DocumentLine['marked'] = [];
      let offset = 0;
      for (const run of paragraph.getElementsByTagNameNS(WORD_NAMESPACE, 'r')) {
        const runText = textFromParagraph(run);
        const rPr = directChildren(run, 'rPr')[0];
        const styleId = val(rPr, 'rStyle');
        const pStyle = val(directChildren(paragraph, 'pPr')[0], 'pStyle');
        const color = val(rPr, 'color') || property(styleId, 'color') || property(pStyle, 'color');
        const underlineNode = rPr?.getElementsByTagNameNS(WORD_NAMESPACE, 'u')[0];
        const underline = underlineNode ? (underlineNode.getAttributeNS(WORD_NAMESPACE, 'val') || 'single')
          : property(styleId, 'u') || property(pStyle, 'u');
        if (runText.trim() && (isRed(color) || (underline && !['none', '0', 'false'].includes(underline)))) {
          marked.push({ start: offset, end: offset + runText.length });
        }
        offset += runText.length;
      }
      let automaticLabel: string | undefined;
      const numId = val(directChildren(paragraph, 'pPr')[0], 'numId');
      const level = val(directChildren(paragraph, 'pPr')[0], 'ilvl') || '0';
      const num = nums.get(numId);
      const abstractId = val(num, 'abstractNumId');
      const abstract = abstracts.get(abstractId);
      const lvl = Array.from(abstract?.getElementsByTagNameNS(WORD_NAMESPACE, 'lvl') ?? [])
        .find((entry) => entry.getAttributeNS(WORD_NAMESPACE, 'ilvl') === level);
      const format = val(lvl, 'numFmt');
      if (numId && ['upperLetter', 'lowerLetter'].includes(format)) {
        const key = `${numId}:${level}`;
        const override = Array.from(num?.getElementsByTagNameNS(WORD_NAMESPACE, 'lvlOverride') ?? [])
          .find((entry) => entry.getAttributeNS(WORD_NAMESPACE, 'ilvl') === level);
        const count = counters.get(key) ?? Number(val(override, 'startOverride') || val(lvl, 'start') || 1);
        counters.set(key, count + 1);
        automaticLabel = String.fromCharCode((format === 'upperLetter' ? 65 : 97) + count - 1);
      }
      let start = 0;
      const lines = text.split('\n').map((line) => {
        const result: DocumentLine = { text: line, range: { paragraph: paragraphIndex, start, end: start + line.length }, marked, automaticLabel };
        start += line.length + 1;
        return result;
      });
      paragraphLines.set(paragraph, lines);
    });
    for (const child of Array.from(body.children)) {
      const index = blocks.length;
      if (child.localName === 'p') {
        const text = textFromParagraph(child);
        blocks.push({ type: 'paragraph', index, text, rawText: text, lines: paragraphLines.get(child) });
      } else if (child.localName === 'tbl') {
        const rows = tableRows(child);
        blocks.push({
          type: 'table',
          index,
          rows,
          cellLines: directChildren(child, 'tr').map((row) => directChildren(row, 'tc').map((cell) =>
            directChildren(cell, 'p').flatMap((p) => paragraphLines.get(p) ?? []))),
          lines: Array.from(child.getElementsByTagNameNS(WORD_NAMESPACE, 'p')).flatMap((p) => paragraphLines.get(p) ?? []),
          rawText: rows.map((row) => row.join(' | ')).join('\n'),
        });
      }
    }

    return { blocks };
  }
}

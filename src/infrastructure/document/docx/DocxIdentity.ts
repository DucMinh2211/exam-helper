import type JSZip from 'jszip';
import type { ParsedQuestion } from '../../../core/import/parsers/QuestionDocumentParser';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/package/2006/relationships';
const PART = 'customXml/exam-helper.xml';
export interface DocxIdentity { bankId: string; sourceId: string }
const all = (node: Element | Document, name: string) => Array.from(node.getElementsByTagNameNS(W, name));
const nameFor = (id: string) => `EH_${id.replace(/[^a-z0-9]/gi, '').slice(0, 36)}`;

/** Word bookmarks move with their question when text is edited or reordered. */
export function createIdentityWriter(doc: XMLDocument) {
  const old = new Set(all(doc, 'bookmarkStart').filter(n => n.getAttributeNS(W, 'name')?.startsWith('EH_')).map(n => n.getAttributeNS(W, 'id')));
  for (const node of [...all(doc, 'bookmarkStart'), ...all(doc, 'bookmarkEnd')]) if (old.has(node.getAttributeNS(W, 'id'))) node.remove();
  let nextId = Math.max(0, ...all(doc, 'bookmarkStart').map(n => Number(n.getAttributeNS(W, 'id')) || 0)) + 1;
  const mappings = new Map<string, string>();
  return {
    mappings,
    add(paragraph: Element, offset: number, questionId: string) {
      const name = nameFor(questionId);
      if (mappings.has(name)) throw new Error('Trùng định danh câu hỏi trong file xuất.');
      mappings.set(name, questionId);
      let position = 0;
      let anchor: Element | undefined;
      for (const node of all(paragraph, '*')) {
        if (node.parentElement?.localName !== 'r' || !['t', 'tab', 'br', 'cr'].includes(node.localName)) continue;
        const value = node.localName === 't' ? node.textContent ?? '' : '\n';
        if (position + value.length > offset || position === offset) {
          const run = node.parentElement!;
          const before = run.cloneNode(false) as Element;
          const properties = Array.from(run.children).find(n => n.localName === 'rPr');
          if (properties) before.append(properties.cloneNode(true));
          for (const child of Array.from(run.childNodes)) {
            if (child === node) break;
            if (child !== properties) before.append(child);
          }
          const split = Math.max(0, offset - position);
          if (split && node.localName === 't') {
            const prefix = node.cloneNode(true) as Element;
            prefix.textContent = value.slice(0, split); prefix.setAttribute('xml:space', 'preserve');
            before.append(prefix); node.textContent = value.slice(split); node.setAttribute('xml:space', 'preserve');
          }
          if (before.childNodes.length > (properties ? 1 : 0)) run.before(before);
          anchor = run; break;
        }
        position += value.length;
      }
      const start = doc.createElementNS(W, 'w:bookmarkStart');
      const end = doc.createElementNS(W, 'w:bookmarkEnd');
      start.setAttributeNS(W, 'w:id', String(nextId)); start.setAttributeNS(W, 'w:name', name);
      end.setAttributeNS(W, 'w:id', String(nextId++));
      if (anchor) anchor.before(start, end); else paragraph.append(start, end);
    },
  };
}

export async function writeDocxIdentity(zip: JSZip, identity: DocxIdentity, mappings: Map<string, string>) {
  const doc = new DOMParser().parseFromString('<identity xmlns="urn:exam-helper:docx:1"/>', 'application/xml');
  doc.documentElement.setAttribute('bankId', identity.bankId);
  doc.documentElement.setAttribute('sourceId', identity.sourceId);
  for (const [bookmark, id] of mappings) {
    const node = doc.createElementNS('urn:exam-helper:docx:1', 'question');
    node.setAttribute('bookmark', bookmark); node.setAttribute('id', id); doc.documentElement.append(node);
  }
  zip.file(PART, new XMLSerializer().serializeToString(doc));
  const relPath = 'word/_rels/document.xml.rels';
  const relDoc = new DOMParser().parseFromString(await zip.file(relPath)?.async('string') ?? `<Relationships xmlns="${R}"/>`, 'application/xml');
  if (!Array.from(relDoc.documentElement.children).some(n => n.getAttribute('Target') === '../customXml/exam-helper.xml')) {
    const relation = relDoc.createElementNS(R, 'Relationship');
    let id = 'rIdExamHelper';
    while (Array.from(relDoc.documentElement.children).some(n => n.getAttribute('Id') === id)) id += '_';
    relation.setAttribute('Id', id); relation.setAttribute('Target', '../customXml/exam-helper.xml');
    relation.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml');
    relDoc.documentElement.append(relation);
  }
  zip.file(relPath, new XMLSerializer().serializeToString(relDoc));
  const content = zip.file('[Content_Types].xml');
  if (content) {
    const types = new DOMParser().parseFromString(await content.async('string'), 'application/xml');
    if (!Array.from(types.documentElement.children).some(n => n.getAttribute('PartName') === `/${PART}`)) {
      const node = types.createElementNS(types.documentElement.namespaceURI, 'Override');
      node.setAttribute('PartName', `/${PART}`); node.setAttribute('ContentType', 'application/xml'); types.documentElement.append(node);
    }
    zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(types));
  }
}

export async function readDocxIdentity(zip: JSZip, questions: ParsedQuestion[]): Promise<DocxIdentity | undefined> {
  const meta = zip.file(PART);
  if (!meta) return undefined;
  const metadata = new DOMParser().parseFromString(await meta.async('string'), 'application/xml');
  const root = metadata.documentElement;
  const bankId = root.getAttribute('bankId'), sourceId = root.getAttribute('sourceId');
  if (root.namespaceURI !== 'urn:exam-helper:docx:1' || !bankId || !sourceId) return undefined;
  const ids = new Map(Array.from(root.children).map(n => [n.getAttribute('bookmark'), n.getAttribute('id')]));
  const doc = new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'), 'application/xml');
  all(doc, 'p').forEach((p, paragraph) => {
    let offset = 0;
    for (const node of all(p, '*')) {
      if (node.localName === 'bookmarkStart') {
        const id = ids.get(node.getAttributeNS(W, 'name'));
        const question = questions.find(q => q.fields?.title.some(range => range.paragraph === paragraph && offset >= range.start && offset <= range.end));
        if (id && question) question.documentQuestionId = id;
      }
      if (node.parentElement?.localName === 'r') {
        if (node.localName === 't') offset += (node.textContent ?? '').length;
        else if (['tab', 'br', 'cr'].includes(node.localName)) offset++;
      }
    }
  });
  return { bankId, sourceId };
}

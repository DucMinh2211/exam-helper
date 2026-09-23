import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { BankDocxSource } from '../../../core/entities/Bank';
import type { Question, MCQuestion, TFQuestion, EssayQuestion } from '../../../core/entities/Question';
import type { TextRange } from '../../../core/import/models/DocumentModel';
import { isRed } from './DocxReader';
import { createIdentityWriter, writeDocxIdentity, type DocxIdentity } from './DocxIdentity';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const elements = (parent: Element, name: string) => Array.from(parent.getElementsByTagNameNS(W, name));
const choicesOf = (q: Question): string[] => q.type === 'ESSAY' ? [] : (q as MCQuestion | TFQuestion).choices;
const answerOf = (q: Question) => q.type === 'TRUE_FALSE' ? (q as TFQuestion).answers : (q as MCQuestion | EssayQuestion).answer;
const tagLine = (tags: string[]) => `Tags: ${tags.some(tag => /[,;\n\r]/.test(tag)) ? JSON.stringify(tags) : tags.join(', ')}`;

function setText(node: Element, value: string) {
  const parts = value.split(/\r?\n/);
  node.textContent = parts[0]; node.setAttribute('xml:space', 'preserve');
  let tail = node;
  for (const part of parts.slice(1)) {
    const br = node.ownerDocument.createElementNS(W, 'w:br');
    const text = node.cloneNode(false) as Element; text.textContent = part;
    tail.after(br, text); tail = text;
  }
}

// Offsets use the same text/tab/break stream as DocxReader, never serialized XML positions.
function textNodes(paragraph: Element) {
  let offset = 0;
  return elements(paragraph, '*').filter((node) => node.parentElement?.localName === 'r' && ['t', 'tab', 'br', 'cr'].includes(node.localName)).map((node) => {
    const text = node.localName === 't' ? node.textContent ?? '' : node.localName === 'tab' ? '\t' : '\n';
    const entry = { node, start: offset, end: offset + text.length, text };
    offset = entry.end;
    return entry;
  });
}

function replaceText(paragraph: Element, start: number, end: number, value: string) {
  const nodes = textNodes(paragraph);
  const affected = nodes.filter((entry) => entry.end > start && entry.start < end);
  if (!affected.length) {
    const anchor = nodes.find((entry) => entry.node.localName === 't' && entry.start <= start && entry.end >= start);
    if (anchor) {
      setText(anchor.node, anchor.text.slice(0, start - anchor.start) + value + anchor.text.slice(start - anchor.start));
    } else if (value) {
      const run = paragraph.ownerDocument.createElementNS(W, 'w:r');
      const t = paragraph.ownerDocument.createElementNS(W, 'w:t');
      t.textContent = value; t.setAttribute('xml:space', 'preserve'); run.append(t); paragraph.append(run);
    }
    return;
  }
  affected.forEach((entry, index) => {
    const text = entry.text.slice(0, Math.max(0, start - entry.start)) + (index === 0 ? value : '')
      + entry.text.slice(Math.min(entry.text.length, end - entry.start));
    if (entry.node.localName === 't') {
      setText(entry.node, text);
    } else {
      const t = paragraph.ownerDocument.createElementNS(W, 'w:t');
      t.textContent = text; t.setAttribute('xml:space', 'preserve'); entry.node.replaceWith(t);
    }
  });
}

function runProperty(run: Element, name: string, value: string) {
  const doc = run.ownerDocument;
  let props = Array.from(run.children).find((child) => child.localName === 'rPr');
  if (!props) { props = doc.createElementNS(W, 'w:rPr'); run.prepend(props); }
  let property = elements(props, name)[0];
  if (!property) { property = doc.createElementNS(W, `w:${name}`); props.append(property); }
  property.setAttributeNS(W, 'w:val', value);
  if (name === 'color') for (const attr of ['themeColor', 'themeTint', 'themeShade']) property.removeAttributeNS(W, attr);
}

// Split only the text node being marked. Retain run properties, links and surrounding objects.
function markRange(paragraph: Element, start: number, end: number, correct: boolean) {
  for (const entry of textNodes(paragraph)) {
    if (entry.node.localName !== 't' || entry.end <= start || entry.start >= end) continue;
    const run = entry.node.parentElement;
    if (!run || run.localName !== 'r') continue;
    const from = Math.max(0, start - entry.start), to = Math.min(entry.text.length, end - entry.start);
    const before = run.cloneNode(false) as Element;
    const after = run.cloneNode(false) as Element;
    const props = Array.from(run.children).find((child) => child.localName === 'rPr');
    if (props) { before.append(props.cloneNode(true)); after.append(props.cloneNode(true)); }
    let passed = false;
    for (const child of Array.from(run.childNodes)) {
      if (child === props) continue;
      if (child === entry.node) { passed = true; continue; }
      (passed ? after : before).append(child);
    }
    const addText = (target: Element, text: string) => {
      if (!text) return;
      const t = entry.node.cloneNode(false) as Element; t.textContent = text; t.setAttribute('xml:space', 'preserve'); target.append(t);
    };
    addText(before, entry.text.slice(0, from));
    const suffix = entry.node.cloneNode(false) as Element;
    suffix.textContent = entry.text.slice(to); suffix.setAttribute('xml:space', 'preserve');
    after.insertBefore(suffix, props ? after.children[1] ?? null : after.firstChild);
    entry.node.textContent = entry.text.slice(from, to); entry.node.setAttribute('xml:space', 'preserve');
    run.before(before); run.after(after);
    runProperty(run, 'u', correct ? 'single' : 'none');
    const color = elements(run, 'color')[0]?.getAttributeNS(W, 'val') ?? '';
    if (correct || isRed(color) || !color) runProperty(run, 'color', correct ? 'FF0000' : '000000');
  }
}

interface Edit extends TextRange { value: string }

export async function exportSourceDocx(source: BankDocxSource, questions: Question[], additions: Question[] = [], identity?: DocxIdentity): Promise<Uint8Array> {
  const originalBytes = Uint8Array.from(atob(source.base64), (char) => char.charCodeAt(0));
  const zip = await JSZip.loadAsync(originalBytes);
  const xml = await zip.file('word/document.xml')!.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const identityWriter = identity ? createIdentityWriter(doc) : undefined;
  const paragraphs = elements(body, 'p');
  const blocks = Array.from(body.children).filter((child) => ['p', 'tbl'].includes(child.localName));
  const current = new Map(questions.map((q) => [q.id, q]));
  const edits: Edit[] = [];
  let changed = false;
  const removed = new Set<number>();
  const removeQuestion = (original: BankDocxSource['questions'][number]['original']) => {
    const shared = source.questions.some((entry) => entry.original !== original
      && entry.original.source.blockStart <= original.source.blockEnd && entry.original.source.blockEnd >= original.source.blockStart);
    if (!shared) {
      for (let index = original.source.blockStart; index <= original.source.blockEnd; index++) removed.add(index);
      return;
    }
    const fields = original.fields;
    if (!fields) return;
    const byParagraph = new Map<number, TextRange[]>();
    for (const range of [...fields.title, ...fields.content, ...fields.choices.flat(), ...fields.labels.flat(), ...(original.tagFields ?? [])]) {
      byParagraph.set(range.paragraph, [...(byParagraph.get(range.paragraph) ?? []), range]);
    }
    for (const [paragraph, ranges] of byParagraph) {
      edits.push({ paragraph, start: Math.min(...ranges.map(r => r.start)), end: Math.max(...ranges.map(r => r.end)), value: '' });
    }
  };
  const replaceField = (ranges: TextRange[] | undefined, value: string, old: string) => {
    if (value === old || !ranges?.length) return;
    changed = true;
    // Preserve unchanged prefix/suffix, including formatting of all unaffected runs.
    const actual = ranges.map((range) => textNodes(paragraphs[range.paragraph]).map((n) => n.text).join('').slice(range.start, range.end)).join(' ');
    if (normalize(actual) === normalize(value)) return;
    if (ranges.length === 1) {
      let prefix = 0, suffix = 0;
      while (prefix < actual.length && prefix < value.length && actual[prefix] === value[prefix]) prefix++;
      while (suffix < actual.length - prefix && suffix < value.length - prefix && actual[actual.length - suffix - 1] === value[value.length - suffix - 1]) suffix++;
      edits.push({ ...ranges[0], start: ranges[0].start + prefix, end: ranges[0].end - suffix, value: value.slice(prefix, value.length - suffix) });
    } else {
      // Map normalized Bank text back to individual source paragraphs. Appending a
      // sentence must not collapse a multi-paragraph passage into its first line.
      let globalOffset = 0;
      const segments = ranges.map((range) => {
        const text = textNodes(paragraphs[range.paragraph]).map(n => n.text).join('').slice(range.start, range.end);
        const positions: Array<{ start: number; end: number }> = [];
        let normalized = '';
        for (const token of text.matchAll(/\s+|\S/g)) {
          normalized += /^\s/.test(token[0]) ? ' ' : token[0];
          positions.push({ start: range.start + token.index!, end: range.start + token.index! + token[0].length });
        }
        const segment = { range, positions, start: globalOffset, text: normalized };
        globalOffset += normalized.length + 1;
        return segment;
      });
      const normalized = segments.map(s => s.text).join(' ');
      let prefix = 0, suffix = 0;
      while (prefix < normalized.length && prefix < value.length && normalized[prefix] === value[prefix]) prefix++;
      while (suffix < normalized.length - prefix && suffix < value.length - prefix && normalized[normalized.length - suffix - 1] === value[value.length - suffix - 1]) suffix++;
      const end = normalized.length - suffix;
      let inserted = false;
      for (const segment of segments) {
        if (segment.start + segment.text.length < prefix || segment.start > end) continue;
        const from = Math.max(0, prefix - segment.start), to = Math.min(segment.text.length, end - segment.start);
        const start = segment.positions[from]?.start ?? segment.range.end;
        const stop = to > from ? segment.positions[to - 1].end : start;
        edits.push({ ...segment.range, start, end: stop, value: inserted ? '' : value.slice(prefix, value.length - suffix) });
        inserted = true;
      }
    }
  };
  for (const entry of source.questions) {
    const q = entry.questionId ? current.get(entry.questionId) : undefined;
    const original = entry.original;
    if (!q) {
      changed = true;
      removeQuestion(original);
      // Remove stale answer-key entries as well.
      [...(original.answerFields ?? []), ...(original.answerNumberFields ?? [])].forEach((range) => { if (range) edits.push({ ...range, value: '' }); });
      continue;
    }
    const fields = original.fields;
    if (!fields) throw new Error('Nguồn DOCX thiếu vị trí nội dung. Hãy import lại file gốc.');
    const edited = q.content !== original.content || q.title !== `Câu ${original.number}`
      || JSON.stringify(choicesOf(q)) !== JSON.stringify(original.choices)
      || JSON.stringify(answerOf(q)) !== JSON.stringify(original.answer);
    const originalTags = original.tags ?? [original.topic, original.lesson, original.section, original.level].filter((tag): tag is string => Boolean(tag));
    const tagsChanged = JSON.stringify(q.tags) !== JSON.stringify([...new Set(originalTags)]);
    const needsRepair = fields.choices.some((ranges) => !ranges.length)
      || fields.labels.some((ranges) => ranges.length > 1);
    if (q.type !== original.type || choicesOf(q).length !== original.choices.length || (edited && needsRepair)) {
      // Structural edits are replaced in place using the original first paragraph as a style template.
      changed = true;
      const first = paragraphs[fields.title[0].paragraph];
      const generated = plainQuestionParagraphs(doc, q);
      identityWriter?.add(generated[0], 0, q.id);
      const style = Array.from(first.children).find((child) => child.localName === 'pPr');
      if (style) generated.forEach((paragraph) => paragraph.prepend(style.cloneNode(true)));
      first.before(...generated);
      removeQuestion(original);
      [...(original.answerFields ?? []), ...(original.answerNumberFields ?? [])].forEach((range) => { if (range) edits.push({ ...range, value: '' }); });
      continue;
    }
    identityWriter?.add(paragraphs[fields.title[0].paragraph], fields.title[0].start, q.id);
    if (edited || tagsChanged || identity) {
      changed = true;
      if (original.tagFields?.length) {
        original.tagFields.forEach((range, index) => edits.push({ ...range, value: index ? '' : tagLine(q.tags) }));
      } else {
        const ranges = [...fields.title, ...fields.content, ...fields.choices.flat(), ...fields.labels.flat()];
        const last = ranges.sort((a, b) => b.paragraph - a.paragraph || b.end - a.end)[0];
        const anchor = paragraphs[last.paragraph];
        const remaining = textNodes(anchor).map(n => n.text).join('').slice(last.end);
        if (remaining.trim() && !/^\s*\((?:Đ|S|Đúng|Sai)\)\s*[.]?\s*$/i.test(remaining)) {
          edits.push({ ...last, start: last.end, value: `\n${tagLine(q.tags)}\n` });
        } else {
          const paragraph = doc.createElementNS(W, 'w:p');
          const run = doc.createElementNS(W, 'w:r');
          const text = doc.createElementNS(W, 'w:t'); text.textContent = tagLine(q.tags);
          run.append(text); paragraph.append(run); anchor.after(paragraph);
        }
      }
    }
    replaceField(fields.title, q.title, `Câu ${original.number}`);
    const newNumber = q.title.match(/^Câu\s+(\d+)$/i)?.[1];
    if (newNumber && Number(newNumber) !== original.number) original.answerNumberFields?.forEach((range) => edits.push({ ...range, value: newNumber }));
    replaceField(fields.content, q.content, original.content);
    choicesOf(q).forEach((choice, index) => replaceField(fields.choices[index], choice, original.choices[index]));
    const answer = answerOf(q);
    if (JSON.stringify(answer) !== JSON.stringify(original.answer)
      || choicesOf(q).some((choice, index) => choice !== original.choices[index] && (typeof answer === 'number' ? answer === index : Array.isArray(answer) && answer[index]))) {
      changed = true;
      choicesOf(q).forEach((_, index) => {
        const correct = typeof answer === 'number' ? index === answer : Array.isArray(answer) && answer[index];
        for (const range of [...fields.labels[index], ...fields.choices[index]]) markRange(paragraphs[range.paragraph], range.start, range.end, Boolean(correct));
      });
      original.answerFields?.forEach((range, index) => { if (range) edits.push({ ...range,
        value: typeof answer === 'number' ? String.fromCharCode(65 + answer) : Array.isArray(answer) ? (answer[index] ? 'Đ' : 'S') : '',
      }); });
      if (q.type === 'TRUE_FALSE' && Array.isArray(answer)) {
        fields.choices.forEach((ranges, index) => {
          if (original.answerFields?.[index]) return;
          const last = ranges.at(-1);
          if (last) edits.push({ ...last, start: last.end, value: ` (${answer[index] ? 'Đ' : 'S'})` });
        });
      }
    }
  }
  edits.sort((a, b) => b.paragraph - a.paragraph || b.start - a.start).forEach((edit) => replaceText(paragraphs[edit.paragraph], edit.start, edit.end, edit.value));
  for (const index of removed) blocks[index]?.remove();
  if (additions.length) {
    changed = true;
    const section = Array.from(body.children).find((child) => child.localName === 'sectPr');
    for (const q of additions) {
      const generated = plainQuestionParagraphs(doc, q);
      identityWriter?.add(generated[0], 0, q.id);
      for (const paragraph of generated) body.insertBefore(paragraph, section ?? null);
    }
  }
  if (!changed && !identity) return originalBytes;
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  if (identity && identityWriter) await writeDocxIdentity(zip, identity, identityWriter.mappings);
  return zip.generateAsync({ type: 'uint8array' });
}

function plainQuestionParagraphs(doc: XMLDocument, q: Question): Element[] {
  const lines = [`${q.title}. ${q.content}`, ...choicesOf(q).map((choice, i) => `${String.fromCharCode(q.type === 'TRUE_FALSE' ? 97 + i : 65 + i)}. ${choice}${q.type === 'TRUE_FALSE' ? ` (${(q as TFQuestion).answers[i] ? 'Đ' : 'S'})` : ''}`)];
  if (q.type === 'ESSAY' && (q as EssayQuestion).answer) lines.push(`Đáp án: ${(q as EssayQuestion).answer}`);
  lines.push(tagLine(q.tags));
  return lines.map((line, index) => {
    const paragraph = doc.createElementNS(W, 'w:p');
    const run = doc.createElementNS(W, 'w:r');
    const text = doc.createElementNS(W, 'w:t'); text.textContent = line; text.setAttribute('xml:space', 'preserve'); run.append(text); paragraph.append(run);
    const answer = answerOf(q);
    if (index > 0 && index <= choicesOf(q).length && (typeof answer === 'number' ? answer === index - 1 : Array.isArray(answer) && answer[index - 1])) {
      runProperty(run, 'color', 'FF0000'); runProperty(run, 'u', 'single');
    }
    return paragraph;
  });
}

export async function exportNewDocx(name: string, questions: Question[], identity?: DocxIdentity): Promise<Uint8Array> {
  const children = [new Paragraph({ children: [new TextRun({ text: name, bold: true })] })];
  const starts: Array<{ paragraph: number; id: string }> = [];
  for (const q of questions) {
    starts.push({ paragraph: children.length, id: q.id });
    children.push(new Paragraph(`${q.title}. ${q.content}`));
    choicesOf(q).forEach((choice, index) => {
      const answer = answerOf(q);
      const correct = typeof answer === 'number' ? answer === index : Array.isArray(answer) && answer[index];
      children.push(new Paragraph({ children: [new TextRun({ text: `${String.fromCharCode(q.type === 'TRUE_FALSE' ? 97 + index : 65 + index)}. ${choice}${q.type === 'TRUE_FALSE' ? ` (${correct ? 'Đ' : 'S'})` : ''}`, color: correct ? 'FF0000' : undefined, underline: correct ? {} : undefined })] }));
    });
    if (q.type === 'ESSAY' && (q as EssayQuestion).answer) children.push(new Paragraph(`Đáp án: ${(q as EssayQuestion).answer}`));
    children.push(new Paragraph(tagLine(q.tags)));
  }
  const bytes = new Uint8Array(await Packer.toArrayBuffer(new Document({ sections: [{ children }] })));
  if (!identity) return bytes;
  const zip = await JSZip.loadAsync(bytes);
  const doc = new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'), 'application/xml');
  const writer = createIdentityWriter(doc);
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W, 'p'));
  for (const start of starts) writer.add(paragraphs[start.paragraph], 0, start.id);
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  await writeDocxIdentity(zip, identity, writer.mappings);
  return zip.generateAsync({ type: 'uint8array' });
}

export const docxBlob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes).buffer], { type: MIME });

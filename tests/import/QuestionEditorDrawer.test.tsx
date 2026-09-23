// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuestionEditorDrawer from '../../src/ui/pages/BankEditor/QuestionEditorDrawer';
import { QuestionService } from '../../src/core/services/QuestionService';
import type { MCQuestion } from '../../src/core/entities/Question';

const question: MCQuestion = { id: 'q1', bankId: 'bank', title: 'Câu 1', content: 'Nội dung', type: 'MULTIPLE_CHOICE', choices: ['Một', 'Hai'], answer: 0, tags: ['Nhận biết'], createdAt: 1 };
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const button = (label: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === label)!;
async function input(value: string) {
  const node = container.querySelector<HTMLInputElement>('[aria-label="Tag mới"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
describe('question editor drawer', () => {
  it('saves an unsubmitted tag draft and advances to the next filtered question with the same ID', async () => {
    const save = vi.spyOn(QuestionService, 'updateQuestion').mockResolvedValue();
    const onSaved = vi.fn(); const next = { ...question, id: 'q2', title: 'Câu 2' };
    await act(async () => root.render(<QuestionEditorDrawer bankId="bank" question={question} next={next} availableTags={[]} onNavigate={vi.fn()} onClose={vi.fn()} onSaved={onSaved}/>));
    expect(container.querySelector('dialog')?.open).toBe(true);
    await input('Tag mới từ người dùng');
    await act(async () => button('Lưu & câu tiếp').click());
    expect(save).toHaveBeenCalledWith('q1', expect.objectContaining({ tags: ['Nhận biết', 'Tag mới từ người dùng'] }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'q1', createdAt: 1 }), next);
  });
  it('retains the draft on save failure and guards closing unsaved changes', async () => {
    vi.spyOn(QuestionService, 'updateQuestion').mockRejectedValue(new Error('Lưu lỗi'));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const close = vi.fn(); const onSaved = vi.fn();
    await act(async () => root.render(<QuestionEditorDrawer bankId="bank" question={question} availableTags={[]} onNavigate={vi.fn()} onClose={close} onSaved={onSaved}/>));
    await input('Giữ bản nháp');
    await act(async () => button('Lưu & đóng').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Lưu lỗi');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Tag mới"]')?.value).toBe('Giữ bản nháp');
    await act(async () => button('Đóng').click());
    expect(close).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalled();
  });
});

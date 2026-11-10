/**
 * Memory view: 10 cells per row, all 65536 cells scrollable.
 *
 * Only the rows that are visible are actually created ("virtual scrolling");
 * 6554 rows with 11 elements each would make the page slow. A spacer element
 * with the full height makes the scrollbar behave as if all rows existed.
 */
import {
  MEMORY_SIZE,
  parseWord,
  toHex16,
  toSigned16,
  type CpuState,
} from '../core';
import { h, setChildren } from './dom';
import { t } from './i18n';
import { cellText, CELLS_PER_ROW, type MemoryFormat } from './memoryTable';

export type { MemoryFormat };

export interface MemoryViewOptions {
  format: MemoryFormat;
  hexAddresses: boolean;
  /** Address the stack pointer points to (extended mode), or null. */
  sp: number | null;
  labelAt(address: number): string | undefined;
}

const ROW_COUNT = Math.ceil(MEMORY_SIZE / CELLS_PER_ROW);
/** Row height in rem (must match --mem-row-h in styles.css). */
const ROW_REM = 2.6;

export class MemoryView {
  readonly element: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly rowsBox: HTMLElement;
  private state: Readonly<CpuState> | null = null;
  private opts: MemoryViewOptions | null = null;
  private editingAddress: number | null = null;

  /**
   * @param onEdit called when the user enters a new value; returns false if
   *        the change was not accepted
   */
  constructor(private readonly onEdit: (address: number, value: number) => void) {
    const header = h('div', { class: 'mem-row mem-header', 'aria-hidden': 'true' },
      h('span', { class: 'mem-addr' }, t().addressColumn),
      ...Array.from({ length: CELLS_PER_ROW }, (_, i) => h('span', { class: 'mem-col' }, `+${i}`)));
    this.rowsBox = h('div', { class: 'mem-rows' });
    const spacer = h('div', { class: 'mem-spacer' }, this.rowsBox);
    spacer.style.height = `${ROW_COUNT * ROW_REM}rem`;
    this.viewport = h('div', {
      class: 'mem-viewport',
      tabindex: '-1',
      onscroll: () => this.render(),
    }, spacer);
    this.element = h('div', { class: 'mem-table', role: 'grid', 'aria-label': t().memoryLabel }, header, this.viewport);
  }

  update(state: Readonly<CpuState>, opts: MemoryViewOptions): void {
    this.state = state;
    this.opts = opts;
    this.render();
  }

  /** Scrolls so that the address is visible (only if it is not visible already). */
  scrollToAddress(address: number, force = false): void {
    const rowH = this.rowHeight();
    const row = Math.floor(address / CELLS_PER_ROW);
    const top = row * rowH;
    const vp = this.viewport;
    if (force || top < vp.scrollTop || top + rowH > vp.scrollTop + vp.clientHeight) {
      vp.scrollTop = Math.max(0, top - vp.clientHeight / 3);
    }
    this.render();
  }

  private rowHeight(): number {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) * ROW_REM;
  }

  private render(): void {
    const state = this.state;
    const opts = this.opts;
    if (!state || !opts || this.editingAddress !== null) return;

    const rowH = this.rowHeight();
    const visible = Math.ceil((this.viewport.clientHeight || rowH * 12) / rowH) + 2;
    const first = Math.max(0, Math.min(ROW_COUNT - visible, Math.floor(this.viewport.scrollTop / rowH)));
    this.rowsBox.style.transform = `translateY(${first * rowH}px)`;

    const rows: HTMLElement[] = [];
    for (let r = first; r < Math.min(ROW_COUNT, first + visible); r++) {
      const start = r * CELLS_PER_ROW;
      const cells: HTMLElement[] = [];
      for (let i = 0; i < CELLS_PER_ROW; i++) {
        const address = start + i;
        if (address >= MEMORY_SIZE) break;
        cells.push(this.cell(address, state, opts));
      }
      rows.push(h('div', { class: 'mem-row', role: 'row' },
        h('span', { class: 'mem-addr', role: 'rowheader' }, opts.hexAddresses ? toHex16(start) : String(start)),
        ...cells));
    }
    setChildren(this.rowsBox, ...rows);
  }

  private cell(address: number, state: Readonly<CpuState>, opts: MemoryViewOptions): HTMLElement {
    const word = state.memory[address] ?? 0;
    const label = opts.labelAt(address);
    const isPc = address === state.pc || address === ((state.pc + 1) & 0xffff);
    const classes = ['mem-cell'];
    if (isPc) classes.push('is-pc');
    if (address === state.lastWrite) classes.push('is-written');
    const isSp = opts.sp !== null && address === opts.sp;
    if (isSp) classes.push('is-sp');

    const { text, instruction } = cellText(state.memory, address, opts.format);
    const d = t();
    const title = [
      d.cellAddress(address, label),
      d.cellContent(toSigned16(word), word, toHex16(word)),
      instruction ? d.cellInstruction(instruction) : '',
      isPc ? d.cellIsPc : '',
      isSp ? d.cellIsSp : '',
      address === state.lastWrite ? d.cellWritten : '',
      d.cellClick,
    ].filter(Boolean).join('\n');

    return h('button', {
      type: 'button',
      class: classes.join(' '),
      role: 'gridcell',
      title,
      onclick: (ev: Event) => this.startEdit(address, ev.currentTarget as HTMLElement),
    },
    label ? h('span', { class: 'mem-label' }, label) : null,
    h('span', { class: 'mem-value' }, text));
  }

  private startEdit(address: number, cellEl: HTMLElement): void {
    const state = this.state;
    if (!state || !this.opts || this.editingAddress !== null) return;
    const word = state.memory[address] ?? 0;
    const initial = this.opts.format === 'hex' ? toHex16(word) : this.opts.format === 'unsigned' ? String(word) : String(toSigned16(word));
    const input = h('input', {
      class: 'mem-input',
      value: initial,
      'aria-label': t().cellEditLabel(address),
      title: t().cellEditTitle,
    });
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      if (save) {
        const value = parseWord(input.value, this.opts?.format === 'hex');
        if (value === null) {
          input.classList.add('invalid');
          input.title = t().cellEditInvalid;
          return;
        }
        done = true;
        this.editingAddress = null;
        this.onEdit(address, value);
      } else {
        done = true;
        this.editingAddress = null;
      }
      this.render();
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') finish(true);
      else if (ev.key === 'Escape') finish(false);
      ev.stopPropagation(); // do not trigger app shortcuts while typing
    });
    input.addEventListener('blur', () => {
      if (!done && parseWord(input.value) === null) finish(false);
      else finish(true);
    });
    this.editingAddress = address;
    // Replace the button by the input (an input inside a button does not work in every browser).
    cellEl.replaceWith(h('div', { class: `${cellEl.className} is-editing` }, input));
    input.focus();
    input.select();
  }
}

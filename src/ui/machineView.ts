/**
 * Display of the registers: accumulator, program counter, instruction
 * register and status register (flags).
 */
import {
  disassemble,
  encodeWord1,
  formatWord,
  lookupOpcode,
  SP_START,
  toBinary16,
  toHex16,
  toSigned16,
  type CpuState,
  type NumberFormat,
} from '../core';
import { h, setChildren } from './dom';
import { t } from './i18n';

export interface MachineViewOptions {
  detailed: boolean;
  format: NumberFormat;
  /** Source line of the PC, if known. */
  currentLine: number | undefined;
  /** False before the first instruction was executed (IR still empty). */
  hasExecuted: boolean;
  /** Extended mode: show the stack pointer. */
  extended: boolean;
  /** Label name for an address, to show "STORE Produkt" instead of "STORE 24". */
  labelAt(address: number): string | undefined;
}

export class MachineView {
  readonly element: HTMLElement;

  constructor() {
    this.element = h('div', { class: 'machine' });
  }

  update(state: Readonly<CpuState>, opts: MachineViewOptions): void {
    const d = t();
    const fmt = opts.format === 'binary' ? 'signed' : opts.format;
    const value = (v: number) => formatWord(v, fmt === 'hex' ? 'hex' : fmt === 'unsigned' ? 'unsigned' : 'signed');

    // ----- accumulator -----
    const acc = this.register(d.accumulator, value(state.a), d.accumulatorHelp);
    if (opts.detailed) acc.append(this.details(state.a));

    // ----- program counter -----
    const pc = this.register(d.programCounter, String(state.pc), d.programCounterHelp);
    pc.append(h('div', { class: 'reg-note' },
      opts.currentLine !== undefined ? d.pcLine(opts.currentLine) : d.pcOutside));

    // ----- instruction register -----
    const ir = state.ir;
    const { text: irText, note: irNote } = instructionText(state, opts);
    const irBox = this.register(d.instructionRegister, irText, d.instructionRegisterHelp, 'reg-ir');
    irBox.append(h('div', { class: 'reg-note' }, irNote));
    if (opts.detailed && opts.hasExecuted) {
      irBox.append(h('div', { class: 'reg-detail' },
        d.irDetail(ir.opcode, ir.address)));
    }

    // ----- status register -----
    const flags = h('div', { class: 'flags', role: 'group', 'aria-label': d.flagsLabel },
      ...(['z', 'n', 'v', 'c'] as const).map((f) =>
        h('span', {
          class: `flag${state.flags[f] ? ' on' : ''}`,
          title: d.flagHelp[f],
          'aria-label': `${f.toUpperCase()} ${state.flags[f] ? d.flagOn : d.flagOff}`,
        }, h('span', { class: 'flag-name' }, f.toUpperCase()), h('span', { class: 'flag-value' }, state.flags[f] ? '1' : '0')),
      ));
    const status = h('div', { class: 'reg reg-status' },
      h('div', { class: 'reg-label', title: d.statusRegisterHelp }, d.statusRegister),
      flags);

    const halted = h('div', { class: `machine-state${state.halted === 'none' ? '' : ' halted'}` },
      d.machineState, h('strong', {}, d.haltStatus[state.halted]));

    // ----- stack pointer (extended mode) -----
    let sp: HTMLElement | null = null;
    if (opts.extended) {
      sp = this.register(d.stackPointer, String(state.sp), d.stackPointerHelp);
      sp.append(h('div', { class: 'reg-note' },
        state.sp === SP_START ? d.stackEmpty : d.stackTop(state.sp, toSigned16(state.memory[state.sp] ?? 0))));
    }

    setChildren(this.element, acc, pc, sp, irBox, status, halted);
  }

  private register(label: string, value: string, help: string, extraClass = ''): HTMLElement {
    return h('div', { class: `reg ${extraClass}` },
      h('div', { class: 'reg-label', title: help }, label),
      h('output', { class: 'reg-value' }, value));
  }

  private details(v: number): HTMLElement {
    return h('div', { class: 'reg-detail' },
      h('div', {}, t().valueDetail(toSigned16(v), v, toHex16(v))),
      h('div', { class: 'mono' }, toBinary16(v)));
  }
}

/** Instruction register as text, with a short note (also used for copying). */
function instructionText(state: Readonly<CpuState>, opts: MachineViewOptions): { text: string; note: string } {
  const d = t();
  const ir = state.ir;
  if (!opts.hasExecuted) return { text: '—', note: d.irNone };
  const def = lookupOpcode(ir.opcode);
  if (state.micro && state.micro.index < 2) {
    // Micro steps: only the instruction word has been fetched so far.
    return { text: def && ir.mode ? `${def.mnemonic} …` : '…', note: d.irFetching };
  }
  if (def && ir.mode) {
    return { text: disassemble(encodeWord1(def, ir.mode), ir.address, opts.labelAt).text, note: d.irMode(d.modes[ir.mode]) };
  }
  return { text: '---', note: d.irInvalid };
}

/**
 * The registers as plain text for the clipboard, in the current language,
 * e.g. "Akkumulator (A):     5   (dezimal 5 · … · 0000 0000 0000 0101)".
 */
export function machineAsText(state: Readonly<CpuState>, opts: MachineViewOptions): string {
  const d = t();
  const fmt = opts.format === 'binary' ? 'signed' : opts.format;
  const value = (v: number) => formatWord(v, fmt === 'hex' ? 'hex' : fmt === 'unsigned' ? 'unsigned' : 'signed');
  const binary = (v: number) => toBinary16(v).replace(/(\d{4})(?=\d)/g, '$1 ');
  const ir = instructionText(state, opts);
  const irNotes = [ir.note];
  if (opts.hasExecuted) irNotes.push(d.irDetail(state.ir.opcode, state.ir.address));

  const rows: [string, string][] = [
    [d.accumulator, `${value(state.a)}   (${d.valueDetail(toSigned16(state.a), state.a, toHex16(state.a))} · ${binary(state.a)})`],
    [d.programCounter, `${state.pc}   (${opts.currentLine !== undefined ? d.pcLine(opts.currentLine) : d.pcOutside})`],
  ];
  if (opts.extended) {
    rows.push([d.stackPointer, `${state.sp}   (${state.sp === SP_START ? d.stackEmpty
      : d.stackTop(state.sp, toSigned16(state.memory[state.sp] ?? 0))})`]);
  }
  rows.push(
    [d.instructionRegister, `${ir.text}   (${irNotes.join(' · ')})`],
    [d.statusRegister, (['z', 'n', 'v', 'c'] as const).map((f) => `${f.toUpperCase()}: ${state.flags[f] ? 1 : 0}`).join('   ')],
    [d.machineState.replace(/:\s*$/, ''), d.haltStatus[state.halted]],
  );
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  return rows.map(([label, text]) => `${(label + ':').padEnd(width)}${text}`).join('\n') + '\n';
}

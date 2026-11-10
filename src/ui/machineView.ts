/**
 * Display of the registers: accumulator, program counter, instruction
 * register and status register (flags).
 */
import {
  disassemble,
  encodeWord1,
  formatWord,
  lookupOpcode,
  toBinary16,
  toHex16,
  toSigned16,
  type CpuState,
  type NumberFormat,
} from '../core';
import { h, setChildren } from './dom';
import { FLAG_HELP, HALT_STATUS, MODE_NAMES } from './texts';

export interface MachineViewOptions {
  detailed: boolean;
  format: NumberFormat;
  /** Source line of the PC, if known. */
  currentLine: number | undefined;
  /** False before the first instruction was executed (IR still empty). */
  hasExecuted: boolean;
  /** Label name for an address, to show "STORE Produkt" instead of "STORE 24". */
  labelAt(address: number): string | undefined;
}

export class MachineView {
  readonly element: HTMLElement;

  constructor() {
    this.element = h('div', { class: 'machine' });
  }

  update(state: Readonly<CpuState>, opts: MachineViewOptions): void {
    const fmt = opts.format === 'binary' ? 'signed' : opts.format;
    const value = (v: number) => formatWord(v, fmt === 'hex' ? 'hex' : fmt === 'unsigned' ? 'unsigned' : 'signed');

    // ----- accumulator -----
    const acc = this.register('Akkumulator (A)', value(state.a),
      'Hier steht das Ergebnis jeder Rechnung. Fast alle Befehle arbeiten mit dem Akku.');
    if (opts.detailed) acc.append(this.details(state.a));

    // ----- program counter -----
    const pc = this.register('Befehlszähler (PC)', String(state.pc),
      'Adresse des nächsten Befehls, der geholt wird.');
    pc.append(h('div', { class: 'reg-note' },
      opts.currentLine !== undefined ? `→ Zeile ${opts.currentLine}` : 'außerhalb des Programms'));

    // ----- instruction register -----
    const ir = state.ir;
    let irText = '—';
    let irNote = 'Noch kein Befehl ausgeführt.';
    if (opts.hasExecuted) {
      const def = lookupOpcode(ir.opcode);
      if (def && ir.mode) {
        irText = disassemble(encodeWord1(def, ir.mode), ir.address, opts.labelAt).text;
        irNote = `Adressierung: ${MODE_NAMES[ir.mode]}`;
      } else {
        irText = '---';
        irNote = 'ungültiger Befehlscode';
      }
    }
    const irBox = this.register('Befehlsregister', irText, 'Der Befehl, der gerade ausgeführt wurde.', 'reg-ir');
    irBox.append(h('div', { class: 'reg-note' }, irNote));
    if (opts.detailed && opts.hasExecuted) {
      irBox.append(h('div', { class: 'reg-detail' },
        `Opcode ${ir.opcode} · Adressteil ${ir.address}`));
    }

    // ----- status register -----
    const flags = h('div', { class: 'flags', role: 'group', 'aria-label': 'Flags' },
      ...(['z', 'n', 'v', 'c'] as const).map((f) =>
        h('span', {
          class: `flag${state.flags[f] ? ' on' : ''}`,
          title: FLAG_HELP[f],
          'aria-label': `${f.toUpperCase()} ${state.flags[f] ? 'gesetzt' : 'nicht gesetzt'}`,
        }, h('span', { class: 'flag-name' }, f.toUpperCase()), h('span', { class: 'flag-value' }, state.flags[f] ? '1' : '0')),
      ));
    const status = h('div', { class: 'reg reg-status' },
      h('div', { class: 'reg-label', title: 'Die Flags beschreiben das Ergebnis der letzten Rechnung.' }, 'Statusregister'),
      flags);

    const halted = h('div', { class: `machine-state${state.halted === 'none' ? '' : ' halted'}` },
      'Maschine: ', h('strong', {}, HALT_STATUS[state.halted]));

    setChildren(this.element, acc, pc, irBox, status, halted);
  }

  private register(label: string, value: string, help: string, extraClass = ''): HTMLElement {
    return h('div', { class: `reg ${extraClass}` },
      h('div', { class: 'reg-label', title: help }, label),
      h('output', { class: 'reg-value' }, value));
  }

  private details(v: number): HTMLElement {
    return h('div', { class: 'reg-detail' },
      h('div', {}, `dezimal ${toSigned16(v)} · ohne Vorzeichen ${v} · ${toHex16(v)}`),
      h('div', { class: 'mono' }, toBinary16(v)));
  }
}

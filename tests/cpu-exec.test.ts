/**
 * Instruction execution: addressing modes, memory, jumps, control flow
 * and the example program from the manual.
 */
import { describe, expect, it } from 'vitest';
import { toSigned16 } from '../src/core';
import { calc, cpuWith, ins } from './helpers';

describe('addressing modes', () => {
  // memory: [20] = 7, [21] = 20 (pointer to 20)
  const data = { 20: 7, 21: 20 };

  it('direct: operand = mem[adr]', () => {
    const cpu = cpuWith([ins('LOAD', 20, 'direct')], data);
    cpu.step();
    expect(cpu.getState().a).toBe(7);
  });
  it('immediate: operand = adr', () => {
    const cpu = cpuWith([ins('LOAD', 20, 'immediate')], data);
    cpu.step();
    expect(cpu.getState().a).toBe(20);
  });
  it('indirect: operand = mem[mem[adr]]', () => {
    const cpu = cpuWith([ins('LOAD', 21, 'indirect')], data);
    cpu.step();
    expect(cpu.getState().a).toBe(7);
  });
  it('works for arithmetic too (ADD indirect)', () => {
    const cpu = cpuWith([ins('LOADI', 1), ins('ADD', 21, 'indirect')], data);
    cpu.run(10);
    expect(cpu.getState().a).toBe(8);
  });
});

describe('STORE', () => {
  it('direct writes A to mem[adr] and remembers the cell', () => {
    const cpu = cpuWith([ins('LOADI', -3), ins('STORE', 30)]);
    cpu.step();
    cpu.step();
    const s = cpu.getState();
    expect(toSigned16(s.memory[30] ?? 0)).toBe(-3);
    expect(s.lastWrite).toBe(30);
  });
  it('indirect writes to mem[mem[adr]]', () => {
    const cpu = cpuWith([ins('LOADI', 9), ins('STORE', 40, 'indirect')], { 40: 50 });
    cpu.run(10);
    expect(cpu.getState().memory[50]).toBe(9);
    expect(cpu.getState().memory[40]).toBe(50);
  });
  it('does not change the flags', () => {
    const r = calc(0, 'STORE', 30, { n: true, c: true });
    expect(r.flags).toEqual({ z: false, n: true, v: false, c: true });
  });
});

describe('jumps', () => {
  // [condition flags, mnemonic, should jump]
  const cases: Array<[string, string, boolean]> = [
    ['', 'JMP', true],
    ['', 'JMPP', true],
    ['Z', 'JMPP', false],
    ['N', 'JGT', false],
    ['', 'JMPNN', true],
    ['N', 'JGE', false],
    ['N', 'JMPN', true],
    ['', 'JLT', false],
    ['N', 'JMPNP', true],
    ['Z', 'JLE', true],
    ['', 'JMPNP', false],
    ['Z', 'JMPZ', true],
    ['', 'JEQ', false],
    ['', 'JMPNZ', true],
    ['Z', 'JNE', false],
    ['V', 'JMPV', true],
    ['', 'JOV', false],
    ['C', 'JMPC', true],
    ['', 'JOC', false],
    ['', 'JHI', true],
    ['Z', 'JHI', false],
    ['C', 'JHI', false],
    ['', 'JHS', true],
    ['C', 'JHS', false],
    ['C', 'JLO', true],
    ['', 'JLO', false],
    ['Z', 'JLS', true],
    ['C', 'JLS', true],
    ['', 'JLS', false],
  ];
  it.each(cases)('flags "%s": %s jumps = %s', (f, op, jumps) => {
    const preset = { z: f.includes('Z'), n: f.includes('N'), v: f.includes('V'), c: f.includes('C') };
    const r = calc(0, op, 100, preset);
    const s = r.cpu.getState();
    expect(s.pc).toBe(jumps ? 100 : 2);
    expect(r.flags).toEqual(preset); // jumps never change flags
  });

  it('JLO jumps after 3 CMP 5 (measured on the original)', () => {
    const cpu = cpuWith([ins('LOADI', 3), ins('CMPI', 5), ins('JLO', 50)]);
    cpu.run(3);
    expect(cpu.getState().pc).toBe(50);
  });
});

describe('control instructions', () => {
  it('NOOP only advances PC', () => {
    const r = calc(5, 'NOOP');
    expect(r.cpu.getState().pc).toBe(2);
    expect(r.a).toBe(5);
  });

  it('HALT / HOLD stop the machine; further steps do nothing', () => {
    const cpu = cpuWith([ins('LOADI', 1), ins('HOLD'), ins('LOADI', 2)]);
    expect(cpu.run(100)).toEqual({ reason: 'halt', steps: 2 });
    expect(cpu.step()).toBe('halt');
    expect(cpu.getState().a).toBe(1);
  });

  it('RESET clears registers and halts, memory is kept (own decision)', () => {
    const cpu = cpuWith([ins('LOADI', 7), ins('STORE', 30), ins('RESET')]);
    expect(cpu.run(100).reason).toBe('reset');
    const s = cpu.getState();
    expect(s.a).toBe(0);
    expect(s.pc).toBe(0);
    expect(s.memory[30]).toBe(7);
    expect(s.memory[0]).not.toBe(0); // program still there
  });

  it('reset() makes a halted CPU runnable again', () => {
    const cpu = cpuWith([ins('HALT')]);
    cpu.run(10);
    cpu.reset();
    expect(cpu.getState().halted).toBe('none');
  });

  it('an illegal code halts with PC on it', () => {
    const cpu = cpuWith([ins('LOADI', 1)], { 2: 0xffff });
    expect(cpu.run(10)).toEqual({ reason: 'illegalOpcode', steps: 2 });
    expect(cpu.getState().pc).toBe(2);
  });

  it('run() stops at the step limit (endless loop)', () => {
    const cpu = cpuWith([ins('JMP', 0)]);
    expect(cpu.run(1000)).toEqual({ reason: 'limit', steps: 1000 });
  });

  it('PC wraps around at 65535', () => {
    const cpu = cpuWith([ins('JMP', 0xfffe)]);
    cpu.step(); // jump to 65534: NOOP 0
    cpu.step();
    expect(cpu.getState().pc).toBe(0);
  });
});

describe('example program from manual 3.2 (multiplication by repeated addition)', () => {
  // Addresses as the assembler will compute them: 11 instructions = 22 words.
  const START = 4;
  const ENDE = 20;
  const FAKTOR1 = 22;
  const FAKTOR2 = 23;
  const PRODUKT = 24;

  const instructions = [
    ins('LOADI', 0), //            0
    ins('STORE', PRODUKT), //      2
    ins('LOAD', FAKTOR1), //       4  Start:
    ins('JMPNP', ENDE), //         6
    ins('SUBI', 1), //             8
    ins('STORE', FAKTOR1), //     10
    ins('LOAD', PRODUKT), //      12
    ins('ADD', FAKTOR2), //       14
    ins('STORE', PRODUKT), //     16
    ins('JMP', START), //         18
    ins('HALT'), //               20  Ende:
  ];

  it('computes 5 * 4 = 20', () => {
    const cpu = cpuWith(instructions, { [FAKTOR1]: 5, [FAKTOR2]: 4, [PRODUKT]: 0 });
    const result = cpu.run(10_000);
    expect(result.reason).toBe('halt');
    expect(cpu.getState().memory[PRODUKT]).toBe(20);
    expect(cpu.getState().memory[FAKTOR1]).toBe(0);
  });

  it('can be undone step by step with snapshots ("Schritt zurück")', () => {
    const cpu = cpuWith(instructions, { [FAKTOR1]: 2, [FAKTOR2]: 3 });
    const history = [cpu.snapshot()];
    while (cpu.step() === 'none') history.push(cpu.snapshot());
    expect(cpu.getState().memory[PRODUKT]).toBe(6);

    cpu.restore(history[0]!);
    expect(cpu.getState().pc).toBe(0);
    expect(cpu.getState().memory[PRODUKT]).toBe(0);
    expect(cpu.getState().memory[FAKTOR1]).toBe(2);
  });
});

describe('stepUndoable / undo ("Schritt zurück" without full snapshots)', () => {
  it('restores registers, flags and written memory cells', () => {
    const cpu = cpuWith([ins('LOADI', 5), ins('STORE', 30), ins('ADDI', 1), ins('STORE', 30), ins('HALT')], { 30: 99 });
    const states = [cpu.snapshot()];
    const records = [];
    while (cpu.getState().halted === 'none') {
      records.push(cpu.stepUndoable().undo);
      states.push(cpu.snapshot());
    }
    expect(cpu.getState().memory[30]).toBe(6);
    // undo everything, comparing with the saved full snapshots
    for (let i = records.length - 1; i >= 0; i--) {
      cpu.undo(records[i]!);
      expect(cpu.snapshot()).toEqual(states[i]);
    }
    expect(cpu.getState().memory[30]).toBe(99);
  });

  it('records only memory writes, not reads', () => {
    const cpu = cpuWith([ins('LOAD', 30)], { 30: 1 });
    expect(cpu.stepUndoable().undo.writes).toEqual([]);
  });
});

describe('lastWrite', () => {
  it('stays on the last written cell until the next write', () => {
    const cpu = cpuWith([ins('LOADI', 1), ins('STORE', 30), ins('LOADI', 2), ins('STORE', 31)]);
    cpu.step();
    expect(cpu.getState().lastWrite).toBeNull();
    cpu.step();
    cpu.step();
    expect(cpu.getState().lastWrite).toBe(30);
    cpu.step();
    expect(cpu.getState().lastWrite).toBe(31);
  });
});

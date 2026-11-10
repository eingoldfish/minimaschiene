/**
 * Micro steps must lead to exactly the same state as Cpu.step().
 */
import { describe, expect, it } from 'vitest';
import { assemble, Cpu, createInitialState, encodeWord1, INSTRUCTIONS, MEMORY_SIZE, type Flags } from '../src/core';

const DATA_ADDR = 100; // operand cell
const POINTER_ADDR = 101; // contains DATA_ADDR (for indirect addressing)
const JUMP_TARGET = 50;

const A_VALUES = [0, 1, 7, 0x7fff, 0x8000, 0xffff];
const B_VALUES = [0, 1, 3, 17, 0x8000, 0xffff];
const FLAG_SETS: Flags[] = [
  { z: false, n: false, v: false, c: false },
  { z: true, n: true, v: true, c: true },
  { z: true, n: false, v: false, c: false },
  { z: false, n: true, v: false, c: true },
  { z: false, n: false, v: true, c: false },
];

/** CPU with one instruction at address 10 and prepared registers/memory. */
function setup(word1: number, word2: number, a: number, flags: Flags, data: number): Cpu {
  const mem = new Uint16Array(MEMORY_SIZE);
  mem[10] = word1;
  mem[11] = word2;
  mem[DATA_ADDR] = data;
  mem[POINTER_ADDR] = DATA_ADDR;
  const cpu = new Cpu();
  // One restore() instead of loadMemory() + snapshot() saves two 128-KB copies per case.
  cpu.restore({ ...createInitialState(), memory: mem, a, pc: 10, flags: { ...flags }, lastWrite: 7 });
  return cpu;
}

/** Node's Buffer (tests run in Node); compares memory natively, much faster than a JS loop. */
const NodeBuffer = (globalThis as unknown as {
  Buffer: { from(data: ArrayBuffer): { equals(other: unknown): boolean } };
}).Buffer;

/**
 * Compares two CPUs: registers with toEqual, memory with one native comparison
 * (comparing 65536 cells with toEqual for thousands of cases is far too slow).
 */
function expectSameState(actual: Cpu, expected: Cpu): void {
  const { memory: memA, ...regsA } = actual.getState();
  const { memory: memB, ...regsB } = expected.getState();
  expect(regsA).toEqual(regsB);
  const same = NodeBuffer.from(memA.buffer as ArrayBuffer).equals(NodeBuffer.from(memB.buffer as ArrayBuffer));
  if (!same) {
    const firstDiff = memA.findIndex((v, i) => v !== memB[i]);
    expect(firstDiff, 'first differing memory cell').toBe(-1);
  }
}

function viaMicroSteps(cpu: Cpu): number {
  let count = 0;
  do {
    cpu.microStep();
    count++;
  } while (cpu.getState().micro);
  return count;
}

/** All instruction words to test, with a matching address part. */
function cases(): Array<{ label: string; word1: number; word2s: number[] }> {
  const result: Array<{ label: string; word1: number; word2s: number[] }> = [];
  for (const def of INSTRUCTIONS) {
    for (const mode of def.modes) {
      const word2s = mode === 'immediate' ? B_VALUES
        : mode === 'direct' ? [def.group === 'jump' ? JUMP_TARGET : DATA_ADDR]
          : mode === 'indirect' ? [POINTER_ADDR] : [0];
      result.push({ label: `${def.mnemonic} ${mode}`, word1: encodeWord1(def, mode), word2s });
    }
  }
  result.push({ label: 'illegal 0xFFFF', word1: 0xffff, word2s: [0] });
  result.push({ label: 'illegal STORE immediate', word1: 0x0215, word2s: [5] });
  return result;
}

describe('micro steps give the same result as step()', () => {
  it.each(cases())('$label', ({ word1, word2s }) => {
    for (const word2 of word2s) {
      for (const a of A_VALUES) {
        for (const flags of FLAG_SETS) {
          for (const data of word1 >> 8 === 1 || word1 >> 8 === 3 ? B_VALUES : [3]) {
            const expected = setup(word1, word2, a, flags, data);
            expected.step();
            const actual = setup(word1, word2, a, flags, data);
            viaMicroSteps(actual);
            expectSameState(actual, expected);
          }
        }
      }
    }
  });

  it('runs the multiplication program identically', () => {
    const r = assemble('LOADI 0\nSTORE P\nS: LOAD F1\nJMPNP E\nSUBI 1\nSTORE F1\nLOAD P\nADD F2\nSTORE P\nJMP S\nE: HALT\nF1: WORD 5\nF2: WORD 4\nP: WORD 0');
    const fast = new Cpu();
    fast.loadMemory(r.memory);
    const slow = new Cpu();
    slow.loadMemory(r.memory);
    while (fast.getState().halted === 'none') {
      fast.step();
      viaMicroSteps(slow);
      expectSameState(slow, fast);
    }
    expect(slow.getState().memory[r.labels.get('P')!]).toBe(20);
  });
});

describe('micro step sequence', () => {
  const count = (word1: number, word2: number) => viaMicroSteps(setup(word1, word2, 5, FLAG_SETS[0]!, 3));
  const enc = (name: string, mode: Parameters<typeof encodeWord1>[1]) =>
    encodeWord1(INSTRUCTIONS.find((d) => d.mnemonic === name)!, mode);

  it('has the documented number of steps', () => {
    expect(count(enc('LOAD', 'immediate'), 1)).toBe(5); // 2 fetch, decode, operand, compute
    expect(count(enc('LOAD', 'direct'), DATA_ADDR)).toBe(5);
    expect(count(enc('LOAD', 'indirect'), POINTER_ADDR)).toBe(6); // + look up address
    expect(count(enc('STORE', 'direct'), 200)).toBe(4);
    expect(count(enc('JMP', 'direct'), 50)).toBe(4);
    expect(count(enc('NOT', 'none'), 0)).toBe(4);
    expect(count(enc('HALT', 'none'), 0)).toBe(4);
    expect(count(0xffff, 0)).toBe(3); // stops after decoding
    expect(count(enc('DIV', 'immediate'), 0)).toBe(5); // stops at compute
  });

  it('reports phases, bus values and flows', () => {
    const cpu = setup(enc('ADD', 'direct'), DATA_ADDR, 5, FLAG_SETS[0]!, 3);
    const events = [];
    do events.push(cpu.microStep()!);
    while (!events[events.length - 1]!.done);
    expect(events.map((e) => e.phase)).toEqual(['fetch', 'fetch', 'decode', 'execute', 'execute']);
    expect(events[0]!.bus).toEqual({ address: 10, data: enc('ADD', 'direct'), control: 'lesen' });
    expect(events[1]!.bus).toEqual({ address: 11, data: DATA_ADDR, control: 'lesen' });
    expect(events[3]!.bus).toEqual({ address: DATA_ADDR, data: 3, control: 'lesen' });
    expect(events[4]!.alu).toEqual({ a: 5, b: 3, op: '+', result: 8 });
    expect(events[4]!.explanation).toContain('5 + 3 = 8');
    expect(events.map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
    expect(events.every((e) => e.count === 5)).toBe(true);
  });

  it('shows the PC moving during fetch', () => {
    const cpu = setup(enc('NOT', 'none'), 0, 5, FLAG_SETS[0]!, 0);
    cpu.microStep();
    expect(cpu.getState().pc).toBe(11);
    cpu.microStep();
    expect(cpu.getState().pc).toBe(12);
    expect(cpu.getState().micro?.start.pc).toBe(10);
  });

  it('STORE writes with control "schreiben"', () => {
    const cpu = setup(enc('STORE', 'direct'), 200, 42, FLAG_SETS[0]!, 0);
    viaMicroSteps(cpu);
    expect(cpu.getState().memory[200]).toBe(42);
    expect(cpu.getState().lastWrite).toBe(200);
  });

  it('step() finishes an instruction that was started with micro steps', () => {
    const expected = setup(enc('ADD', 'indirect'), POINTER_ADDR, 5, FLAG_SETS[0]!, 3);
    expected.step();
    const actual = setup(enc('ADD', 'indirect'), POINTER_ADDR, 5, FLAG_SETS[0]!, 3);
    actual.microStep();
    actual.microStep();
    actual.step();
    expectSameState(actual, expected);
  });

  it('micro steps can be undone one by one', () => {
    const cpu = setup(enc('STORE', 'indirect'), POINTER_ADDR, 9, FLAG_SETS[0]!, 0);
    const states = [cpu.snapshot()];
    const undos = [];
    do {
      undos.push(cpu.microStepUndoable().undo);
      states.push(cpu.snapshot());
    } while (cpu.getState().micro);
    expect(cpu.getState().memory[DATA_ADDR]).toBe(9);
    for (let i = undos.length - 1; i >= 0; i--) {
      cpu.undo(undos[i]!);
      expect(cpu.snapshot()).toEqual(states[i]);
    }
  });

  it('returns null when halted', () => {
    const cpu = setup(enc('HALT', 'none'), 0, 0, FLAG_SETS[0]!, 0);
    viaMicroSteps(cpu);
    expect(cpu.microStep()).toBeNull();
  });
});

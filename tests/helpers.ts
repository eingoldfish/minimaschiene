/**
 * Test helpers: build programs without the assembler (which follows in M2).
 */
import {
  Cpu,
  encodeWord1,
  lookupMnemonic,
  MEMORY_SIZE,
  toSigned16,
  toUnsigned16,
  type AddressingMode,
  type Flags,
} from '../src/core';

/** One encoded instruction: [word 1, word 2]. */
export type Encoded = [number, number];

/**
 * Encodes a single instruction.
 * The mode defaults to the "…I" short form's immediate mode, otherwise to
 * the first allowed mode ('none' or 'direct').
 */
export function ins(mnemonic: string, address = 0, mode?: AddressingMode): Encoded {
  const found = lookupMnemonic(mnemonic);
  if (!found) throw new Error(`unknown mnemonic ${mnemonic}`);
  const m = found.forcedMode ?? mode ?? found.def.modes[0] ?? 'none';
  return [encodeWord1(found.def, m), toUnsigned16(address)];
}

/** Builds a memory image: instructions from address 0, then optional data cells. */
export function program(instructions: Encoded[], data: Record<number, number> = {}): Uint16Array {
  const mem = new Uint16Array(MEMORY_SIZE);
  instructions.forEach(([w1, w2], i) => {
    mem[2 * i] = w1;
    mem[2 * i + 1] = w2;
  });
  for (const [addr, value] of Object.entries(data)) {
    mem[Number(addr)] = toUnsigned16(value);
  }
  return mem;
}

/** Creates a CPU with the given program loaded. */
export function cpuWith(instructions: Encoded[], data: Record<number, number> = {}): Cpu {
  const cpu = new Cpu();
  cpu.loadMemory(program(instructions, data));
  return cpu;
}

const NO_FLAGS: Flags = { z: false, n: false, v: false, c: false };

/**
 * Executes ONE instruction with a given accumulator and preset flags.
 * Example: calc(-1, 'MULI', 2) → { a: -2, flags: {...} }
 */
export function calc(
  a: number,
  mnemonic: string,
  operand = 0,
  presetFlags: Partial<Flags> = {},
): { a: number; ua: number; flags: Flags; cpu: Cpu } {
  const cpu = cpuWith([ins(mnemonic, operand)]);
  cpu.restore({
    ...cpu.snapshot(),
    a: toUnsigned16(a),
    flags: { ...NO_FLAGS, ...presetFlags },
  });
  cpu.step();
  const s = cpu.getState();
  return { a: toSigned16(s.a), ua: s.a, flags: { ...s.flags }, cpu };
}

/** Shorthand to write expected flags: flags('ZC') → { z: true, n: false, v: false, c: true }. */
export function flags(set: string): Flags {
  return {
    z: set.includes('Z'),
    n: set.includes('N'),
    v: set.includes('V'),
    c: set.includes('C'),
  };
}

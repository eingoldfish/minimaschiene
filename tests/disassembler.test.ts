import { describe, expect, it } from 'vitest';
import { assemble, disassemble, disassembleAt, encodeWord1, INSTRUCTIONS } from '../src/core';
import { ins } from './helpers';

const dis = (mnemonic: string, address = 0, mode?: Parameters<typeof ins>[2]) =>
  disassemble(...ins(mnemonic, address, mode)).text;

describe('disassemble', () => {
  it('shows all addressing modes in assembler syntax', () => {
    expect(dis('LOAD', 11)).toBe('LOAD 11');
    expect(dis('LOADI', 11)).toBe('LOADI 11');
    expect(dis('LOAD', 11, 'indirect')).toBe('LOAD (11)');
    expect(dis('NOT')).toBe('NOT');
    expect(dis('HOLD')).toBe('HALT');
    expect(dis('JLE', 4)).toBe('JMPNP 4');
  });

  it('shows immediate values signed', () => {
    expect(dis('LOADI', -7)).toBe('LOADI -7');
    expect(dis('ADD', 65535, 'immediate')).toBe('ADDI -1');
  });

  it('shows empty memory as NOOP and unknown codes as ---', () => {
    expect(disassemble(0, 0).text).toBe('NOOP');
    expect(disassemble(0xffff, 5)).toEqual({ valid: false, text: '---' });
    expect(disassemble(0x0215, 5).valid).toBe(false); // STORE immediate
  });

  it('can show label names for addresses', () => {
    const labels = new Map([[4, 'Start']]);
    const at = (a: number) => labels.get(a);
    expect(disassemble(...ins('JMP', 4), at).text).toBe('JMP Start');
    expect(disassemble(...ins('LOAD', 4, 'indirect'), at).text).toBe('LOAD (Start)');
    expect(disassemble(...ins('LOADI', 4), at).text).toBe('LOADI 4'); // numbers stay numbers
  });

  it('pairs words like the original (even = word 1, odd = address part)', () => {
    const r = assemble('LOADI 5\nHALT');
    expect(disassembleAt(r.memory, 0)).toMatchObject({ start: 0, text: 'LOADI 5' });
    expect(disassembleAt(r.memory, 1)).toMatchObject({ start: 0, text: 'LOADI 5' });
    expect(disassembleAt(r.memory, 3)).toMatchObject({ start: 2, text: 'HALT' });
  });
});

describe('round trip: disassemble → assemble gives the same words', () => {
  const cases: Array<[number, number]> = [];
  for (const def of INSTRUCTIONS) {
    for (const mode of def.modes) {
      const address = mode === 'none' ? 0 : mode === 'immediate' ? 65529 : 1234;
      cases.push([encodeWord1(def, mode), address]);
    }
  }

  it.each(cases)('word1 0x%s', (w1, w2) => {
    const text = disassemble(w1, w2).text;
    const r = assemble(text, { extended: true });
    expect(r.errors).toEqual([]);
    expect([r.memory[0], r.memory[1]]).toEqual([w1, w2]);
  });
});

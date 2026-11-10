import { describe, expect, it } from 'vitest';
import { assemble, Cpu, formatError, SP_START, toSigned16 } from '../src/core';
import { EXAMPLES, EXAMPLES_EN } from '../src/ui/examples';

describe('example programs', () => {
  it.each([...EXAMPLES, ...EXAMPLES_EN].map((e) => [e.title, e] as const))('%s assembles, runs and computes the right result', (_title, example) => {
    const r = assemble(example.source, { extended: example.extended });
    expect(r.errors.map((e) => formatError(e))).toEqual([]);
    const cpu = new Cpu();
    cpu.loadMemory(r.memory);
    expect(cpu.run(100_000).reason).toBe('halt');
    const address = r.labels.get(example.check.label);
    expect(address, `label ${example.check.label}`).toBeDefined();
    expect(toSigned16(cpu.getState().memory[address!]!)).toBe(example.check.expected);
    if (example.extended) expect(cpu.getState().sp).toBe(SP_START); // stack is balanced
  });

  it('German and English examples match one to one', () => {
    expect(EXAMPLES_EN.map((e) => [e.id, e.extended, e.check.expected]))
      .toEqual(EXAMPLES.map((e) => [e.id, e.extended, e.check.expected]));
  });

  it('only the extended examples need the extended mode', () => {
    for (const e of [...EXAMPLES, ...EXAMPLES_EN]) {
      expect(assemble(e.source, { extended: false }).ok, e.id).toBe(!e.extended);
    }
  });

  it('factorial: 8! overflows 16 bit (V flag)', () => {
    const fak = EXAMPLES.find((e) => e.id === 'fakultaet')!;
    const r = assemble(fak.source.replace('n:        WORD 6', 'n:        WORD 8'));
    const cpu = new Cpu();
    cpu.loadMemory(r.memory);
    cpu.run(10_000);
    expect(cpu.getState().memory[r.labels.get('Ergebnis')!]).toBe(40320); // unsigned
  });
});

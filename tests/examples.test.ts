import { describe, expect, it } from 'vitest';
import { assemble, Cpu, formatError, SP_START, toSigned16 } from '../src/core';
import { defaultProgram, EXAMPLES, EXAMPLES_EN, translateExample } from '../src/ui/examples';

describe('example programs', () => {
  it.each([...EXAMPLES, ...EXAMPLES_EN].map((e) => [e.title, e] as const))('%s assembles, runs and computes the right result', (_title, example) => {
    const r = assemble(example.source, { extended: example.extended });
    expect(r.errors.map((e) => formatError(e))).toEqual([]);
    const cpu = new Cpu();
    cpu.extended = example.extended;
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

  it('German and English versions give the same machine code (language switch keeps the machine)', () => {
    for (const de of EXAMPLES) {
      const en = EXAMPLES_EN.find((e) => e.id === de.id)!;
      const a = assemble(de.source, { extended: de.extended });
      const b = assemble(en.source, { extended: en.extended });
      expect([...b.memory], de.id).toEqual([...a.memory]);
    }
  });

  it('translateExample: an unchanged example is translated, anything else not', () => {
    for (const de of EXAMPLES) {
      const en = EXAMPLES_EN.find((e) => e.id === de.id)!;
      expect(translateExample(de.source, 'en')).toBe(en.source);
      expect(translateExample(en.source, 'de')).toBe(de.source);
      expect(translateExample(de.source, 'de')).toBeNull();
      expect(translateExample(de.source + ' ', 'en')).toBeNull();
    }
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

  /** Assembles and runs a (possibly changed) example; returns memory and labels. */
  function runExample(id: string, change: (source: string) => string = (x) => x) {
    const e = EXAMPLES.find((x) => x.id === id)!;
    const r = assemble(change(e.source), { extended: e.extended });
    expect(r.errors).toEqual([]);
    const cpu = new Cpu();
    cpu.extended = e.extended;
    cpu.loadMemory(r.memory);
    expect(cpu.run(100_000).reason).toBe('halt');
    const memory = cpu.getState().memory;
    const at = (label: string, offset = 0) => toSigned16(memory[r.labels.get(label)! + offset]!);
    return { at };
  }

  it('sorting: the whole list is sorted', () => {
    const { at } = runExample('sortieren');
    expect([0, 1, 2, 3, 4, 5].map((i) => at('Liste', i))).toEqual([-2, 0, 3, 5, 7, 9]);
  });

  it('fibonacci: writes the first 10 numbers', () => {
    const { at } = runExample('fibonacci');
    expect([...Array(10).keys()].map((i) => at('Folge', i))).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
  });

  it('flags: V and C are both detected', () => {
    const { at } = runExample('flags');
    expect([at('FlagV'), at('FlagC')]).toEqual([1, 1]);
  });

  it('prime test: 91 is not prime', () => {
    const { at } = runExample('primzahl', (src) => src.replace('n:      WORD 97', 'n:      WORD 91'));
    expect(at('Prim')).toBe(0);
  });

  it('branch: a positive number stays as it is', () => {
    const { at } = runExample('verzweigung', (src) => src.replace('x:      WORD -17', 'x:      WORD 8'));
    expect(at('Betrag')).toBe(8);
  });

  it('stack: all three numbers are reversed', () => {
    const { at } = runExample('stack');
    expect([at('Erster'), at('Zweiter'), at('Dritter')]).toEqual([3, 2, 1]);
  });

  it('division: hours and minutes', () => {
    const { at } = runExample('division');
    expect([at('Stunden'), at('Minuten')]).toEqual([2, 15]);
  });

  it('the default program is still the multiplication', () => {
    expect(defaultProgram('de')).toBe(EXAMPLES.find((e) => e.id === 'multiplikation')!.source);
  });
});

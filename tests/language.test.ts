import { describe, expect, it } from 'vitest';
import { assemble, Cpu, formatError, INSTRUCTIONS } from '../src/core';

const GERMAN = /[äöüÄÖÜß]|\b(Zeile|Befehl|Speicher|Adresse|nicht|und)\b/;

describe('English texts', () => {
  const broken = 'LOAD\nFOO 3\nx: WORD\nSTORE nirgends\nLOADI 99999\nJMP (\nRSV 2';

  it('assembler messages are translated', () => {
    const de = assemble(broken).errors;
    const en = assemble(broken, { lang: 'en' }).errors;
    expect(en.length).toBe(de.length);
    expect(en.length).toBeGreaterThan(3);
    for (const e of en) {
      const text = `${formatError(e, 'en')} ${e.hint ?? ''}`;
      expect(text, text).not.toMatch(GERMAN);
    }
    expect(formatError(de[0]!)).toMatch(/^Zeile/);
  });

  it('instruction help exists in both languages', () => {
    for (const def of INSTRUCTIONS) {
      expect(def.description.de, def.mnemonic).not.toBe('');
      expect(def.description.en, def.mnemonic).not.toMatch(GERMAN);
      expect(def.flags.en, def.mnemonic).not.toMatch(GERMAN);
    }
  });

  it('micro step explanations are translated', () => {
    const { memory } = assemble('LOADI 3\nADD x\nSTORE x\nJMPZ 0\nHALT\nx: WORD 4');
    const cpu = new Cpu();
    cpu.language = 'en';
    cpu.loadMemory(memory);
    for (let i = 0; i < 40 && cpu.getState().halted === 'none'; i++) {
      const ev = cpu.microStep()!;
      expect(`${ev.title} ${ev.explanation}`).not.toMatch(GERMAN);
    }
    expect(cpu.getState().halted).toBe('halt');
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assemble, Cpu } from '../src/core';
import { setLanguage } from '../src/ui/i18n';
import { machineAsText, type MachineViewOptions } from '../src/ui/machineView';

const SOURCE = `        LOADI -3
        ADDI 1
        HALT
`;

function run(): { cpu: Cpu; opts: MachineViewOptions } {
  const r = assemble(SOURCE);
  const cpu = new Cpu();
  cpu.loadMemory(r.memory);
  cpu.run(100);
  const opts: MachineViewOptions = {
    detailed: false, format: 'signed', currentLine: 3, hasExecuted: true, extended: false, labelAt: () => undefined,
  };
  return { cpu, opts };
}

describe('registers as text (copy button)', () => {
  // setLanguage also sets <html lang>; the tests run without a page
  beforeAll(() => vi.stubGlobal('document', { documentElement: {} }));
  afterAll(() => { setLanguage('de'); vi.unstubAllGlobals(); });

  it('lists all registers in a fixed order, in German', () => {
    setLanguage('de');
    const { cpu, opts } = run();
    const text = machineAsText(cpu.getState(), opts);
    const lines = text.trimEnd().split('\n');
    expect(lines.map((l) => l.split(':')[0])).toEqual(
      ['Akkumulator (A)', 'Befehlszähler (PC)', 'Befehlsregister', 'Statusregister', 'Maschine']);
    expect(lines[0]).toMatch(/:\s+-2\s+\(dezimal -2 · ohne Vorzeichen 65534 · .*1111 1111 1111 1110\)$/);
    expect(lines[2]).toContain('HALT');
    expect(lines[3]).toMatch(/Z: 0\s+N: 1\s+V: 0\s+C: 0$/);
    expect(lines[4]).toContain('angehalten (HALT)');
    // values start in the same column
    const columns = lines.map((l) => l.search(/:\s+\S/) + l.slice(l.indexOf(':') + 1).search(/\S/) + 1);
    expect(new Set(columns).size).toBe(1);
  });

  it('switches the language and shows SP in extended mode', () => {
    setLanguage('en');
    const { cpu, opts } = run();
    const text = machineAsText(cpu.getState(), { ...opts, extended: true });
    expect(text).toContain('Accumulator (A):');
    expect(text).toContain('Stack pointer (SP):');
    expect(text).toContain('Machine:');
    expect(text).not.toContain('Akkumulator');
  });
});

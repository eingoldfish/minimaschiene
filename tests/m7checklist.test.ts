import { describe, expect, it } from 'vitest';
import { assemble, Cpu, SP_START } from '../src/core';

/** The expected results listed in docs/kompatibilitaet.md, "Noch am Original zu prüfen". */
describe('checklist in docs/kompatibilitaet.md matches our behaviour', () => {
  const run = (src: string, steps: number, extended = false) => {
    const r = assemble(src, { extended });
    expect(r.errors).toEqual([]);
    const cpu = new Cpu();
    cpu.extended = extended;
    cpu.loadMemory(r.memory);
    for (let i = 0; i < steps; i++) cpu.step();
    return cpu.getState();
  };

  it('12: invalid opcode halts, PC already behind it (Java source)', () => {
    const r = assemble('HALT');
    const cpu = new Cpu();
    const mem = r.memory.slice();
    mem[0] = 77;
    cpu.loadMemory(mem);
    cpu.step();
    expect(cpu.getState().halted).toBe('illegalOpcode');
    expect(cpu.getState().pc).toBe(2);
  });

  it('13: PC after HALT', () => {
    expect(run('LOADI 1\nHALT', 2).pc).toBe(4);
  });

  it('14–17, 21: assembler decisions', () => {
    expect(assemble('JMP (10)').ok).toBe(true); // 14: indirect jumps exist (Java source)
    expect(assemble('JMP ende\nEnde: HALT').ok).toBe(false);
    expect(assemble('load: HALT').ok).toBe(true); // 16: instruction names are allowed as labels (Java source)
    expect(assemble('LOAD -1').ok).toBe(false);
    expect(assemble('LOADI 7\nPUSH\nLOAD -1(SP)', { extended: true }).ok).toBe(true);
  });

  it('18: JSR stores return address 2 at SP-1', () => {
    const s = run('JSR 6\nHALT\nHALT\nRTS', 1, true);
    expect(s.sp).toBe(SP_START - 1);
    expect(s.memory[SP_START - 1]).toBe(2);
    expect(s.pc).toBe(6);
  });

  it('19: PUSH keeps the flags', () => {
    const before = run('LOADI -1\nCMPI 5\nPUSH', 2, true).flags;
    const after = run('LOADI -1\nCMPI 5\nPUSH', 3, true).flags;
    expect(after).toEqual(before);
  });
});

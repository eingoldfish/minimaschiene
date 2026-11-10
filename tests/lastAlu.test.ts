import { describe, expect, it } from 'vitest';
import { assemble, Cpu } from '../src/core';

function run(source: string, steps: number, extended = false): Cpu {
  const r = assemble(source, { extended });
  expect(r.errors).toEqual([]);
  const cpu = new Cpu();
  cpu.loadMemory(r.memory);
  for (let i = 0; i < steps; i++) cpu.step();
  return cpu;
}

describe('last ALU calculation (shown at the ALU in the diagram)', () => {
  it('is empty at the start and after reset', () => {
    const cpu = run('LOADI 3\nHALT', 1);
    expect(cpu.getState().lastAlu).not.toBeNull();
    cpu.reset();
    expect(cpu.getState().lastAlu).toBeNull();
  });

  it('shows accumulator, operand, operation and result (example 3 + -4)', () => {
    const cpu = run('LOADI 3\nADD x\nSTORE y\nHALT\nx: WORD -4\ny: WORD 0', 3);
    // STORE does not use the ALU: the addition stays visible
    expect(cpu.getState().lastAlu).toEqual({ a: 3, b: 0xfffc, op: '+', result: 0xffff });
  });

  it('marks loads, compares and stack values', () => {
    expect(run('LOADI 7\nHALT', 1).getState().lastAlu).toMatchObject({ op: '→', b: 7, result: 7 });
    expect(run('LOADI 2\nCMPI 5\nHALT', 2).getState().lastAlu).toMatchObject({ a: 2, b: 5, op: 'cmp', result: 0xfffd });
    expect(run('LOADI 9\nPUSH\nLOADI 1\nPOP\nHALT', 4, true).getState().lastAlu).toMatchObject({ a: 1, b: 9, op: '→', result: 9 });
  });

  it('is undone by "step back"', () => {
    const r = assemble('LOADI 3\nADDI 4\nHALT');
    const cpu = new Cpu();
    cpu.loadMemory(r.memory);
    cpu.step();
    const { undo } = cpu.stepUndoable();
    expect(cpu.getState().lastAlu?.op).toBe('+');
    cpu.undo(undo);
    expect(cpu.getState().lastAlu?.op).toBe('→');
  });
});

import { describe, expect, it } from 'vitest';
import { assemble, Cpu, MEMORY_SIZE } from '../src/core';

describe('Cpu', () => {
  it('starts with 64K words of zeroed memory, the two top cells -1 (as in the original)', () => {
    const state = new Cpu().getState();
    expect(state.memory.length).toBe(MEMORY_SIZE);
    expect(state.memory.slice(0, MEMORY_SIZE - 2).every((w) => w === 0)).toBe(true);
    expect([state.memory[65534], state.memory[65535]]).toEqual([0xffff, 0xffff]);
  });

  it('assembling and clearMemory() also set the two top cells to -1', () => {
    expect(assemble('HALT').memory[65535]).toBe(0xffff);
    const cpu = new Cpu();
    cpu.writeMemory(65535, 0);
    cpu.writeMemory(3, 9);
    cpu.clearMemory();
    expect([cpu.getState().memory[3], cpu.getState().memory[65535]]).toEqual([0, 0xffff]);
  });

  it('reset keeps the "last written" marker (as in the original)', () => {
    const cpu = new Cpu();
    cpu.writeMemory(7, 1);
    cpu.reset();
    expect(cpu.getState().lastWrite).toBe(7);
  });

  it('reset() clears A, PC and flags but keeps the memory', () => {
    const cpu = new Cpu();
    const mem = new Uint16Array(MEMORY_SIZE);
    mem[0] = 42;
    mem[100] = 0xffff;
    cpu.loadMemory(mem);

    // Bring the CPU into a "dirty" state via restore() (UI may not mutate state directly).
    cpu.restore({
      ...cpu.snapshot(),
      a: 123,
      pc: 10,
      flags: { z: true, n: true, v: true, c: true },
    });

    cpu.reset();
    const s = cpu.getState();
    expect(s.a).toBe(0);
    expect(s.pc).toBe(0);
    expect(s.flags).toEqual({ z: false, n: false, v: false, c: false });
    expect(s.memory[0]).toBe(42);
    expect(s.memory[100]).toBe(0xffff);
  });

  it('snapshot() is a deep copy', () => {
    const cpu = new Cpu();
    const snap = cpu.snapshot();
    snap.memory[5] = 7;
    snap.flags.z = true;
    expect(cpu.getState().memory[5]).toBe(0);
    expect(cpu.getState().flags.z).toBe(false);
  });

  it('loadMemory() copies the array', () => {
    const cpu = new Cpu();
    const mem = new Uint16Array(MEMORY_SIZE);
    cpu.loadMemory(mem);
    mem[1] = 99;
    expect(cpu.getState().memory[1]).toBe(0);
  });
});

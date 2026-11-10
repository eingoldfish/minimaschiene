import { describe, expect, it } from 'vitest';
import { Cpu, MEMORY_SIZE } from '../src/core';

describe('Cpu', () => {
  it('starts with 64K words of zeroed memory', () => {
    const state = new Cpu().getState();
    expect(state.memory.length).toBe(MEMORY_SIZE);
    expect(state.memory.every((w) => w === 0)).toBe(true);
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

import { describe, expect, it } from 'vitest';
import { Session } from '../src/ui/session';

const COUNTDOWN = `LOADI 3
Schleife: SUBI 1
JMPNZ Schleife
STORE Ergebnis
HALT
Ergebnis: WORD 99`;

describe('Session', () => {
  it('assembles, loads and resets the CPU', () => {
    const s = new Session();
    expect(s.assemble(COUNTDOWN).ok).toBe(true);
    expect(s.state.pc).toBe(0);
    expect(s.currentLine).toBe(1);
    expect(s.labelAt(2)).toBe('Schleife');
  });

  it('keeps the old program if the new one has errors', () => {
    const s = new Session();
    s.assemble(COUNTDOWN);
    expect(s.assemble('LAOD 5').ok).toBe(false);
    expect(s.program?.labels.has('Ergebnis')).toBe(true);
  });

  it('"Assemblieren und Speicher behalten" keeps cells outside the program', () => {
    const s = new Session();
    s.assemble('HALT');
    s.writeMemory(500, 42);
    s.assemble('HALT', { keepMemory: true });
    expect(s.state.memory[500]).toBe(42);
    s.assemble('HALT');
    expect(s.state.memory[500]).toBe(0);
  });

  it('steps forward and back', () => {
    const s = new Session();
    s.assemble(COUNTDOWN);
    s.step();
    s.step();
    expect(s.state.a).toBe(2);
    expect(s.currentLine).toBe(3);
    expect(s.stepBack()).toBe(true);
    expect(s.state.a).toBe(3);
    expect(s.currentLine).toBe(2);
    s.stepBack();
    expect(s.stepBack()).toBe(false);
  });

  it('can step back after HALT', () => {
    const s = new Session();
    s.assemble(COUNTDOWN);
    expect(s.runSlice(1000, true).reason).toBe('halt');
    s.stepBack();
    expect(s.state.halted).toBe('none');
    expect(s.currentLine).toBe(5); // on HALT again
  });

  it('stops at breakpoints, but not on the first instruction of a run', () => {
    const s = new Session();
    s.assemble(COUNTDOWN);
    s.setBreakpointLines([2]);
    expect(s.runSlice(1000, true)).toEqual({ reason: 'breakpoint', steps: 1 });
    expect(s.state.a).toBe(3);
    expect(s.runSlice(1000, true)).toEqual({ reason: 'breakpoint', steps: 2 });
    expect(s.state.a).toBe(2);
  });

  it('a breakpoint on a line without instruction applies to the next instruction', () => {
    const s = new Session();
    s.assemble('LOADI 1\n# Kommentar\n\nHALT');
    s.setBreakpointLines([2]);
    expect(s.runSlice(10, true).reason).toBe('breakpoint');
    expect(s.currentLine).toBe(4);
  });

  it('breakpoints set before assembling are applied after assembling', () => {
    const s = new Session();
    s.setBreakpointLines([5]);
    s.assemble(COUNTDOWN);
    expect(s.runSlice(1000, true).reason).toBe('breakpoint');
    expect(s.currentLine).toBe(5);
  });

  it('runSlice returns "none" when the budget is used up', () => {
    const s = new Session();
    s.assemble('x: JMP x');
    expect(s.runSlice(50, true)).toEqual({ reason: 'none', steps: 50 });
    expect(s.runSlice(50, false)).toEqual({ reason: 'none', steps: 50 });
  });

  it('reset keeps the memory and clears the history', () => {
    const s = new Session();
    s.assemble(COUNTDOWN);
    s.runSlice(1000, true);
    s.reset();
    expect(s.state.memory[s.program!.labels.get('Ergebnis')!]).toBe(0);
    expect(s.state.pc).toBe(0);
    expect(s.canStepBack).toBe(false);
  });
});

describe('Session: behaviour of the original (Java 4.0)', () => {
  it('switching extended mode resets the CPU and keeps the memory', () => {
    const s = new Session();
    s.assemble(COUNTDOWN);
    s.step();
    s.step();
    s.setExtended(true);
    expect(s.state.pc).toBe(0);
    expect(s.state.a).toBe(0);
    expect(s.cpu.extended).toBe(true);
    expect(s.state.memory[1]).toBe(3); // LOADI 3 still there
  });

  it('clearMemory clears the memory but keeps the registers', () => {
    const s = new Session();
    s.assemble(COUNTDOWN);
    s.step();
    s.clearMemory();
    expect(s.state.a).toBe(3);
    expect(s.state.pc).toBe(2);
    expect(s.state.memory[1]).toBe(0);
    expect(s.state.memory[65535]).toBe(0xffff);
    expect(s.canStepBack).toBe(false);
  });

  it('memory filled by hand can be executed without assembling', () => {
    const s = new Session();
    expect(s.hasProgram).toBe(false);
    s.writeMemory(0, 0x0214); // LOADI
    s.writeMemory(1, 7);
    expect(s.hasProgram).toBe(true);
    s.step();
    expect(s.state.a).toBe(7);
  });

  it('assembling sets the extended mode of the CPU', () => {
    const s = new Session();
    expect(s.assemble('LOADI 1\nPUSH\nHALT', { extended: true }).ok).toBe(true);
    expect(s.runSlice(10, true).reason).toBe('halt');
  });
});

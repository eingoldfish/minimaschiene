/**
 * Extended mode: stack pointer, stack instructions and SP-relative addressing.
 */
import { describe, expect, it } from 'vitest';
import { assemble, Cpu, formatError, SP_START, toSigned16 } from '../src/core';

const FIRST = SP_START - 1; // cell of the first PUSH (65533)

/** Assembles in extended mode and runs until HALT. */
function run(source: string, maxSteps = 10_000): Cpu {
  const r = assemble(source, { extended: true });
  expect(r.errors.map((e) => formatError(e))).toEqual([]);
  const cpu = new Cpu();
  cpu.extended = true;
  cpu.loadMemory(r.memory);
  expect(cpu.run(maxSteps).reason).toBe('halt');
  return cpu;
}

describe('assembler: extended mode', () => {
  it('rejects stack instructions and SP addressing without extended mode', () => {
    const msgs = (src: string) => assemble(src).errors.map((e) => e.message);
    for (const ins of ['PUSH', 'POP', 'RTS', 'RETURN', 'JSR 0', 'CALL 0', 'RSV $1', 'REL $1']) {
      expect(msgs(ins)[0], ins).toMatch(/gibt es nur im erweiterten Modus/);
    }
    expect(msgs('LOAD $2(SP)')[0]).toMatch(/nur im erweiterten Modus/);
  });

  it('encodes stack instructions and SP modes like the original (test 3b)', () => {
    const r = assemble('JSR 8\nRTS\nPUSH\nPOP\nRSV $3\nREL $3\nLOAD 2(SP)\nLOAD @2(SP)\nLOAD $2(SP)\nSTORE -1(SP)', { extended: true });
    expect(r.errors).toEqual([]);
    const w = (i: number) => [r.memory[2 * i], r.memory[2 * i + 1]];
    expect(w(0)).toEqual([261, 8]); // JSR direct (measured)
    expect(w(1)).toEqual([6, 0]); // RTS (measured)
    expect(w(2)).toEqual([25, 0]); // PUSH (measured)
    expect(w(3)).toEqual([26, 0]); // POP (measured)
    expect(w(4)).toEqual([0x0207, 3]); // RSV $3 (code 7 as in the original, Java source)
    expect(w(5)).toEqual([0x0208, 3]); // REL $3 (code 8)
    expect(w(6)).toEqual([1044, 2]); // LOAD 2(SP)  (measured)
    expect(w(7)).toEqual([1300, 2]); // LOAD @2(SP) (measured)
    expect(w(8)).toEqual([1556, 2]); // LOAD $2(SP) (measured)
    expect(w(9)).toEqual([0x0415, 0xffff]); // STORE -1(SP); STORE 2(SP) = 1045 measured
  });

  it('accepts spaces before (SP) and lower-case sp', () => {
    const r = assemble('LOAD 2(SP)\nLOAD 2 (SP)\nLOAD 2(sp)\nLOAD @2(SP)', { extended: true });
    expect(r.errors).toEqual([]);
    expect([r.memory[0], r.memory[2], r.memory[4]]).toEqual([0x0414, 0x0414, 0x0414]);
    expect(r.memory[6]).toBe(0x0514);
  });

  it('CALL and RETURN are aliases', () => {
    const a = assemble('CALL 4\nRETURN', { extended: true });
    const b = assemble('JSR 4\nRTS', { extended: true });
    expect([...a.memory.slice(0, 4)]).toEqual([...b.memory.slice(0, 4)]);
  });

  it('RSV/REL take the number with "$" only, as in the original', () => {
    for (const bad of ['RSV 2', 'REL 2', 'RSV (2)', 'RSV 2(SP)', 'RSV']) {
      expect(assemble(bad, { extended: true }).errors.length, bad).toBe(1);
    }
    expect(assemble('RSV 2', { extended: true }).errors[0]?.hint).toMatch(/RSV \$3/);
    expect(assemble('RSV $2\nREL $-1', { extended: true }).errors).toEqual([]);
    expect(assemble('STORE $2(SP)', { extended: true }).errors[0]?.message).toMatch(/kann nicht mit/);
  });
});

describe('stack instructions', () => {
  it('SP starts at 65534, PUSH decreases it to 65533 (measured, test 3b)', () => {
    expect(new Cpu().getState().sp).toBe(65534);
    const cpu = run('LOADI 7\nPUSH\nHALT');
    expect(cpu.getState().sp).toBe(65533);
    expect(cpu.getState().memory[FIRST]).toBe(7);
    expect(cpu.getState().lastWrite).toBe(FIRST);
  });

  it('PUSH: first SP − 1, then write – 0(SP) is the pushed value (measured, test 3b)', () => {
    const cpu = run('LOADI 7\nPUSH\nLOAD 0(SP)\nHALT');
    expect(cpu.getState().a).toBe(7);
  });

  it('POP returns values in reverse order and sets Z/N like LOAD', () => {
    const cpu = run(`LOADI 1
PUSH
LOADI -2
PUSH
LOADI 0
POP
STORE a
POP
STORE b
HALT
a: WORD 0
b: WORD 0`);
    const s = cpu.getState();
    expect(toSigned16(s.memory[20]!)).toBe(-2);
    expect(s.memory[21]).toBe(1);
    expect(s.sp).toBe(SP_START); // balanced
    expect(s.flags.n).toBe(false); // last POP loaded 1
  });

  it('POP of a negative value sets N and clears V/C (measured, test 3b)', () => {
    const cpu = run('LOADI -5\nPUSH\nLOADI 1\nCMPI 2\nPOP\nHALT');
    expect(cpu.getState().flags).toEqual({ z: false, n: true, v: false, c: false });
  });

  it('PUSH, JSR, RTS, RSV and REL do not change the flags', () => {
    const cpu = run('LOADI 0\nRSV $2\nREL $2\nPUSH\nJSR up\nHALT\nup: RTS');
    expect(cpu.getState().flags.z).toBe(true);
  });

  it('JSR saves the return address, RTS jumps back', () => {
    const cpu = run(`LOADI 5
JSR verdoppeln
STORE ergebnis
HALT
verdoppeln: MULI 2
RTS
ergebnis: WORD 0`);
    const s = cpu.getState();
    expect(s.memory[12]).toBe(10);
    expect(s.sp).toBe(SP_START);
    expect(s.memory[FIRST]).toBe(4); // return address = address of STORE
  });

  it('subroutines can be nested', () => {
    const cpu = run(`LOADI 1
JSR a
HALT
a: ADDI 10
JSR b
ADDI 100
RTS
b: ADDI 1000
RTS`);
    expect(cpu.getState().a).toBe(1111);
    expect(cpu.getState().sp).toBe(SP_START);
  });

  it('RSV and REL move SP (with wrap-around)', () => {
    const cpu = run('RSV $3\nHALT');
    expect(cpu.getState().sp).toBe(SP_START - 3);
    const cpu2 = run('RSV $3\nREL $5\nHALT');
    expect(cpu2.getState().sp).toBe(0); // 65534 + 2 wraps around to 0
  });

  it('reset() and RESET set SP back to its start value', () => {
    const cpu = run('RSV $3\nHALT');
    cpu.reset();
    expect(cpu.getState().sp).toBe(SP_START);
    const r = assemble('RSV $3\nRESET', { extended: true });
    const cpu2 = new Cpu();
    cpu2.extended = true;
    cpu2.loadMemory(r.memory);
    expect(cpu2.run(10).reason).toBe('reset');
    expect(cpu2.getState().sp).toBe(SP_START);
  });
});

describe('SP-relative addressing', () => {
  // Parameter passing on the stack: caller pushes 6 and 7, subroutine adds them.
  const PROGRAM = `LOADI 6
PUSH
LOADI 7
PUSH
JSR addiere
REL $2          # Parameter wieder vom Stack nehmen
STORE summe
HALT
addiere:        # Stack: [SP] = Rücksprung, [SP+1] = 7, [SP+2] = 6
LOAD 1(SP)
ADD 2(SP)
RTS
summe: WORD 0`;

  it('reads parameters with adr(SP)', () => {
    const cpu = run(PROGRAM);
    expect(cpu.getState().a).toBe(13);
    expect(cpu.getState().sp).toBe(SP_START);
  });

  it('$adr(SP) gives the address itself, @adr(SP) reads indirectly', () => {
    const cpu = run(`RSV $1         # SP = 65533
LOAD $0(SP)        # A = 65533 (address of the top cell)
STORE 0(SP)        # mem[65533] = 65533  (a pointer to itself)
LOADI 42
STORE @0(SP)       # mem[mem[65533]] = 42  ->  mem[65533] = 42
LOAD 0(SP)
HALT`);
    expect(cpu.getState().a).toBe(42);
  });

  it('negative offsets work', () => {
    const cpu = run('LOADI 9\nSTORE -1(SP)\nLOAD -1(SP)\nHALT');
    expect(cpu.getState().memory[SP_START - 1]).toBe(9);
    expect(cpu.getState().a).toBe(9);
  });
});

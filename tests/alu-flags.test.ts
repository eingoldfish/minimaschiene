/**
 * Arithmetic, logic and shift instructions incl. flags.
 * Most expected values were measured on the original (docs/kompatibilitaet.md).
 */
import { describe, expect, it } from 'vitest';
import { calc, flags } from './helpers';

describe('LOAD / LOADI / LOADC', () => {
  it('LOADI sets Z/N and clears V and C', () => {
    expect(calc(5, 'LOADI', 0, { v: true, c: true })).toMatchObject({ a: 0, flags: flags('Z') });
    expect(calc(0, 'LOADI', -7)).toMatchObject({ a: -7, flags: flags('N') });
  });
  it('LOADC loads the carry flag as 1/0', () => {
    expect(calc(9, 'LOADC', 0, { c: true })).toMatchObject({ a: 1, flags: flags('') });
    expect(calc(9, 'LOADC', 0, { c: false })).toMatchObject({ a: 0, flags: flags('Z') });
  });
});

describe('ADD', () => {
  it.each([
    [2, 3, 5, ''],
    [32767, 1, -32768, 'NV'], // signed overflow
    [-1, 1, 0, 'ZC'], // unsigned carry
    [-32768, -1, 32767, 'VC'], // both
    [-5, 3, -2, 'N'],
  ])('%i ADDI %i = %i, flags %s', (a, b, result, f) => {
    expect(calc(a, 'ADDI', b)).toMatchObject({ a: result, flags: flags(f) });
  });
});

describe('SUB (C = borrow)', () => {
  it.each([
    [5, 3, 2, ''],
    [3, 5, -2, 'NC'],
    [7, 7, 0, 'Z'],
    [0, 1, -1, 'NC'],
    [-1, 1, -2, 'N'], // 0xFFFF - 1, no borrow
    [-32768, 1, 32767, 'V'],
  ])('%i SUBI %i = %i, flags %s', (a, b, result, f) => {
    expect(calc(a, 'SUBI', b)).toMatchObject({ a: result, flags: flags(f) });
  });
});

describe('CMP (like SUB, accumulator unchanged)', () => {
  it('sets C when A < operand (unsigned)', () => {
    expect(calc(3, 'CMPI', 5)).toMatchObject({ a: 3, flags: flags('NC') });
  });
  it('sets Z on equality', () => {
    expect(calc(7, 'CMPI', 7)).toMatchObject({ a: 7, flags: flags('Z') });
  });
  it('sets V on signed overflow', () => {
    expect(calc(-32768, 'CMPI', 1)).toMatchObject({ a: -32768, flags: flags('V') });
  });
});

describe('MUL (V and C determined separately)', () => {
  it.each([
    [6, 7, 42, ''],
    [300, 300, 24464, 'VC'],
    [200, 200, -25536, 'NV'],
    [-1, 2, -2, 'NC'],
    [-1, -1, 1, 'C'],
    [0, -5, 0, 'Z'],
  ])('%i MULI %i = %i, flags %s', (a, b, result, f) => {
    expect(calc(a, 'MULI', b)).toMatchObject({ a: result, flags: flags(f) });
  });
});

describe('MULH (signed product / 65536, rounded towards 0)', () => {
  it.each([
    [300, 300, 1],
    [-300, 300, -1],
    [3, -1, 0],
    [-32768, 1, 0],
    [-32768, -1, 0],
  ])('%i MULHI %i = %i', (a, b, result) => {
    expect(calc(a, 'MULHI', b).a).toBe(result);
  });
  it('clears V and C', () => {
    expect(calc(300, 'MULHI', 300, { v: true, c: true }).flags).toEqual(flags(''));
  });
});

describe('MULHU (unsigned, N always 0)', () => {
  it.each([
    [-1, -1, 0xfffe],
    [-1, 2, 1],
    [300, 300, 1],
  ])('%i MULHUI %i = %i', (a, b, result) => {
    const r = calc(a, 'MULHUI', b, { n: true, v: true, c: true });
    expect(r.ua).toBe(result);
    expect(r.flags).toEqual(flags(''));
  });
});

describe('DIV / MOD (signed, like Java)', () => {
  it.each([
    [7, 2, 3, ''],
    [-7, 2, -3, 'N'],
    [-32768, -1, -32768, 'N'], // overflow is truncated, no V
    [0, 5, 0, 'Z'],
  ])('%i DIVI %i = %i, flags %s', (a, b, result, f) => {
    expect(calc(a, 'DIVI', b, { v: true, c: true })).toMatchObject({ a: result, flags: flags(f) });
  });
  it.each([
    [7, 3, 1],
    [-7, 2, -1],
    [7, -2, 1],
    [-32768, -1, 0],
  ])('%i MODI %i = %i', (a, b, result) => {
    expect(calc(a, 'MODI', b).a).toBe(result);
  });
});

describe('DIVU / MODU (unsigned, N always 0)', () => {
  it.each([
    ['DIVUI', -1, 2, 32767],
    ['MODUI', -1, 2, 1],
    ['DIVUI', 7, -1, 0],
    ['DIVUI', -32768, -1, 0],
    ['MODUI', -32768, -1, 0x8000],
    ['DIVUI', -32768, 1, 0x8000],
  ])('%s: %i, %i → %i', (op, a, b, result) => {
    const r = calc(a, op, b);
    expect(r.ua).toBe(result);
    expect(r.flags.n).toBe(false);
  });
  it('clears a previously set N', () => {
    expect(calc(3, 'DIVUI', 1, { n: true }).flags).toEqual(flags(''));
  });
});

describe('division by zero (own behaviour: halt, nothing changes)', () => {
  it.each(['DIVI', 'MODI', 'DIVUI', 'MODUI'])('%s 0 halts with PC on the instruction', (op) => {
    const r = calc(-7, op, 0, { c: true });
    const s = r.cpu.getState();
    expect(s.halted).toBe('divisionByZero');
    expect(s.pc).toBe(0);
    expect(r.a).toBe(-7);
    expect(r.flags).toEqual(flags('C'));
  });
});

describe('logic instructions clear V and C', () => {
  it.each([
    ['ANDI', 0b1100, 0b1010, 0b1000, ''],
    ['ORI', 0b1100, 0b1010, 0b1110, ''],
    ['XORI', 0b1100, 0b1100, 0, 'Z'],
    ['ORI', 0, -32768, -32768, 'N'],
  ])('%s: %i, %i → %i', (op, a, b, result, f) => {
    expect(calc(a, op, b, { v: true, c: true })).toMatchObject({ a: result, flags: flags(f) });
  });
  it('NOT inverts all bits', () => {
    expect(calc(0, 'NOT', 0, { v: true, c: true })).toMatchObject({ a: -1, flags: flags('N') });
    expect(calc(-1, 'NOT')).toMatchObject({ a: 0, flags: flags('Z') });
  });
});

describe('shifts (count modulo 32, computed on 32 bits)', () => {
  it.each([
    ['SHLI', 5, 0, 5, ''],
    ['SHLI', 3, 1, 6, ''],
    ['SHLI', -32768, 1, 0, 'ZC'],
    ['SHLI', 16384, 1, -32768, 'N'], // sign change does not set V
    ['SHLI', 5, 16, 0, 'ZC'],
    ['SHLI', 5, 17, 0, 'Z'], // bit 16 of 0xA0000 is 0
    ['SHLI', 5, 100, 80, ''], // 100 mod 32 = 4
    ['SHRI', 3, 1, 1, ''], // shifted-out 1 does not set C
    ['SHRI', 1, 1, 0, 'Z'],
    ['SHRI', -1, 16, 0, 'Z'],
    ['SHRAI', -1, 1, -1, 'N'],
    ['SHRAI', -32768, 15, -1, 'N'],
    ['SHRAI', -32768, 16, -1, 'N'],
  ])('%s: %i by %i → %i, flags %s', (op, a, b, result, f) => {
    expect(calc(a, op, b, { v: true })).toMatchObject({ a: result, flags: flags(f) });
  });
  it('SHLI -1 shifts by 31', () => {
    expect(calc(5, 'SHLI', -1).a).toBe(0);
  });
});

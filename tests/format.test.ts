import { describe, expect, it } from 'vitest';
import { formatWord, toBinary16, toHex16, toSigned16, toUnsigned16 } from '../src/core';

describe('toUnsigned16', () => {
  it('keeps values in range', () => {
    expect(toUnsigned16(0)).toBe(0);
    expect(toUnsigned16(65535)).toBe(65535);
  });
  it('wraps negative numbers (two\'s complement)', () => {
    expect(toUnsigned16(-1)).toBe(0xffff);
    expect(toUnsigned16(-32768)).toBe(0x8000);
  });
  it('wraps values above 16 bit', () => {
    expect(toUnsigned16(65536)).toBe(0);
    expect(toUnsigned16(70000)).toBe(4464);
  });
});

describe('toSigned16', () => {
  it('interprets the sign bit', () => {
    expect(toSigned16(0x7fff)).toBe(32767);
    expect(toSigned16(0x8000)).toBe(-32768);
    expect(toSigned16(0xffff)).toBe(-1);
    expect(toSigned16(0)).toBe(0);
  });
  it('is the inverse of toUnsigned16 for signed values', () => {
    for (const v of [-32768, -1, 0, 1, 32767]) {
      expect(toSigned16(toUnsigned16(v))).toBe(v);
    }
  });
});

describe('toHex16 / toBinary16', () => {
  it('formats hex with four digits', () => {
    expect(toHex16(255)).toBe('0x00FF');
    expect(toHex16(-1)).toBe('0xFFFF');
  });
  it('formats binary in nibbles', () => {
    expect(toBinary16(5)).toBe('0000 0000 0000 0101');
    expect(toBinary16(0x8000)).toBe('1000 0000 0000 0000');
  });
});

describe('formatWord', () => {
  it('uses the selected format', () => {
    expect(formatWord(0xffff, 'signed')).toBe('-1');
    expect(formatWord(0xffff, 'unsigned')).toBe('65535');
    expect(formatWord(0xffff, 'hex')).toBe('0xFFFF');
  });
});

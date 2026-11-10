import { describe, expect, it } from 'vitest';
import { formatWord, parseWord, toBinary16, toHex16, toSigned16, toUnsigned16 } from '../src/core';

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

describe('parseWord', () => {
  it('reads decimal, negative and hex numbers', () => {
    expect(parseWord('42')).toBe(42);
    expect(parseWord(' -1 ')).toBe(0xffff);
    expect(parseWord('0x2a')).toBe(42);
    expect(parseWord('65535')).toBe(65535);
    expect(parseWord('-32768')).toBe(0x8000);
  });
  it('rejects invalid input and numbers out of range', () => {
    for (const t of ['', 'abc', '1.5', '0x', '65536', '-32769', '5 6']) {
      expect(parseWord(t), t).toBeNull();
    }
  });
});

describe('parseWord in the hex view (as in the original)', () => {
  it('reads digits as hex even without 0x', () => {
    expect(parseWord('10', true)).toBe(16);
    expect(parseWord('FF', true)).toBe(255);
    expect(parseWord('ffff', true)).toBe(0xffff);
    expect(parseWord('0x2A', true)).toBe(42);
    expect(parseWord('10000', true)).toBeNull();
    expect(parseWord('-5', true)).toBe(0xfffb); // negative decimal still works
    expect(parseWord('FF')).toBeNull(); // other views: decimal
  });
});

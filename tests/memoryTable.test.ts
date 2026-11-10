import { describe, expect, it } from 'vitest';
import { assemble, SP_START } from '../src/core';
import { memoryAsTable } from '../src/ui/memoryTable';

const H = { address: 'Adresse', stack: 'Stack' };

describe('memoryAsTable', () => {
  it('returns null for empty memory', () => {
    expect(memoryAsTable(new Uint16Array(65536), 'signed', false, null, H)).toBeNull();
  });

  it('copies up to the last used cell, 10 per row with address column', () => {
    const m = new Uint16Array(65536);
    m[0] = 5;
    m[12] = 0xffff;
    const r = memoryAsTable(m, 'signed', false, null, H)!;
    expect(r.last).toBe(12);
    expect(r.stack).toBe(false);
    expect(r.text).toBe(
      'Adresse\t+0\t+1\t+2\t+3\t+4\t+5\t+6\t+7\t+8\t+9\n'
      + '0\t5\t0\t0\t0\t0\t0\t0\t0\t0\t0\n'
      + '10\t0\t0\t-1\n');
  });

  it('uses the display format and hex addresses', () => {
    const m = new Uint16Array(65536);
    m[10] = 255;
    const r = memoryAsTable(m, 'hex', true, null, H)!;
    expect(r.text.split('\n')[2]).toBe('0x000A\t0x00FF');
  });

  it('splits instructions like the table does', () => {
    const { memory } = assemble('LOADI 7\nHALT');
    const r = memoryAsTable(memory, 'opcodes', false, null, H)!;
    expect(r.text.split('\n')[1]).toBe('0\tLOADI\t7\tHALT');
  });

  it('adds the used stack as a separate block', () => {
    const m = new Uint16Array(65536);
    m[0] = 1;
    m[SP_START - 1] = 42;
    m[SP_START - 2] = 7;
    const r = memoryAsTable(m, 'signed', false, SP_START - 2, H)!;
    expect(r.stack).toBe(true);
    const lines = r.text.trimEnd().split('\n');
    expect(lines.length).toBe(6); // header, row 0, empty line, "Stack", header, one row
    expect(lines[3]).toBe('Stack');
    expect(lines[5]).toBe('65530\t\t\t7\t42');
  });

  it('ignores an empty stack', () => {
    const m = new Uint16Array(65536);
    m[3] = 1;
    expect(memoryAsTable(m, 'signed', false, SP_START, H)!.stack).toBe(false);
  });
});

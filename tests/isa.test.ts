import { describe, expect, it } from 'vitest';
import { decodeWord1, encodeWord1, INSTRUCTIONS, lookupMnemonic, lookupOpcode } from '../src/core';

describe('instruction table', () => {
  it('has unique opcodes and mnemonics', () => {
    const opcodes = INSTRUCTIONS.map((d) => d.opcode);
    expect(new Set(opcodes).size).toBe(opcodes.length);
    const names = INSTRUCTIONS.flatMap((d) => [d.mnemonic, ...d.aliases, d.immediateMnemonic ?? []].flat());
    expect(new Set(names).size).toBe(names.length);
  });

  it('contains every standard mnemonic from manual 3.4', () => {
    const all = `HOLD HALT RESET NOOP LOAD LOADC STORE ADD SUB MUL DIV DIVU MOD MODU CMP MULH MULHU
      AND OR XOR NOT SHL SHR SHRA JMPP JMPNN JMPN JMPNP JMPZ JMPNZ JMPV JMPC JMP
      JGT JGE JLT JLE JEQ JNE JOV JOC JHI JHS JLO JLS
      ADDI SUBI MULI DIVI DIVUI MODI MODUI CMPI MULHI MULHUI LOADI ANDI ORI XORI SHLI SHRI SHRAI`;
    for (const name of all.split(/\s+/)) {
      expect(lookupMnemonic(name), name).toBeDefined();
    }
  });

  it('accepts lower case', () => {
    expect(lookupMnemonic('jmpnp')?.def.mnemonic).toBe('JMPNP');
    expect(lookupMnemonic('Loadi')?.forcedMode).toBe('immediate');
  });

  it('resolves aliases', () => {
    expect(lookupMnemonic('HOLD')?.def.mnemonic).toBe('HALT');
    expect(lookupMnemonic('JLE')?.def.mnemonic).toBe('JMPNP');
    expect(lookupMnemonic('JOC')?.def.mnemonic).toBe('JMPC');
  });

  it('finds instructions by opcode', () => {
    expect(lookupOpcode(0x14)?.mnemonic).toBe('LOAD');
    expect(lookupOpcode(99)?.mnemonic).toBe('HALT');
    expect(lookupOpcode(2)).toBeUndefined();
  });
});

describe('encoding of word 1 (values measured on the original)', () => {
  const enc = (name: string, mode: Parameters<typeof encodeWord1>[1]) =>
    encodeWord1(lookupMnemonic(name)!.def, mode);

  it('matches the original', () => {
    expect(enc('NOT', 'none')).toBe(0x0038);
    expect(enc('LOAD', 'direct')).toBe(0x0114);
    expect(enc('LOAD', 'immediate')).toBe(0x0214); // = LOADI
    expect(enc('LOAD', 'indirect')).toBe(0x0314);
    expect(enc('ADD', 'immediate')).toBe(0x020a); // = ADDI
    expect(enc('MOD', 'immediate')).toBe(526); // MODI, from screenshot test 6
    expect(enc('JMP', 'direct')).toBe(0x0124);
    expect(enc('NOOP', 'none')).toBe(0);
  });

  it('rejects modes an instruction does not allow', () => {
    expect(() => enc('STORE', 'immediate')).toThrow();
    expect(() => enc('JMP', 'indirect')).toThrow();
    expect(() => enc('NOT', 'direct')).toThrow();
  });

  it('decodes valid words and rejects illegal ones', () => {
    expect(decodeWord1(0x0314)).toMatchObject({ mode: 'indirect', def: { mnemonic: 'LOAD' } });
    expect(decodeWord1(0)).toMatchObject({ mode: 'none', def: { mnemonic: 'NOOP' } });
    expect(decodeWord1(0xffff)).toBeUndefined(); // unknown opcode
    expect(decodeWord1(0x0215)).toBeUndefined(); // STORE immediate
    expect(decodeWord1(0x0914)).toBeUndefined(); // unknown mode
  });
});

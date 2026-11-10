/**
 * Instruction set architecture (ISA) of the Minimaschine.
 *
 * This file is the SINGLE source of truth for mnemonics, aliases, opcodes,
 * operand kinds and flag behaviour. Assembler, disassembler, CPU and the
 * editor help all read from here.
 *
 * Status (M0): only the types are defined. The instruction table is filled in M1.
 */

/**
 * Addressing modes (manual 3.1). The last three exist only in extended mode.
 *
 * | mode            | syntax       | operand                         |
 * |-----------------|--------------|---------------------------------|
 * | direct          | adr          | mem[adr]                        |
 * | indirect        | (adr)        | mem[mem[adr]]                   |
 * | immediate       | $adr         | adr                             |
 * | offset          | adr(SP)      | mem[adr + SP]                   |
 * | offsetIndirect  | @adr(SP)     | mem[mem[adr + SP]]              |
 * | immediateOffset | $adr(SP)     | adr + SP                        |
 */
export type AddressingMode =
  | 'direct'
  | 'indirect'
  | 'immediate'
  | 'offset'
  | 'offsetIndirect'
  | 'immediateOffset';

/** What kind of operand an instruction expects in the source code. */
export type OperandKind =
  /** No operand at all (e.g. NOT, HALT, RTS). */
  | 'none'
  /** A memory address; all addressing modes allowed (e.g. LOAD, ADD). */
  | 'address'
  /** An address used only as a jump target (e.g. JMP, JSR). */
  | 'jumpTarget'
  /** A plain number, written without "$" (e.g. LOADI, ADDI, RSV). */
  | 'number';

/** Which status flags an instruction may change. */
export interface FlagEffect {
  z: boolean;
  n: boolean;
  v: boolean;
  c: boolean;
}

/** Description of one machine instruction. */
export interface InstructionDef {
  /** Canonical upper-case mnemonic, e.g. "JMPNP". */
  mnemonic: string;
  /** Alternative spellings, e.g. ["JLE"]. */
  aliases: readonly string[];
  /** Numeric opcode stored in word 1 (own encoding, see docs/kompatibilitaet.md). */
  opcode: number;
  operand: OperandKind;
  /** True if the instruction is only available in extended mode (stack). */
  extendedOnly: boolean;
  flags: FlagEffect;
  /** Short German description for the editor hover help. */
  descriptionDe: string;
}

/**
 * The complete instruction table.
 * TODO(M1): fill with all instructions from manual 3.4.
 */
export const INSTRUCTIONS: readonly InstructionDef[] = [];

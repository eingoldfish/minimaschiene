/**
 * Disassembler: memory words → readable instruction text
 * (used for the memory view "als Befehle anzeigen").
 *
 * The text uses the same syntax as the assembler, so it can be copied back
 * into the editor (deliberate difference to the original, which shows
 * indirect addressing as "LOAD @ 11"; see docs/kompatibilitaet.md).
 */
import { toSigned16 } from './format';
import { decodeWord1, type AddressingMode } from './isa';

export interface DisassembledInstruction {
  /** False if word 1 is not a valid instruction code. */
  valid: boolean;
  /** e.g. "LOAD (20)", "ADDI -3", "JMP Start", or "---" if invalid. */
  text: string;
  /** Canonical mnemonic (with "…I" short form for immediate), if valid. */
  mnemonic?: string;
  mode?: AddressingMode;
}

/** Optional lookup: address → label name, to show "JMP Start" instead of "JMP 4". */
export type LabelLookup = (address: number) => string | undefined;

/**
 * Turns one instruction (word 1 + word 2) into text.
 * Immediate operands are shown signed ("LOADI -7"), addresses unsigned.
 */
export function disassemble(word1: number, word2: number, labelAt?: LabelLookup): DisassembledInstruction {
  const decoded = decodeWord1(word1);
  if (!decoded) return { valid: false, text: '---' };
  const { def, mode } = decoded;

  const addressText = () => labelAt?.(word2) ?? String(word2);

  switch (mode) {
    case 'none':
      return { valid: true, text: def.mnemonic, mnemonic: def.mnemonic, mode };
    case 'immediate': {
      const name = def.immediateMnemonic ?? def.mnemonic;
      const prefix = def.immediateMnemonic ? '' : '$';
      return { valid: true, text: `${name} ${prefix}${toSigned16(word2)}`, mnemonic: name, mode };
    }
    case 'direct':
      return { valid: true, text: `${def.mnemonic} ${addressText()}`, mnemonic: def.mnemonic, mode };
    case 'indirect':
      return { valid: true, text: `${def.mnemonic} (${addressText()})`, mnemonic: def.mnemonic, mode };
    case 'offset':
      return { valid: true, text: `${def.mnemonic} ${toSigned16(word2)}(SP)`, mnemonic: def.mnemonic, mode };
    case 'offsetIndirect':
      return { valid: true, text: `${def.mnemonic} @${toSigned16(word2)}(SP)`, mnemonic: def.mnemonic, mode };
    case 'immediateOffset':
      return { valid: true, text: `${def.mnemonic} $${toSigned16(word2)}(SP)`, mnemonic: def.mnemonic, mode };
  }
}

/**
 * Disassembles the instruction that contains `address`, pairing words like
 * the original: even address = word 1, odd address = address part of the
 * instruction starting one cell earlier.
 */
export function disassembleAt(
  memory: Uint16Array,
  address: number,
  labelAt?: LabelLookup,
): DisassembledInstruction & { start: number } {
  const start = address & 0xfffe;
  return {
    ...disassemble(memory[start] ?? 0, memory[start + 1] ?? 0, labelAt),
    start,
  };
}

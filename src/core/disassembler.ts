/**
 * Disassembler: memory words → readable instruction text
 * (used for the memory view "als Befehle anzeigen").
 *
 * Status (M0): signature only. Implementation follows in M2.
 */

export interface DisassembledInstruction {
  /** e.g. "LOAD (20)" */
  text: string;
  /** False if word 1 is not a valid opcode. */
  valid: boolean;
}

/** TODO(M2): implement. */
export function disassemble(_word1: number, _word2: number): DisassembledInstruction {
  throw new Error('disassemble() is not implemented yet (M2)');
}

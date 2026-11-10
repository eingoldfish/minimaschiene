/**
 * Assembler: source text → memory image.
 *
 * Takes only plain text, so a later pseudocode compiler (version 2) can simply
 * generate assembler text and reuse this module.
 *
 * Status (M0): types only. Implementation follows in M2.
 */

/** One error found while assembling, with a beginner-friendly German message. */
export interface AssembleError {
  /** 1-based line number in the source. */
  line: number;
  /** 1-based column (start of the problematic token). */
  column: number;
  /** Message in German, e.g. "Die Marke ‚Ende‘ wird benutzt, aber nirgends definiert." */
  message: string;
  /** Optional hint how to fix it, e.g. "Hast du ‚Ende:‘ vergessen?" */
  hint?: string;
}

export interface AssembleResult {
  /** True if there were no errors. */
  ok: boolean;
  /** Full memory image (64K words). */
  memory: Uint16Array;
  errors: AssembleError[];
  /** Label name → address. */
  labels: Map<string, number>;
  /** Source line (1-based) → address of the instruction in that line. */
  lineToAddress: Map<number, number>;
  /** Address → source line (1-based); used to highlight the current line. */
  addressToLine: Map<number, number>;
}

export interface AssembleOptions {
  /** Allow stack instructions and SP addressing modes. */
  extended: boolean;
  /**
   * Existing memory to assemble into ("Assemblieren und Speicher behalten").
   * If omitted, memory starts cleared.
   */
  keepMemory?: Uint16Array;
}

/** TODO(M2): implement. */
export function assemble(_source: string, _options: AssembleOptions): AssembleResult {
  throw new Error('assemble() is not implemented yet (M2)');
}

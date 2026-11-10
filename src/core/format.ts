/**
 * Number formatting for 16-bit machine words.
 *
 * Internally every word is stored as an UNSIGNED 16-bit value (0 … 65535).
 * Whether a word is shown signed, unsigned, hex or binary is purely a matter
 * of presentation and therefore lives here, not in the CPU.
 */

/** Number of bits per machine word. */
export const WORD_BITS = 16;
/** Bit mask for one machine word (0xFFFF). */
export const WORD_MASK = 0xffff;
/** Number of addressable memory cells (64K words). */
export const MEMORY_SIZE = 0x10000;

/**
 * Contents of the two topmost cells after power-on and after clearing memory.
 * As in the original, cells 65534 and 65535 hold −1 (0xFFFF); all other cells hold 0.
 * (Running into them stops the machine with "illegal instruction code".)
 */
export const CLEARED_TOP_VALUE = 0xffff;

/** A freshly cleared memory: all 0, except cells 65534 and 65535 = 0xFFFF (as in the original). */
export function createClearedMemory(): Uint16Array {
  const memory = new Uint16Array(MEMORY_SIZE);
  memory[MEMORY_SIZE - 2] = CLEARED_TOP_VALUE;
  memory[MEMORY_SIZE - 1] = CLEARED_TOP_VALUE;
  return memory;
}

/** True if the cell looks unused: 0, and for the two top cells also their initial 0xFFFF. */
export function isClearedCell(address: number, value: number): boolean {
  return value === 0 || (address >= MEMORY_SIZE - 2 && value === CLEARED_TOP_VALUE);
}

/** How a word should be displayed in the UI. */
export type NumberFormat = 'signed' | 'unsigned' | 'hex' | 'binary';

/**
 * Wraps any integer into the range 0 … 65535 (two's complement truncation).
 * Example: -1 → 65535, 65536 → 0, 70000 → 4464.
 */
export function toUnsigned16(value: number): number {
  // `& WORD_MASK` keeps the lowest 16 bits; it also handles negative numbers
  // correctly because JS bit operators work on 32-bit two's complement ints.
  return Math.trunc(value) & WORD_MASK;
}

/**
 * Interprets a value as a signed 16-bit two's complement number (−32768 … 32767).
 * Example: 65535 → -1, 0x8000 → -32768, 32767 → 32767.
 */
export function toSigned16(value: number): number {
  const u = toUnsigned16(value);
  return u >= 0x8000 ? u - MEMORY_SIZE : u;
}

/** Formats a word as four hex digits with prefix, e.g. 255 → "0x00FF". */
export function toHex16(value: number): string {
  return '0x' + toUnsigned16(value).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formats a word as 16 binary digits, grouped in nibbles for readability,
 * e.g. 5 → "0000 0000 0000 0101".
 */
export function toBinary16(value: number): string {
  const bits = toUnsigned16(value).toString(2).padStart(WORD_BITS, '0');
  return bits.replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * Parses a number typed by the user (e.g. when editing memory):
 * decimal ("42", "-7") or hex ("0x2A"). Returns the unsigned 16-bit value,
 * or null if the text is not a valid number in −32768 … 65535.
 * @param hexDefault true in the hex view: as in the original, the input is
 *        read as hex even without "0x" ("10" = 16, "FF" = 255).
 */
export function parseWord(text: string, hexDefault = false): number | null {
  const t = text.trim();
  let value: number;
  if (hexDefault && /^(0[xX])?[0-9A-Fa-f]+$/.test(t)) {
    value = parseInt(t.replace(/^0[xX]/, ''), 16);
  } else if (/^-?[0-9]+$/.test(t)) {
    value = parseInt(t, 10);
  } else if (/^0[xX][0-9A-Fa-f]+$/.test(t)) {
    value = parseInt(t.slice(2), 16);
  } else {
    return null;
  }
  if (value < -0x8000 || value > WORD_MASK) return null;
  return toUnsigned16(value);
}

/** Formats a word according to the chosen display format. */
export function formatWord(value: number, format: NumberFormat): string {
  switch (format) {
    case 'signed':
      return String(toSigned16(value));
    case 'unsigned':
      return String(toUnsigned16(value));
    case 'hex':
      return toHex16(value);
    case 'binary':
      return toBinary16(value);
  }
}

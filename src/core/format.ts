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

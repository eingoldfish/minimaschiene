/**
 * Memory contents as text: the text of one cell (as shown in the memory
 * table) and the whole used memory as a tab-separated table for copying.
 * No DOM access, so it can be tested directly.
 */
import { disassembleAt, formatWord, isClearedCell, MEMORY_SIZE, SP_START, toHex16 } from '../core';

export type MemoryFormat = 'signed' | 'unsigned' | 'hex' | 'opcodes';

export const CELLS_PER_ROW = 10;

/**
 * Text of one cell as shown in the table. In the format "opcodes" an
 * instruction is split: the first word shows the mnemonic, the second word
 * the address part. `instruction` is the whole disassembled instruction.
 */
export function cellText(memory: Uint16Array, address: number, format: MemoryFormat): { text: string; instruction: string } {
  const word = memory[address] ?? 0;
  if (format !== 'opcodes') return { text: formatWord(word, format), instruction: '' };
  const ins = disassembleAt(memory, address);
  const space = ins.text.indexOf(' ');
  const isWord1 = address === ins.start;
  let text: string;
  if (!ins.valid) text = isWord1 ? '---' : String(word);
  else if (space < 0) text = isWord1 ? ins.text : '';
  else text = isWord1 ? ins.text.slice(0, space) : ins.text.slice(space + 1);
  return { text, instruction: ins.text };
}

/** Last used cell below `below` (cells 65534/65535 with their initial −1 count as unused). */
function lastNonZero(memory: Uint16Array, below: number): number {
  for (let a = below - 1; a >= 0; a--) if (!isClearedCell(a, memory[a] ?? 0)) return a;
  return -1;
}

export interface MemoryTable {
  text: string;
  /** Last copied cell of the main block (-1 if there is none). */
  last: number;
  /** A stack block was added. */
  stack: boolean;
}

/**
 * The memory as a tab-separated table, as displayed: 10 cells per row and an
 * address column, up to the last cell that is not 0.
 *
 * If `sp` is given (extended mode) and the stack is not empty, the stack
 * (cells SP … 65533) follows as a separate block – otherwise copying would
 * produce thousands of empty rows between the program and the stack.
 * Returns null if there is nothing to copy.
 */
export function memoryAsTable(
  memory: Uint16Array,
  format: MemoryFormat,
  hexAddresses: boolean,
  sp: number | null,
  headers: { address: string; stack: string },
): MemoryTable | null {
  const hasStack = sp !== null && sp < SP_START;
  const last = lastNonZero(memory, hasStack ? sp : MEMORY_SIZE);
  // Values above the stack (rare) are copied together with the stack.
  const stackEnd = hasStack ? Math.max(SP_START - 1, lastNonZero(memory, MEMORY_SIZE)) : -1;
  if (last < 0 && !hasStack) return null;

  const addr = (a: number) => (hexAddresses ? toHex16(a) : String(a));
  const header = [headers.address, ...Array.from({ length: CELLS_PER_ROW }, (_, i) => `+${i}`)].join('\t');
  const block = (from: number, to: number): string[] => {
    const lines: string[] = [];
    for (let row = Math.floor(from / CELLS_PER_ROW) * CELLS_PER_ROW; row <= to; row += CELLS_PER_ROW) {
      const cells = [addr(row)];
      for (let i = 0; i < CELLS_PER_ROW && row + i <= to; i++) {
        const a = row + i;
        cells.push(a < from ? '' : cellText(memory, a, format).text);
      }
      lines.push(cells.join('\t'));
    }
    return lines;
  };

  const lines: string[] = [];
  if (last >= 0) lines.push(header, ...block(0, last));
  if (hasStack) {
    if (lines.length) lines.push('');
    lines.push(headers.stack, header, ...block(sp, stackEnd));
  }
  return { text: lines.join('\n') + '\n', last, stack: hasStack };
}

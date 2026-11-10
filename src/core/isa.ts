/**
 * Instruction set architecture (ISA) of the Minimaschine.
 *
 * This file is the SINGLE source of truth for mnemonics, aliases, opcodes,
 * addressing modes and their encoding. Assembler, disassembler, CPU and the
 * editor help all read from here.
 *
 * Encoding (determined on the original, see docs/kompatibilitaet.md):
 *   word 1 = modeCode * 256 + opcode   (high byte = addressing mode, low byte = opcode)
 *   word 2 = address part (0 for instructions without address)
 *
 * Status (M5): standard and extended instruction set, codes measured on the
 * original. Only RSV and REL have own codes (they do not exist in the original).
 */

/**
 * Addressing modes (manual 3.1). The last three exist only in extended mode.
 *
 * | mode            | syntax       | operand                         |
 * |-----------------|--------------|---------------------------------|
 * | none            |              | (instruction has no address)    |
 * | direct          | adr          | mem[adr]                        |
 * | immediate       | $adr         | adr                             |
 * | indirect        | (adr)        | mem[mem[adr]]                   |
 * | offset          | adr(SP)      | mem[adr + SP]                   |
 * | offsetIndirect  | @adr(SP)     | mem[mem[adr + SP]]              |
 * | immediateOffset | $adr(SP)     | adr + SP                        |
 */
export type AddressingMode =
  | 'none'
  | 'direct'
  | 'immediate'
  | 'indirect'
  | 'offset'
  | 'offsetIndirect'
  | 'immediateOffset';

/**
 * Start value of the stack pointer after "Zurücksetzen" (measured on the original, test 3b).
 * The stack grows downwards: PUSH first decreases SP, then writes to Speicher[SP].
 */
export const SP_START = 65534;

/** Numeric code of each addressing mode in the high byte of word 1. */
const MODE_TO_CODE: Partial<Record<AddressingMode, number>> = {
  none: 0,
  direct: 1,
  immediate: 2,
  indirect: 3,
  // measured on the original (test 3b):
  offset: 4,
  offsetIndirect: 5,
  immediateOffset: 6,
};

const CODE_TO_MODE = new Map<number, AddressingMode>(
  Object.entries(MODE_TO_CODE).map(([mode, code]) => [code, mode as AddressingMode]),
);

/** Rough grouping, used e.g. for the editor help and syntax colours. */
export type InstructionGroup = 'memory' | 'arithmetic' | 'logic' | 'jump' | 'control' | 'stack';

/** Description of one machine instruction. */
export interface InstructionDef {
  /** Canonical upper-case mnemonic, e.g. "JMPNP". */
  readonly mnemonic: string;
  /** Alternative spellings, e.g. ["JLE"]. */
  readonly aliases: readonly string[];
  /** Numeric opcode (low byte of word 1). */
  readonly opcode: number;
  /** Addressing modes allowed for this instruction. ['none'] = no address. */
  readonly modes: readonly AddressingMode[];
  /** Short form for immediate mode, e.g. "ADDI" for "ADD $x". */
  readonly immediateMnemonic?: string;
  readonly group: InstructionGroup;
  /** Short German description for the editor hover help. */
  readonly descriptionDe: string;
  /** Which flags are affected, in German. */
  readonly flagsDe: string;
  /** Only available in extended mode (stack pointer). */
  readonly extendedOnly?: boolean;
}

// Frequently used mode lists
const NONE: readonly AddressingMode[] = ['none'];
/** Modes that use the stack pointer (extended mode only). */
export const SP_MODES: readonly AddressingMode[] = ['offset', 'offsetIndirect', 'immediateOffset'];
const DATA: readonly AddressingMode[] = ['direct', 'immediate', 'indirect', 'offset', 'offsetIndirect', 'immediateOffset'];
const STORE_MODES: readonly AddressingMode[] = ['direct', 'indirect', 'offset', 'offsetIndirect'];
const NUMBER: readonly AddressingMode[] = ['immediate'];
const JUMP: readonly AddressingMode[] = ['direct'];

const FLAGS_ARITH = 'Z, N nach dem Ergebnis; V bei Überlauf mit Vorzeichen; C bei Überlauf ohne Vorzeichen';
const FLAGS_ZN = 'Z, N nach dem Ergebnis; V und C werden gelöscht';
const FLAGS_UNSIGNED = 'Z nach dem Ergebnis; N, V und C werden gelöscht';
const FLAGS_NONE = 'keine';

function jump(
  mnemonic: string,
  alias: string | null,
  opcode: number,
  condition: string,
): InstructionDef {
  return {
    mnemonic,
    aliases: alias ? [alias] : [],
    opcode,
    modes: JUMP,
    group: 'jump',
    descriptionDe: `Springt zur angegebenen Adresse, ${condition}.`,
    flagsDe: FLAGS_NONE,
  };
}

/** The complete standard instruction table (manual 3.4, opcodes from the original). */
export const INSTRUCTIONS: readonly InstructionDef[] = [
  // ----- control -----
  { mnemonic: 'NOOP', aliases: [], opcode: 0, modes: NONE, group: 'control',
    descriptionDe: 'Tut nichts.', flagsDe: FLAGS_NONE },
  { mnemonic: 'RESET', aliases: [], opcode: 1, modes: NONE, group: 'control',
    descriptionDe: 'Setzt Akku, Programmzähler und Flags auf 0 und hält die Maschine an. Der Speicher bleibt erhalten.',
    flagsDe: 'alle gelöscht' },
  { mnemonic: 'HALT', aliases: ['HOLD'], opcode: 99, modes: NONE, group: 'control',
    descriptionDe: 'Hält die Maschine an.', flagsDe: FLAGS_NONE },

  // ----- arithmetic -----
  { mnemonic: 'ADD', aliases: [], opcode: 10, modes: DATA, immediateMnemonic: 'ADDI', group: 'arithmetic',
    descriptionDe: 'Addiert den Operanden zum Akku.', flagsDe: FLAGS_ARITH },
  { mnemonic: 'SUB', aliases: [], opcode: 11, modes: DATA, immediateMnemonic: 'SUBI', group: 'arithmetic',
    descriptionDe: 'Subtrahiert den Operanden vom Akku.',
    flagsDe: 'Z, N nach dem Ergebnis; V bei Überlauf mit Vorzeichen; C, wenn Akku < Operand (ohne Vorzeichen)' },
  { mnemonic: 'MUL', aliases: [], opcode: 12, modes: DATA, immediateMnemonic: 'MULI', group: 'arithmetic',
    descriptionDe: 'Multipliziert den Akku mit dem Operanden (untere 16 Bit).',
    flagsDe: 'Z, N nach dem Ergebnis; V, wenn das Produkt mit Vorzeichen nicht passt; C, wenn es ohne Vorzeichen nicht passt' },
  { mnemonic: 'DIV', aliases: [], opcode: 13, modes: DATA, immediateMnemonic: 'DIVI', group: 'arithmetic',
    descriptionDe: 'Dividiert den Akku durch den Operanden (ganzzahlig, Richtung 0 gerundet).', flagsDe: FLAGS_ZN },
  { mnemonic: 'MOD', aliases: [], opcode: 14, modes: DATA, immediateMnemonic: 'MODI', group: 'arithmetic',
    descriptionDe: 'Rest der Division des Akkus durch den Operanden (Vorzeichen wie der Akku).', flagsDe: FLAGS_ZN },
  { mnemonic: 'CMP', aliases: [], opcode: 15, modes: DATA, immediateMnemonic: 'CMPI', group: 'arithmetic',
    descriptionDe: 'Vergleicht den Akku mit dem Operanden (rechnet Akku − Operand), der Akku bleibt unverändert.',
    flagsDe: 'wie SUB' },
  { mnemonic: 'DIVU', aliases: [], opcode: 16, modes: DATA, immediateMnemonic: 'DIVUI', group: 'arithmetic',
    descriptionDe: 'Dividiert den Akku durch den Operanden, beide ohne Vorzeichen.', flagsDe: FLAGS_UNSIGNED },
  { mnemonic: 'MODU', aliases: [], opcode: 17, modes: DATA, immediateMnemonic: 'MODUI', group: 'arithmetic',
    descriptionDe: 'Rest der Division ohne Vorzeichen.', flagsDe: FLAGS_UNSIGNED },
  { mnemonic: 'MULH', aliases: [], opcode: 18, modes: DATA, immediateMnemonic: 'MULHI', group: 'arithmetic',
    descriptionDe: 'Multipliziert mit Vorzeichen und lädt Produkt / 65536 (Richtung 0 gerundet) in den Akku.',
    flagsDe: FLAGS_ZN },
  { mnemonic: 'MULHU', aliases: [], opcode: 19, modes: DATA, immediateMnemonic: 'MULHUI', group: 'arithmetic',
    descriptionDe: 'Multipliziert ohne Vorzeichen und lädt die oberen 16 Bit des Produkts in den Akku.',
    flagsDe: FLAGS_UNSIGNED },

  // ----- memory -----
  { mnemonic: 'LOAD', aliases: [], opcode: 20, modes: DATA, immediateMnemonic: 'LOADI', group: 'memory',
    descriptionDe: 'Lädt den Operanden in den Akku.', flagsDe: FLAGS_ZN },
  { mnemonic: 'STORE', aliases: [], opcode: 21, modes: STORE_MODES, group: 'memory',
    descriptionDe: 'Speichert den Akku an der angegebenen Adresse.', flagsDe: FLAGS_NONE },
  { mnemonic: 'LOADC', aliases: [], opcode: 22, modes: NONE, group: 'memory',
    descriptionDe: 'Lädt das Carry-Flag (1 oder 0) in den Akku.', flagsDe: FLAGS_ZN },

  // ----- jumps (signed / flags) -----
  jump('JMPP', 'JGT', 30, 'wenn das Ergebnis positiv war (> 0, weder N noch Z)'),
  jump('JMPNN', 'JGE', 31, 'wenn das Ergebnis nicht negativ war (≥ 0, N nicht gesetzt)'),
  jump('JMPN', 'JLT', 32, 'wenn das Ergebnis negativ war (< 0, N gesetzt)'),
  jump('JMPNP', 'JLE', 33, 'wenn das Ergebnis nicht positiv war (≤ 0, N oder Z gesetzt)'),
  jump('JMPZ', 'JEQ', 34, 'wenn das Ergebnis 0 war (Z gesetzt)'),
  jump('JMPNZ', 'JNE', 35, 'wenn das Ergebnis nicht 0 war (Z nicht gesetzt)'),
  jump('JMP', null, 36, 'immer'),
  jump('JMPV', 'JOV', 37, 'wenn ein Überlauf mit Vorzeichen auftrat (V gesetzt)'),
  jump('JMPC', 'JOC', 38, 'wenn ein Überlauf ohne Vorzeichen auftrat (C gesetzt)'),
  // ----- jumps (unsigned) -----
  jump('JHI', null, 40, 'wenn ohne Vorzeichen „größer“ (weder C noch Z gesetzt)'),
  jump('JHS', null, 41, 'wenn ohne Vorzeichen „größer oder gleich“ (C nicht gesetzt)'),
  jump('JLO', null, 42, 'wenn ohne Vorzeichen „kleiner“ (C gesetzt)'),
  jump('JLS', null, 43, 'wenn ohne Vorzeichen „kleiner oder gleich“ (C oder Z gesetzt)'),

  // ----- logic / shifts -----
  { mnemonic: 'AND', aliases: [], opcode: 50, modes: DATA, immediateMnemonic: 'ANDI', group: 'logic',
    descriptionDe: 'Bitweises Und von Akku und Operand.', flagsDe: FLAGS_ZN },
  { mnemonic: 'OR', aliases: [], opcode: 51, modes: DATA, immediateMnemonic: 'ORI', group: 'logic',
    descriptionDe: 'Bitweises Oder von Akku und Operand.', flagsDe: FLAGS_ZN },
  { mnemonic: 'XOR', aliases: [], opcode: 52, modes: DATA, immediateMnemonic: 'XORI', group: 'logic',
    descriptionDe: 'Bitweises Exklusiv-Oder von Akku und Operand.', flagsDe: FLAGS_ZN },
  { mnemonic: 'SHL', aliases: [], opcode: 53, modes: DATA, immediateMnemonic: 'SHLI', group: 'logic',
    descriptionDe: 'Schiebt die Bits im Akku um Operand Stellen nach links, rechts kommen Nullen nach.',
    flagsDe: 'Z, N nach dem Ergebnis; V gelöscht; C = zuletzt links herausgeschobenes Bit' },
  { mnemonic: 'SHR', aliases: [], opcode: 54, modes: DATA, immediateMnemonic: 'SHRI', group: 'logic',
    descriptionDe: 'Schiebt die Bits im Akku um Operand Stellen nach rechts, links kommen Nullen nach.',
    flagsDe: FLAGS_ZN },
  { mnemonic: 'SHRA', aliases: [], opcode: 55, modes: DATA, immediateMnemonic: 'SHRAI', group: 'logic',
    descriptionDe: 'Schiebt die Bits im Akku nach rechts, das Vorzeichenbit bleibt erhalten.', flagsDe: FLAGS_ZN },
  { mnemonic: 'NOT', aliases: [], opcode: 56, modes: NONE, group: 'logic',
    descriptionDe: 'Kehrt alle Bits im Akku um.', flagsDe: FLAGS_ZN },

  // ----- extended mode: stack -----
  // JSR, RTS, PUSH, POP: measured on the original (test 3b).
  // RSV, REL: do not exist in the original (point 22) -> own free codes 27 and 28.
  { mnemonic: 'JSR', aliases: ['CALL'], opcode: 5, modes: JUMP, group: 'jump', extendedOnly: true,
    descriptionDe: 'Unterprogramm aufrufen: SP − 1, die Rücksprungadresse (Adresse des nächsten Befehls) kommt auf den Stack, dann Sprung zur angegebenen Adresse.',
    flagsDe: FLAGS_NONE },
  { mnemonic: 'RTS', aliases: ['RETURN'], opcode: 6, modes: NONE, group: 'stack', extendedOnly: true,
    descriptionDe: 'Rücksprung aus einem Unterprogramm: Die Adresse oben auf dem Stack kommt in den Befehlszähler, dann SP + 1.',
    flagsDe: FLAGS_NONE },
  { mnemonic: 'PUSH', aliases: [], opcode: 25, modes: NONE, group: 'stack', extendedOnly: true,
    descriptionDe: 'Legt den Akku auf den Stack: SP − 1, dann Akku → Speicher[SP].', flagsDe: FLAGS_NONE },
  { mnemonic: 'POP', aliases: [], opcode: 26, modes: NONE, group: 'stack', extendedOnly: true,
    descriptionDe: 'Holt den obersten Wert vom Stack in den Akku: Speicher[SP] → Akku, dann SP + 1.', flagsDe: FLAGS_ZN },
  { mnemonic: 'RSV', aliases: [], opcode: 27, modes: NUMBER, immediateMnemonic: 'RSV', group: 'stack', extendedOnly: true,
    descriptionDe: 'Reserviert Platz auf dem Stack: SP − Zahl (z. B. für lokale Variablen).', flagsDe: FLAGS_NONE },
  { mnemonic: 'REL', aliases: [], opcode: 28, modes: NUMBER, immediateMnemonic: 'REL', group: 'stack', extendedOnly: true,
    descriptionDe: 'Gibt Platz auf dem Stack wieder frei: SP + Zahl.', flagsDe: FLAGS_NONE },
];

// ---------- Lookup tables ----------

const BY_OPCODE = new Map<number, InstructionDef>(INSTRUCTIONS.map((d) => [d.opcode, d]));

/** Result of looking up a mnemonic written in source code. */
export interface MnemonicLookup {
  def: InstructionDef;
  /** Set for the "…I" short forms: the mode is fixed to 'immediate'. */
  forcedMode?: AddressingMode;
}

const BY_MNEMONIC = new Map<string, MnemonicLookup>();
for (const def of INSTRUCTIONS) {
  BY_MNEMONIC.set(def.mnemonic, { def });
  for (const alias of def.aliases) BY_MNEMONIC.set(alias, { def });
  if (def.immediateMnemonic) {
    BY_MNEMONIC.set(def.immediateMnemonic, { def, forcedMode: 'immediate' });
  }
}

/** All names (incl. aliases) of instructions that exist only in extended mode. */
export const EXTENDED_MNEMONICS: readonly string[] = INSTRUCTIONS
  .filter((d) => d.extendedOnly)
  .flatMap((d) => [d.mnemonic, ...d.aliases]);

/** Pseudo instruction that reserves one memory cell. */
export const WORD_DIRECTIVE = 'WORD';

/** All names the assembler knows (upper case), e.g. for suggestions on typos. */
export function allMnemonicNames(): string[] {
  return [...BY_MNEMONIC.keys(), WORD_DIRECTIVE];
}

/** True if `name` is reserved and therefore cannot be used as a label. */
export function isReservedName(name: string): boolean {
  const upper = name.toUpperCase();
  return (
    BY_MNEMONIC.has(upper) ||
    EXTENDED_MNEMONICS.includes(upper) ||
    upper === WORD_DIRECTIVE ||
    upper === 'SP'
  );
}

/** Finds an instruction by mnemonic, alias or "…I" short form (case-insensitive). */
export function lookupMnemonic(name: string): MnemonicLookup | undefined {
  return BY_MNEMONIC.get(name.toUpperCase());
}

/** Finds an instruction by its numeric opcode (low byte of word 1). */
export function lookupOpcode(opcode: number): InstructionDef | undefined {
  return BY_OPCODE.get(opcode);
}

// ---------- Encoding of word 1 ----------

/** Builds word 1 from an instruction and an addressing mode. */
export function encodeWord1(def: InstructionDef, mode: AddressingMode): number {
  const code = MODE_TO_CODE[mode];
  if (code === undefined || !def.modes.includes(mode)) {
    throw new Error(`${def.mnemonic} does not support addressing mode '${mode}'`);
  }
  return (code << 8) | def.opcode;
}

/** A successfully decoded word 1. */
export interface DecodedWord1 {
  def: InstructionDef;
  mode: AddressingMode;
}

/**
 * Splits word 1 into instruction and addressing mode.
 * Returns undefined for unknown opcodes, unknown modes, or a mode the
 * instruction does not allow (= illegal instruction code).
 */
export function decodeWord1(word1: number): DecodedWord1 | undefined {
  const def = BY_OPCODE.get(word1 & 0xff);
  const mode = CODE_TO_MODE.get((word1 >> 8) & 0xff);
  if (!def || !mode || !def.modes.includes(mode)) return undefined;
  return { def, mode };
}

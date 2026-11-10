/**
 * Assembler: source text → memory image.
 *
 * Takes only plain text, so a later pseudocode compiler (version 2) can simply
 * generate assembler text and reuse this module.
 *
 * Works in two passes (like most assemblers):
 *   1. Split every line into tokens, parse it, assign addresses and collect labels.
 *   2. Resolve labels and encode the instructions into memory.
 * All errors are collected, so the student sees every problem at once.
 *
 * Syntax (manual 3.3):
 *   Zeile   = [Marke ":"] [Befehl] .      comments start with "#"
 *   Befehl  = Operation [ Adresse | "(" Adresse ")" | "$" Adresse
 *             | Adresse "(SP)" | "@" Adresse "(SP)" | "$" Adresse "(SP)" ] .
 *   Adresse = Marke | Zahl | HexZahl .
 */
import { MEMORY_SIZE, toUnsigned16 } from './format';
import type { Language } from './lang';
import {
  allMnemonicNames,
  encodeWord1,
  isReservedName,
  lookupMnemonic,
  WORD_DIRECTIVE,
  type AddressingMode,
} from './isa';

// ====================================================================
// Public types
// ====================================================================

/** One error found while assembling, with a beginner-friendly message (German or English). */
export interface AssembleError {
  /** 1-based line number in the source. */
  line: number;
  /** 1-based column of the problematic part. */
  column: number;
  /** Length of the problematic part (for underlining in the editor). */
  length: number;
  /** Message, e.g. "Die Marke ‚Ende‘ wird benutzt, aber nirgends festgelegt." */
  message: string;
  /** Optional hint how to fix it, e.g. "Hast du ‚Ende:‘ vergessen?" */
  hint?: string;
}

export interface AssembleResult {
  /** True if there were no errors. */
  ok: boolean;
  /** Full memory image (64K words). Only meaningful if ok is true. */
  memory: Uint16Array;
  errors: AssembleError[];
  /** Label name → address. */
  labels: Map<string, number>;
  /** Source line (1-based) → address of the instruction/WORD in that line. */
  lineToAddress: Map<number, number>;
  /** Address → source line (1-based); both words of an instruction map to its line. */
  addressToLine: Map<number, number>;
  /** First address after the program (= number of words used). */
  size: number;
}

export interface AssembleOptions {
  /** Allow stack instructions and SP addressing modes. */
  extended?: boolean;
  /**
   * Existing memory to assemble into ("Assemblieren und Speicher behalten").
   * If omitted, memory starts cleared.
   */
  keepMemory?: Uint16Array;
  /** Language of the error messages (default: German). */
  lang?: Language;
}

/** Formats an error for display, e.g. "Zeile 4: … Hast du ‚Ende:‘ vergessen?" */
export function formatError(e: AssembleError, lang: Language = 'de'): string {
  return `${lang === 'en' ? 'Line' : 'Zeile'} ${e.line}: ${e.message}${e.hint ? ' ' + e.hint : ''}`;
}

/**
 * Language of the assemble() call that is running right now. assemble() is
 * synchronous, so a module variable is safe and saves passing it everywhere.
 */
let lang: Language = 'de';

/** Picks the text in the current language. */
const tr = (de: string, en: string): string => (lang === 'en' ? en : de);

// ====================================================================
// Pass 0: tokenizer
// ====================================================================

interface Token {
  kind: 'ident' | 'number' | 'symbol';
  text: string;
  /** 1-based column. */
  column: number;
  /** Numeric value for number tokens. */
  value?: number;
}

const LETTERS = 'A-Za-zÄÖÜäöüß';
const IDENT_RE = new RegExp(`[${LETTERS}][${LETTERS}0-9]*`, 'y');
const NUMBER_RE = /0[xX][0-9A-Fa-f]*|[0-9]+/y;
const SYMBOLS = ':()$@-';

/** Splits one line (without comment) into tokens. Returns null on error. */
function tokenize(text: string, line: number, errors: AssembleError[]): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i] ?? '';
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const column = i + 1;

    IDENT_RE.lastIndex = i;
    const ident = IDENT_RE.exec(text);
    if (ident) {
      tokens.push({ kind: 'ident', text: ident[0], column });
      i += ident[0].length;
      continue;
    }

    NUMBER_RE.lastIndex = i;
    const num = NUMBER_RE.exec(text);
    if (num) {
      const t = num[0];
      const isHex = t.length > 1 && (t[1] === 'x' || t[1] === 'X');
      if (isHex && t.length === 2) {
        errors.push({
          line, column, length: 2,
          message: tr('Nach ‚0x‘ fehlen die Hexadezimalziffern.', 'The hex digits after ‘0x’ are missing.'),
          hint: tr('Beispiel: ‚0x1F‘.', 'Example: ‘0x1F’.'),
        });
        return null;
      }
      // A number directly followed by letters, e.g. "1abc": probably a wrong label name.
      IDENT_RE.lastIndex = i + t.length;
      const glued = IDENT_RE.exec(text);
      if (glued) {
        const word = t + glued[0];
        errors.push({
          line, column, length: word.length,
          message: tr(`‚${word}‘ ist kein gültiger Name.`, `‘${word}’ is not a valid name.`),
          hint: tr('Marken müssen mit einem Buchstaben beginnen, z. B. ‚Wert1‘.', 'Labels must start with a letter, e.g. ‘value1’.'),
        });
        return null;
      }
      tokens.push({ kind: 'number', text: t, column, value: isHex ? parseInt(t.slice(2), 16) : parseInt(t, 10) });
      i += t.length;
      continue;
    }

    if (SYMBOLS.includes(ch)) {
      tokens.push({ kind: 'symbol', text: ch, column });
      i++;
      continue;
    }

    let hint: string | undefined;
    if (ch === ';' || (ch === '/' && text[i + 1] === '/')) {
      hint = tr('Kommentare beginnen mit ‚#‘.', 'Comments start with ‘#’.');
    } else if ('+*/'.includes(ch)) {
      hint = tr('In einer Adresse kann man nicht rechnen. Benutze dafür Befehle wie ‚ADDI‘ oder ‚MULI‘.',
        'You cannot calculate inside an address. Use instructions like ‘ADDI’ or ‘MULI’ instead.');
    }
    errors.push({ line, column, length: 1, message: tr(`Das Zeichen ‚${ch}‘ ist hier nicht erlaubt.`, `The character ‘${ch}’ is not allowed here.`), hint });
    return null;
  }
  return tokens;
}

// ====================================================================
// Pass 1a: parser (one line)
// ====================================================================

/** Operand syntax as written in the source (before checking the instruction). */
type OperandSyntax =
  | 'plain' // adr
  | 'indirect' // (adr)
  | 'immediate' // $adr
  | 'offset' // adr(SP)
  | 'offsetIndirect' // @adr(SP)
  | 'immediateOffset'; // $adr(SP)

type OperandValue =
  | { kind: 'number'; value: number; negative: boolean }
  | { kind: 'label'; name: string };

interface Operand {
  syntax: OperandSyntax;
  value: OperandValue;
  column: number;
  length: number;
  text: string;
}

interface ParsedLine {
  line: number;
  label?: { name: string; column: number };
  op?: { name: string; column: number; operand?: Operand };
}

class LineParser {
  private p = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly line: number,
    private readonly lineText: string,
    private readonly errors: AssembleError[],
  ) {}

  parse(): ParsedLine | null {
    const t = this.tokens;
    const result: ParsedLine = { line: this.line };
    if (t.length === 0) return result;

    // ----- optional label -----
    const first = t[0]!;
    if (t[1]?.text === ':') {
      if (first.kind !== 'ident') {
        return this.fail(first, tr(`‚${first.text}‘ ist keine gültige Marke.`, `‘${first.text}’ is not a valid label.`),
          tr('Eine Marke muss mit einem Buchstaben beginnen, z. B. ‚Schleife1:‘.', 'A label must start with a letter, e.g. ‘loop1:’.'));
      }
      result.label = { name: first.text, column: first.column };
      this.p = 2;
    } else if (first.text === ':') {
      return this.fail(first, tr('Vor dem Doppelpunkt fehlt der Name der Marke.', 'The label name is missing before the colon.'));
    }
    if (this.atEnd()) return result;

    // ----- operation -----
    const opTok = this.next();
    if (opTok.kind !== 'ident') {
      return this.fail(opTok, tr(`Hier wird ein Befehl erwartet, aber da steht ‚${opTok.text}‘.`, `An instruction is expected here, but there is ‘${opTok.text}’.`),
        tr('Eine Zeile beginnt mit einer Marke (z. B. ‚Start:‘) oder einem Befehl (z. B. ‚LOAD 20‘).',
          'A line starts with a label (e.g. ‘start:’) or an instruction (e.g. ‘LOAD 20’).'));
    }
    if (this.peek()?.text === ':') {
      return this.fail(this.peek()!, tr('In einer Zeile darf nur eine Marke stehen.', 'Only one label is allowed per line.'));
    }
    result.op = { name: opTok.text, column: opTok.column };
    if (this.atEnd()) return result;

    // ----- operand -----
    const operand = this.parseOperand();
    if (!operand) return null;
    result.op.operand = operand;

    if (!this.atEnd()) {
      const extra = this.peek()!;
      return this.fail(extra, tr(`Nach der Adresse steht noch ‚${this.rest(extra)}‘ – das ist zu viel.`,
        `After the address there is still ‘${this.rest(extra)}’ – that is too much.`),
        tr('Pro Zeile ist nur ein Befehl mit einer Adresse erlaubt. Kommentare beginnen mit ‚#‘.',
          'Only one instruction with one address is allowed per line. Comments start with ‘#’.'));
    }
    return result;
  }

  private parseOperand(): Operand | null {
    const start = this.peek()!;
    let syntax: OperandSyntax;
    let value: OperandValue | null;

    if (start.text === '(') {
      this.next();
      value = this.parseAddress();
      if (!value || !this.expect(')', tr('Die schließende Klammer ‚)‘ fehlt.', 'The closing bracket ‘)’ is missing.'))) return null;
      syntax = 'indirect';
    } else if (start.text === '$') {
      this.next();
      value = this.parseAddress();
      if (!value) return null;
      if (this.peek()?.text === '(') {
        if (!this.parseSpSuffix()) return null;
        syntax = 'immediateOffset';
      } else {
        syntax = 'immediate';
      }
    } else if (start.text === '@') {
      this.next();
      value = this.parseAddress();
      if (!value) return null;
      if (this.peek()?.text !== '(') {
        return this.fail(this.peek() ?? start, tr('‚@‘ gibt es nur in der Form ‚@Adresse(SP)‘.', '‘@’ only exists in the form ‘@address(SP)’.'),
          tr('Für indirekte Adressierung schreibt man ‚(Adresse)‘, z. B. ‚LOAD (20)‘.', 'For indirect addressing write ‘(address)’, e.g. ‘LOAD (20)’.'));
      }
      if (!this.parseSpSuffix()) return null;
      syntax = 'offsetIndirect';
    } else {
      value = this.parseAddress();
      if (!value) return null;
      if (this.peek()?.text === '(') {
        if (!this.parseSpSuffix()) return null;
        syntax = 'offset';
      } else {
        syntax = 'plain';
      }
    }

    const last = this.tokens[this.p - 1]!;
    const end = last.column - 1 + last.text.length;
    return {
      syntax,
      value,
      column: start.column,
      length: end - start.column + 1,
      text: this.lineText.slice(start.column - 1, end),
    };
  }

  /** Adresse = Marke | Zahl | HexZahl, optionally with a leading minus. */
  private parseAddress(): OperandValue | null {
    const tok = this.peek();
    if (!tok) {
      return this.fail(this.tokens[this.p - 1]!, tr('Hier fehlt eine Adresse (Zahl oder Marke).', 'An address (number or label) is missing here.'));
    }
    if (tok.text === '-') {
      this.next();
      const num = this.peek();
      if (num?.kind !== 'number') {
        return this.fail(num ?? tok, tr('Nach dem Minuszeichen muss eine Zahl stehen.', 'A number must follow the minus sign.'));
      }
      this.next();
      return { kind: 'number', value: num.value ?? 0, negative: true };
    }
    if (tok.kind === 'number') {
      this.next();
      return { kind: 'number', value: tok.value ?? 0, negative: false };
    }
    if (tok.kind === 'ident') {
      this.next();
      return { kind: 'label', name: tok.text };
    }
    return this.fail(tok, tr(`Hier wird eine Zahl oder Marke erwartet, aber da steht ‚${tok.text}‘.`, `A number or label is expected here, but there is ‘${tok.text}’.`));
  }

  /** Parses "(SP)". */
  private parseSpSuffix(): boolean {
    const open = this.next(); // "("
    const sp = this.peek();
    if (sp?.kind !== 'ident' || sp.text.toUpperCase() !== 'SP') {
      this.fail(sp ?? open, tr('Nach einer Adresse ist nur ‚(SP)‘ erlaubt.', 'Only ‘(SP)’ is allowed after an address.'),
        tr('Für indirekte Adressierung schreibt man die Klammern um die ganze Adresse: ‚(20)‘.',
          'For indirect addressing put the brackets around the whole address: ‘(20)’.'));
      return false;
    }
    this.next();
    return this.expect(')', tr('Die schließende Klammer ‚)‘ fehlt.', 'The closing bracket ‘)’ is missing.'));
  }

  private expect(symbol: string, message: string): boolean {
    const tok = this.peek();
    if (tok?.text === symbol) {
      this.next();
      return true;
    }
    this.fail(tok ?? this.tokens[this.p - 1]!, message);
    return false;
  }

  private peek(): Token | undefined {
    return this.tokens[this.p];
  }

  private next(): Token {
    const tok = this.tokens[this.p]!;
    this.p++;
    return tok;
  }

  private atEnd(): boolean {
    return this.p >= this.tokens.length;
  }

  private rest(from: Token): string {
    return this.lineText.slice(from.column - 1).trim();
  }

  private fail(tok: Token, message: string, hint?: string): null {
    this.errors.push({ line: this.line, column: tok.column, length: tok.text.length, message, hint });
    return null;
  }
}

// ====================================================================
// Helpers for error messages
// ====================================================================

/**
 * Edit distance between two strings (for "did you mean …?").
 * Counts insert, delete, replace and swapping two neighbouring letters
 * ("LAOD" → "LOAD") as one change each (optimal string alignment distance).
 */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => d[i]![j]!;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      d[i]![j] = best;
    }
  }
  return at(a.length, b.length);
}

/** Closest candidate with at most 2 changes (and not shorter than 3 letters), if any. */
function closest(name: string, candidates: Iterable<string>): string | undefined {
  if (name.length < 3) return undefined;
  let best: string | undefined;
  let bestDist = 3;
  for (const candidate of candidates) {
    const d = editDistance(name, candidate);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}

/** Closest known mnemonic, if it is similar enough. */
function suggestMnemonic(name: string): string | undefined {
  return closest(name.toUpperCase(), allMnemonicNames());
}

const SYNTAX_EXAMPLES: Record<Language, Record<OperandSyntax, string>> = {
  de: {
    plain: 'Adresse',
    indirect: '(Adresse)',
    immediate: '$Zahl',
    offset: 'Adresse(SP)',
    offsetIndirect: '@Adresse(SP)',
    immediateOffset: '$Adresse(SP)',
  },
  en: {
    plain: 'address',
    indirect: '(address)',
    immediate: '$number',
    offset: 'address(SP)',
    offsetIndirect: '@address(SP)',
    immediateOffset: '$address(SP)',
  },
};

/** How an operand form is written, e.g. "(Adresse)", in the current language. */
const syntaxExample = (syntax: OperandSyntax) => SYNTAX_EXAMPLES[lang][syntax];

// ====================================================================
// The assembler
// ====================================================================

interface Item {
  parsed: ParsedLine;
  op: NonNullable<ParsedLine['op']>;
  address: number;
}

export function assemble(source: string, options: AssembleOptions = {}): AssembleResult {
  lang = options.lang ?? 'de';
  const errors: AssembleError[] = [];
  const labels = new Map<string, number>();
  const labelLines = new Map<string, number>();
  const lineToAddress = new Map<number, number>();
  const addressToLine = new Map<number, number>();
  const memory = options.keepMemory ? options.keepMemory.slice() : new Uint16Array(MEMORY_SIZE);

  // ----- pass 1: parse lines, assign addresses, collect labels -----
  const items: Item[] = [];
  let address = 0;
  let overflowReported = false;
  const lines = source.split(/\r\n|\r|\n/);

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const hash = rawLine.indexOf('#');
    const text = hash >= 0 ? rawLine.slice(0, hash) : rawLine;
    const tokens = tokenize(text, lineNo, errors);
    if (!tokens) return;
    const parsed = new LineParser(tokens, lineNo, text, errors).parse();
    if (!parsed) return;

    if (parsed.label) {
      const { name, column } = parsed.label;
      if (isReservedName(name)) {
        errors.push({
          line: lineNo, column, length: name.length,
          message: tr(`‚${name}‘ ist ein Befehlsname und kann nicht als Marke benutzt werden.`,
            `‘${name}’ is an instruction name and cannot be used as a label.`),
          hint: tr(`Wähle einen anderen Namen, z. B. ‚${name}1‘ oder ‚Wert‘.`, `Choose another name, e.g. ‘${name}1’ or ‘value’.`),
        });
      } else if (labels.has(name)) {
        errors.push({
          line: lineNo, column, length: name.length,
          message: tr(`Die Marke ‚${name}‘ wurde schon in Zeile ${labelLines.get(name)} festgelegt.`,
            `The label ‘${name}’ was already defined in line ${labelLines.get(name)}.`),
          hint: tr('Jede Marke darf nur einmal mit Doppelpunkt vorkommen.', 'Each label may be defined (with a colon) only once.'),
        });
      } else {
        labels.set(name, address);
        labelLines.set(name, lineNo);
      }
    }

    if (parsed.op) {
      items.push({ parsed, op: parsed.op, address });
      address += parsed.op.name.toUpperCase() === WORD_DIRECTIVE ? 1 : 2;
      if (address > MEMORY_SIZE && !overflowReported) {
        overflowReported = true;
        errors.push({
          line: lineNo, column: parsed.op.column, length: parsed.op.name.length,
          message: tr('Das Programm passt nicht mehr in den Speicher (65536 Zellen).', 'The program does not fit into memory (65536 cells).'),
        });
      }
    }
  });

  // ----- pass 2: resolve labels and encode -----
  const err = (line: number, column: number, length: number, message: string, hint?: string) =>
    errors.push({ line, column, length, message, hint });

  /** Turns an operand value into a 16-bit word, reporting errors. */
  const resolve = (item: Item, operand: Operand, allowNegative: boolean): number => {
    const line = item.parsed.line;
    const v = operand.value;
    if (v.kind === 'label') {
      const addr = labels.get(v.name);
      if (addr !== undefined) return addr;
      const sameLetters = [...labels.keys()].find((l) => l.toLowerCase() === v.name.toLowerCase());
      const typo = sameLetters ? undefined : closest(v.name, [...labels.keys()]);
      err(line, operand.column, operand.length,
        tr(`Die Marke ‚${v.name}‘ wird benutzt, aber nirgends festgelegt.`, `The label ‘${v.name}’ is used but never defined.`),
        sameLetters
          ? tr(`Meintest du ‚${sameLetters}‘? Bei Marken wird zwischen Groß- und Kleinschreibung unterschieden.`,
            `Did you mean ‘${sameLetters}’? Labels are case-sensitive.`)
          : typo
            ? tr(`Meintest du ‚${typo}‘? Oder hast du ‚${v.name}:‘ vergessen?`, `Did you mean ‘${typo}’? Or did you forget ‘${v.name}:’?`)
            : tr(`Hast du ‚${v.name}:‘ vergessen?`, `Did you forget ‘${v.name}:’?`));
      return 0;
    }
    const n = v.negative ? -v.value : v.value;
    if (v.negative && !allowNegative) {
      err(line, operand.column, operand.length,
        tr(`Eine Adresse kann nicht negativ sein (‚${operand.text}‘).`, `An address cannot be negative (‘${operand.text}’).`),
        tr('Adressen gehen von 0 bis 65535. Negative Zahlen gehen nur bei Zahlen-Befehlen wie ‚LOADI -5‘ oder ‚WORD -5‘.',
          'Addresses go from 0 to 65535. Negative numbers only work with number instructions like ‘LOADI -5’ or ‘WORD -5’.'));
      return 0;
    }
    // Note: plain "-" (not "−") so students can copy the numbers into the editor.
    if (allowNegative && (n < -32768 || n > 65535)) {
      err(line, operand.column, operand.length,
        tr(`Die Zahl ${n} passt nicht in eine Speicherzelle.`, `The number ${n} does not fit into a memory cell.`),
        tr('Erlaubt sind Zahlen von -32768 bis 65535.', 'Allowed are numbers from -32768 to 65535.'));
      return 0;
    }
    if (!allowNegative && n > 65535) {
      err(line, operand.column, operand.length,
        tr(`Die Adresse ${n} gibt es nicht.`, `The address ${n} does not exist.`),
        tr('Adressen gehen von 0 bis 65535.', 'Addresses go from 0 to 65535.'));
      return 0;
    }
    return toUnsigned16(n);
  };

  for (const item of items) {
    const { op } = item;
    const line = item.parsed.line;
    const operand = op.operand;
    const upper = op.name.toUpperCase();

    // ----- WORD: reserve one cell with an initial value -----
    if (upper === WORD_DIRECTIVE) {
      if (!operand) {
        err(line, op.column, op.name.length, tr('‚WORD‘ braucht einen Wert.', '‘WORD’ needs a value.'),
          tr('Beispiel: ‚Zähler: WORD 0‘.', 'Example: ‘counter: WORD 0’.'));
        continue;
      }
      if (operand.syntax !== 'plain') {
        err(line, operand.column, operand.length, tr('Nach ‚WORD‘ steht nur eine Zahl oder Marke, ohne ‚$‘, ‚@‘ oder Klammern.',
          '‘WORD’ is followed by just a number or label, without ‘$’, ‘@’ or brackets.'));
        continue;
      }
      memory[item.address] = resolve(item, operand, true);
      lineToAddress.set(line, item.address);
      addressToLine.set(item.address, line);
      continue;
    }

    // ----- look up the instruction -----
    const found = lookupMnemonic(op.name);
    if (!found) {
      const suggestion = suggestMnemonic(op.name);
      const hint = suggestion
        ? tr(`Meintest du ‚${suggestion}‘?`, `Did you mean ‘${suggestion}’?`)
        : !operand
          ? tr(`Soll ‚${op.name}‘ eine Marke sein? Dann fehlt der Doppelpunkt: ‚${op.name}:‘.`,
            `Is ‘${op.name}’ meant to be a label? Then the colon is missing: ‘${op.name}:’.`)
          : undefined;
      err(line, op.column, op.name.length, tr(`‚${op.name}‘ ist kein bekannter Befehl.`, `‘${op.name}’ is not a known instruction.`), hint);
      continue;
    }
    const { def, forcedMode } = found;
    if (def.extendedOnly && !options.extended) {
      err(line, op.column, op.name.length,
        tr(`Den Befehl ‚${op.name}‘ gibt es nur im erweiterten Modus.`, `The instruction ‘${op.name}’ only exists in extended mode.`),
        tr('Schalte „Erweiterter Modus“ ein, um Stackbefehle zu benutzen.', 'Switch on “Extended mode” to use stack instructions.'));
      continue;
    }
    const needsAddress = !def.modes.includes('none');

    // ----- operand present / missing? -----
    if (!needsAddress && operand) {
      err(line, operand.column, operand.length,
        tr(`‚${op.name}‘ braucht keine Adresse.`, `‘${op.name}’ does not need an address.`),
        tr(`Lösche ‚${operand.text}‘.`, `Delete ‘${operand.text}’.`));
      continue;
    }
    if (needsAddress && !operand) {
      err(line, op.column, op.name.length,
        forcedMode
          ? tr(`Nach ‚${op.name}‘ fehlt eine Zahl.`, `A number is missing after ‘${op.name}’.`)
          : tr(`Nach ‚${op.name}‘ fehlt eine Adresse.`, `An address is missing after ‘${op.name}’.`),
        forcedMode
          ? tr(`Beispiel: ‚${op.name} 5‘.`, `Example: ‘${op.name} 5’.`)
          : tr(`Beispiel: ‚${op.name} 20‘ oder ‚${op.name} Marke‘.`, `Example: ‘${op.name} 20’ or ‘${op.name} label’.`));
      continue;
    }

    // ----- determine addressing mode -----
    let mode: AddressingMode = 'none';
    let word2 = 0;
    if (operand) {
      if (forcedMode) {
        if (operand.syntax !== 'plain') {
          err(line, operand.column, operand.length,
            tr(`‚${op.name}‘ erwartet nur eine Zahl, ohne ‚$‘, ‚@‘ oder Klammern.`, `‘${op.name}’ expects just a number, without ‘$’, ‘@’ or brackets.`),
            def.immediateMnemonic === def.mnemonic
              ? tr(`Schreibe z. B. ‚${op.name} 5‘.`, `Write e.g. ‘${op.name} 5’.`)
              : tr(`Schreibe z. B. ‚${op.name} 5‘. ‚${def.mnemonic} ${syntaxExample(operand.syntax)}‘ wäre die Form ohne ‚I‘.`,
                `Write e.g. ‘${op.name} 5’. ‘${def.mnemonic} ${syntaxExample(operand.syntax)}’ would be the form without ‘I’.`));
          continue;
        }
        mode = forcedMode;
      } else if (!options.extended && (operand.syntax === 'offset' || operand.syntax === 'offsetIndirect' || operand.syntax === 'immediateOffset')) {
        err(line, operand.column, operand.length,
          tr(`Die Adressierung ‚${syntaxExample(operand.syntax)}‘ gibt es nur im erweiterten Modus.`,
            `The addressing ‘${syntaxExample(operand.syntax)}’ only exists in extended mode.`),
          tr('Schalte „Erweiterter Modus“ ein, um den Stackpointer zu benutzen.', 'Switch on “Extended mode” to use the stack pointer.'));
        continue;
      } else {
        mode = operand.syntax === 'plain' ? 'direct' : operand.syntax;
      }

      if (!def.modes.includes(mode)) {
        let hint: string | undefined;
        if (def.group === 'jump') {
          hint = tr(`Sprungbefehle brauchen eine direkte Adresse: ‚${op.name} 20‘ oder ‚${op.name} Marke‘.`,
            `Jump instructions need a direct address: ‘${op.name} 20’ or ‘${op.name} label’.`);
        } else if (def.mnemonic === 'STORE' && mode === 'immediate') {
          hint = tr('STORE schreibt in eine Speicherzelle – lass das ‚$‘ weg.', 'STORE writes into a memory cell – leave out the ‘$’.');
        }
        err(line, operand.column, operand.length,
          tr(`‚${op.name}‘ kann nicht mit ‚${syntaxExample(operand.syntax)}‘ benutzt werden.`,
            `‘${op.name}’ cannot be used with ‘${syntaxExample(operand.syntax)}’.`), hint);
        continue;
      }
      // Negative numbers are allowed for immediate operands and SP offsets (e.g. "LOAD -1(SP)").
      word2 = resolve(item, operand, mode !== 'direct' && mode !== 'indirect');
    }

    memory[item.address] = encodeWord1(def, mode);
    memory[(item.address + 1) & 0xffff] = word2;
    lineToAddress.set(line, item.address);
    addressToLine.set(item.address, line);
    addressToLine.set((item.address + 1) & 0xffff, line);
  }

  errors.sort((a, b) => a.line - b.line || a.column - b.column);
  return {
    ok: errors.length === 0,
    memory,
    errors,
    labels,
    lineToAddress,
    addressToLine,
    size: Math.min(address, MEMORY_SIZE),
  };
}

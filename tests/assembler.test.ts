import { describe, expect, it } from 'vitest';
import { assemble, Cpu, formatError, MEMORY_SIZE, toSigned16, type AssembleResult } from '../src/core';
import { ins } from './helpers';

/** Example program from manual 3.2, verbatim. */
const MANUAL_EXAMPLE = `# Algorithmus, um ein Produkt mittels wiederholter Addition zu berechen.
LOADI 0
STORE Produkt # Ergebnis vorbesetzen
Start: # Start der Wiederholung
LOAD Faktor1
JMPNP Ende # Beenden, wenn der Zähler kleiner als 0 geworden ist
SUBI 1 # Zähler erniedrigen
STORE Faktor1
LOAD Produkt
ADD Faktor2
STORE Produkt # Ergebnis erhöhen
JMP Start
Ende:
HALT # Maschine anhalten
# Datenteil
Faktor1: WORD 5 # Der erste Faktor dient als Zähler für die Wiederholung der Addition
Faktor2: WORD 4 # Der zweite Faktor wird fortwährend addiert
Produkt: WORD 0 # Platz für das Ergebnis
`;

/** Assembles and fails the test with readable messages if there are errors. */
function ok(source: string): AssembleResult {
  const r = assemble(source);
  expect(r.errors.map(formatError)).toEqual([]);
  return r;
}

/** The two words at an address. */
const words = (r: AssembleResult, addr: number) => [r.memory[addr], r.memory[addr + 1]];

describe('example program from the manual', () => {
  const r = ok(MANUAL_EXAMPLE);

  it('places labels like the hand-coded version', () => {
    expect(Object.fromEntries(r.labels)).toEqual({
      Start: 4, Ende: 20, Faktor1: 22, Faktor2: 23, Produkt: 24,
    });
    expect(r.size).toBe(25);
  });

  it('encodes the instructions', () => {
    expect(words(r, 0)).toEqual(ins('LOADI', 0));
    expect(words(r, 2)).toEqual(ins('STORE', 24));
    expect(words(r, 6)).toEqual(ins('JMPNP', 20));
    expect(words(r, 18)).toEqual(ins('JMP', 4));
    expect(words(r, 20)).toEqual(ins('HALT'));
    expect([r.memory[22], r.memory[23], r.memory[24]]).toEqual([5, 4, 0]);
  });

  it('maps lines and addresses', () => {
    expect(r.lineToAddress.get(2)).toBe(0); // LOADI 0
    expect(r.lineToAddress.get(5)).toBe(4); // LOAD Faktor1 (after "Start:")
    expect(r.lineToAddress.has(4)).toBe(false); // label-only line
    expect(r.addressToLine.get(20)).toBe(14); // HALT
    expect(r.addressToLine.get(21)).toBe(14); // its address part
    expect(r.addressToLine.get(24)).toBe(18); // Produkt
  });

  it('runs and computes 5 * 4 = 20', () => {
    const cpu = new Cpu();
    cpu.loadMemory(r.memory);
    expect(cpu.run(10_000).reason).toBe('halt');
    expect(cpu.getState().memory[r.labels.get('Produkt')!]).toBe(20);
  });
});

describe('syntax', () => {
  it('accepts mnemonics in any case and aliases', () => {
    const r = ok('load 5\nLoad 5\nHOLD\nhalt');
    expect(words(r, 0)).toEqual(words(r, 2));
    expect(words(r, 4)).toEqual(words(r, 6));
  });

  it('encodes all standard addressing modes', () => {
    const r = ok('LOAD 11\nLOAD $11\nLOAD (11)\nLOADI 11');
    expect(r.memory[0]).toBe(0x0114);
    expect(r.memory[2]).toBe(0x0214);
    expect(r.memory[4]).toBe(0x0314);
    expect(r.memory[6]).toBe(0x0214);
    expect(r.memory[1]).toBe(11);
  });

  it('treats ADD $5 and ADDI 5 the same', () => {
    const r = ok('ADD $5\nADDI 5');
    expect(words(r, 0)).toEqual(words(r, 2));
  });

  it('reads hex numbers', () => {
    const r = ok('LOADI 0x1F\nLOAD 0XfF');
    expect(r.memory[1]).toBe(31);
    expect(r.memory[3]).toBe(255);
  });

  it('allows negative numbers for immediate and WORD', () => {
    const r = ok('LOADI -7\nADD $-1\nx: WORD -32768');
    expect(toSigned16(r.memory[1]!)).toBe(-7);
    expect(toSigned16(r.memory[3]!)).toBe(-1);
    expect(toSigned16(r.memory[4]!)).toBe(-32768);
  });

  it('WORD and LOADI accept labels (value = address)', () => {
    const r = ok('LOADI Feld\nzeiger: WORD Feld\nFeld: WORD 1');
    expect(r.memory[1]).toBe(3);
    expect(r.memory[2]).toBe(3);
  });

  it('allows umlauts and digits in labels', () => {
    const r = ok('Zähler1: WORD 3\nÄußeresß: LOAD Zähler1');
    expect(r.labels.get('Zähler1')).toBe(0);
    expect(r.labels.get('Äußeresß')).toBe(1);
  });

  it('ignores comments, blank lines, tabs and Windows line endings', () => {
    const r = ok('# nur Kommentar\r\n\r\n\tLOADI\t5   # Kommentar\r\n   \r\nHALT');
    expect(r.size).toBe(4);
    expect(r.lineToAddress.get(3)).toBe(0);
    expect(r.lineToAddress.get(5)).toBe(2);
  });

  it('allows a label before the instruction and a space before the colon', () => {
    const r = ok('a : LOADI 1\nb: HALT');
    expect(r.labels.get('a')).toBe(0);
    expect(r.labels.get('b')).toBe(2);
  });

  it('allows forward and backward references', () => {
    const r = ok('JMP vorne\nhinten: HALT\nvorne: JMP hinten');
    expect(r.memory[1]).toBe(4);
    expect(r.memory[5]).toBe(2);
  });

  it('accepts an empty program', () => {
    expect(ok('').size).toBe(0);
  });
});

describe('memory handling', () => {
  it('"Assemblieren" clears the memory first', () => {
    const old = new Uint16Array(MEMORY_SIZE);
    old[100] = 42;
    const r = assemble('HALT'); // no keepMemory
    expect(r.memory[100]).toBe(0);
    expect(old[100]).toBe(42);
  });

  it('"Assemblieren und Speicher behalten" keeps other cells', () => {
    const old = new Uint16Array(MEMORY_SIZE);
    old[100] = 42;
    old[0] = 999;
    const r = assemble('HALT', { keepMemory: old });
    expect(r.memory[100]).toBe(42);
    expect(r.memory[0]).toBe(0x0063); // overwritten by HALT
    expect(old[0]).toBe(999); // input is not modified
  });
});

describe('error messages', () => {
  /** Returns the errors as "line:column message hint" strings. */
  const errs = (source: string, extended = false) =>
    assemble(source, { extended }).errors.map((e) => `${e.line}:${e.column} ${e.message} ${e.hint ?? ''}`.trim());

  it('undefined label (example from the project instructions)', () => {
    const r = assemble('LOADI 1\nJMP Ende\nHALT');
    expect(r.ok).toBe(false);
    expect(formatError(r.errors[0]!)).toBe(
      'Zeile 2: Die Marke ‚Ende‘ wird benutzt, aber nirgends festgelegt. Hast du ‚Ende:‘ vergessen?',
    );
    expect(r.errors[0]).toMatchObject({ column: 5, length: 4 });
  });

  it('suggests a similar label for typos', () => {
    expect(errs('Schleife: JMP Schleifex')[0]).toBe(
      '1:15 Die Marke ‚Schleifex‘ wird benutzt, aber nirgends festgelegt. Meintest du ‚Schleife‘? Oder hast du ‚Schleifex:‘ vergessen?',
    );
    expect(errs('Start: JMP Ende')[0]).toMatch(/Hast du ‚Ende:‘ vergessen\?$/); // not similar
  });

  it('suggests a label that differs only in case', () => {
    expect(errs('ende: HALT\nJMP Ende')[0]).toContain('Meintest du ‚ende‘?');
  });

  it('duplicate label', () => {
    expect(errs('x: WORD 1\nx: WORD 2')).toEqual([
      '2:1 Die Marke ‚x‘ wurde schon in Zeile 1 festgelegt. Jede Marke darf nur einmal mit Doppelpunkt vorkommen.',
    ]);
  });

  it('mnemonic used as label', () => {
    expect(errs('load: HALT')[0]).toBe(
      '1:1 ‚load‘ ist ein Befehlsname und kann nicht als Marke benutzt werden. Wähle einen anderen Namen, z. B. ‚load1‘ oder ‚Wert‘.',
    );
  });

  it('label starting with a digit', () => {
    expect(errs('1abc: HALT')[0]).toBe(
      '1:1 ‚1abc‘ ist kein gültiger Name. Marken müssen mit einem Buchstaben beginnen, z. B. ‚Wert1‘.',
    );
    expect(errs('5: HALT')[0]).toMatch(/^1:1 ‚5‘ ist keine gültige Marke/);
  });

  it('typo in mnemonic', () => {
    expect(errs('LAOD 5')).toEqual(['1:1 ‚LAOD‘ ist kein bekannter Befehl. Meintest du ‚LOAD‘?']);
    expect(errs('  JMPZZ 5')[0]).toBe('1:3 ‚JMPZZ‘ ist kein bekannter Befehl. Meintest du ‚JMPZ‘?');
  });

  it('forgotten colon after a label', () => {
    expect(errs('Schleife\nHALT')[0]).toBe(
      '1:1 ‚Schleife‘ ist kein bekannter Befehl. Soll ‚Schleife‘ eine Marke sein? Dann fehlt der Doppelpunkt: ‚Schleife:‘.',
    );
  });

  it('missing and superfluous operands', () => {
    expect(errs('LOAD')[0]).toMatch(/^1:1 Nach ‚LOAD‘ fehlt eine Adresse/);
    expect(errs('ADDI')[0]).toMatch(/^1:1 Nach ‚ADDI‘ fehlt eine Zahl/);
    expect(errs('NOT 5')[0]).toBe('1:5 ‚NOT‘ braucht keine Adresse. Lösche ‚5‘.');
    expect(errs('WORD')[0]).toBe('1:1 ‚WORD‘ braucht einen Wert. Beispiel: ‚Zähler: WORD 0‘.');
  });

  it('wrong addressing modes', () => {
    expect(errs('STORE $5')[0]).toMatch(/‚STORE‘ kann nicht mit ‚\$Zahl‘ .* lass das ‚\$‘ weg/);
    expect(errs('JMP (5)')[0]).toMatch(/Sprungbefehle brauchen eine direkte Adresse/);
    expect(errs('LOADI (5)')[0]).toMatch(/‚LOADI‘ erwartet nur eine Zahl/);
    expect(errs('WORD $5')[0]).toMatch(/Nach ‚WORD‘ steht nur eine Zahl/);
  });

  it('SP addressing and stack instructions need extended mode', () => {
    expect(errs('LOAD 2(SP)')[0]).toMatch(/gibt es nur im erweiterten Modus/);
    expect(errs('LOAD @2(SP)')[0]).toMatch(/‚@Adresse\(SP\)‘ gibt es nur im erweiterten Modus/);
    expect(errs('PUSH')[0]).toMatch(/‚PUSH‘ gibt es nur im erweiterten Modus/);
    expect(errs('PUSH', true)[0]).toMatch(/noch nicht unterstützt/);
  });

  it('numbers out of range and negative addresses', () => {
    expect(errs('LOAD -1')[0]).toMatch(/Eine Adresse kann nicht negativ sein/);
    expect(errs('LOAD 65536')).toEqual(['1:6 Die Adresse 65536 gibt es nicht. Adressen gehen von 0 bis 65535.']);
    expect(errs('LOADI -32769')).toEqual([
      '1:7 Die Zahl -32769 passt nicht in eine Speicherzelle. Erlaubt sind Zahlen von -32768 bis 65535.',
    ]);
    expect(errs('LOADI 65536')[0]).toMatch(/Die Zahl 65536 passt nicht/);
    expect(errs('LOADI 65535')).toEqual([]);
  });

  it('syntax errors', () => {
    expect(errs('LOAD (5')[0]).toMatch(/Die schließende Klammer ‚\)‘ fehlt/);
    expect(errs('LOAD 5 6')[0]).toMatch(/^1:8 Nach der Adresse steht noch ‚6‘/);
    expect(errs('LOAD 5 ; Kommentar')[0]).toMatch(/Das Zeichen ‚;‘ .* Kommentare beginnen mit ‚#‘/);
    expect(errs('LOAD 5 // Kommentar')[0]).toMatch(/Kommentare beginnen mit ‚#‘/);
    expect(errs('LOAD 5+1')[0]).toBe(
      '1:7 Das Zeichen ‚+‘ ist hier nicht erlaubt. In einer Adresse kann man nicht rechnen. Benutze dafür Befehle wie ‚ADDI‘ oder ‚MULI‘.',
    );
    expect(errs('LOAD 6/2')[0]).toMatch(/kann man nicht rechnen/);
    expect(errs('LOAD 0x')[0]).toMatch(/Nach ‚0x‘ fehlen die Hexadezimalziffern/);
    expect(errs('LOAD 5(X)')[0]).toMatch(/Nach einer Adresse ist nur ‚\(SP\)‘ erlaubt/);
    expect(errs(': HALT')[0]).toMatch(/Vor dem Doppelpunkt fehlt der Name/);
    expect(errs('a: b: HALT')[0]).toMatch(/nur eine Marke/);
    expect(errs('- 5')[0]).toMatch(/Hier wird ein Befehl erwartet/);
  });

  it('collects all errors, sorted by line', () => {
    const r = assemble('LAOD 5\nHALT\nJMP Nirgends\nNOT 3');
    expect(r.errors.map((e) => e.line)).toEqual([1, 3, 4]);
    expect(r.ok).toBe(false);
  });
});

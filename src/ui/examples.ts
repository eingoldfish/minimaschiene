/**
 * Example programs shipped with the app (own wording; the algorithms are
 * the usual school examples), in German and English. Both versions of each
 * example are executed in tests/examples.test.ts.
 */
import type { Language } from '../core';
import { MORE_EXAMPLES, MORE_EXAMPLES_EN } from './moreExamples';

export interface Example {
  id: string;
  title: string;
  /** One sentence for the menu. */
  description: string;
  /** Needs the extended mode (stack). */
  extended: boolean;
  source: string;
  /** Expected result for the tests: value (signed) at a label after HALT. */
  check: { label: string; expected: number };
}

/** German examples (see moreExamples.ts for further ones). */
const BASE_EXAMPLES: readonly Example[] = [
  {
    id: 'multiplikation',
    title: 'Multiplikation',
    description: 'Produkt durch wiederholtes Addieren (Beispiel aus dem Manual, eigene Kommentare)',
    extended: false,
    check: { label: 'Produkt', expected: 20 },
    source: `# Multiplikation durch wiederholtes Addieren:
# Produkt = Faktor1 · Faktor2

        LOADI 0
        STORE Produkt      # Produkt mit 0 beginnen
Schleife:
        LOAD Faktor1
        JMPNP Fertig       # Zähler <= 0? Dann fertig.
        SUBI 1             # Zähler um 1 verringern
        STORE Faktor1
        LOAD Produkt
        ADD Faktor2        # Faktor2 einmal dazuzählen
        STORE Produkt
        JMP Schleife
Fertig:
        HALT

# Daten
Faktor1: WORD 5
Faktor2: WORD 4
Produkt: WORD 0
`,
  },
  {
    id: 'summe',
    title: 'Summe 1 + 2 + … + n',
    description: 'Zählschleife rückwärts: addiert alle Zahlen von n bis 1',
    extended: false,
    check: { label: 'Summe', expected: 55 },
    source: `# Summe der Zahlen 1 + 2 + … + n
# Idee: n rückwärts bis 0 zählen und jedes n zur Summe addieren.

        LOADI 0
        STORE Summe        # Summe mit 0 beginnen
Schleife:
        LOAD n
        JMPZ Fertig        # n = 0? Dann fertig.
        ADD Summe
        STORE Summe        # Summe = Summe + n
        LOAD n
        SUBI 1
        STORE n            # n = n - 1
        JMP Schleife
Fertig:
        HALT

# Daten
n:      WORD 10
Summe:  WORD 0
`,
  },
  {
    id: 'maximum',
    title: 'Maximum einer Liste',
    description: 'Größtes Element suchen – mit indirekter Adressierung über einen Zeiger',
    extended: false,
    check: { label: 'Max', expected: 12 },
    source: `# Maximum einer Liste
# Ein Zeiger läuft über die Liste; (Zeiger) liest das Element, auf das er zeigt.

        LOADI Liste
        STORE Zeiger       # Zeiger zeigt auf das erste Element
        LOAD (Zeiger)
        STORE Max          # Max = erstes Element
Schleife:
        LOAD Anzahl
        SUBI 1
        STORE Anzahl
        JMPNP Fertig       # keine Elemente mehr? Dann fertig.
        LOAD Zeiger
        ADDI 1
        STORE Zeiger       # Zeiger auf das nächste Element
        LOAD (Zeiger)
        CMP Max            # Element mit Max vergleichen
        JMPNP Schleife     # Element <= Max? Dann nichts tun.
        STORE Max          # sonst: neues Maximum (CMP ändert den Akku nicht)
        JMP Schleife
Fertig:
        HALT

# Daten
Anzahl: WORD 6
Max:    WORD 0
Zeiger: WORD 0
Liste:  WORD 7
        WORD -3
        WORD 12
        WORD 5
        WORD 9
        WORD 4
`,
  },
  {
    id: 'fakultaet',
    title: 'Fakultät n!',
    description: 'n! = 1 · 2 · … · n – ab 8! reichen 16 Bit nicht mehr (V-Flag beobachten)',
    extended: false,
    check: { label: 'Ergebnis', expected: 720 },
    source: `# Fakultät: Ergebnis = n! = n · (n-1) · … · 1
# Tipp: Probier n = 8. Das Ergebnis 40320 passt nicht mehr in
# 16 Bit mit Vorzeichen – achte auf das V-Flag nach MUL.

        LOADI 1
        STORE Ergebnis     # Ergebnis mit 1 beginnen
Schleife:
        LOAD n
        JMPNP Fertig       # n <= 0? Dann fertig.
        MUL Ergebnis
        STORE Ergebnis     # Ergebnis = Ergebnis · n
        LOAD n
        SUBI 1
        STORE n            # n = n - 1
        JMP Schleife
Fertig:
        HALT

# Daten
n:        WORD 6
Ergebnis: WORD 0
`,
  },
  {
    id: 'ggt',
    title: 'Größter gemeinsamer Teiler',
    description: 'Euklidischer Algorithmus mit Subtraktion – Verzweigung mit CMP',
    extended: false,
    check: { label: 'ggT', expected: 12 },
    source: `# Größter gemeinsamer Teiler (Euklid, mit Subtraktion)
# Solange a und b verschieden sind: die größere Zahl um die kleinere verringern.

Schleife:
        LOAD a
        CMP b
        JMPZ Fertig        # a = b? Dann ist das der ggT.
        JMPN Kleiner       # a < b?
        SUB b
        STORE a            # a = a - b
        JMP Schleife
Kleiner:
        LOAD b
        SUB a
        STORE b            # b = b - a
        JMP Schleife
Fertig:
        STORE ggT          # im Akku steht noch a
        HALT

# Daten
a:   WORD 84
b:   WORD 36
ggT: WORD 0
`,
  },
  {
    id: 'unterprogramm',
    title: 'Unterprogramm',
    description: 'Quadrat in einem Unterprogramm: Parameter über den Stack, JSR und RTS',
    extended: true,
    check: { label: 'Ergebnis', expected: 49 },
    source: `# Unterprogramm mit Parameter auf dem Stack
# (nur im erweiterten Modus – Haken bei „Erweiterter Modus“ setzen)

        LOADI 7
        PUSH               # Parameter auf den Stack legen
        JSR Quadrat        # Unterprogramm aufrufen
        STORE Ergebnis     # Rückgabewert steht im Akku
        POP                # Parameter wieder vom Stack nehmen
        HALT

# Unterprogramm: Akku = Parameter · Parameter
# Auf dem Stack liegen: 0(SP) = Rücksprungadresse, 1(SP) = Parameter
Quadrat:
        LOAD 1(SP)
        MUL 1(SP)
        RTS

# Daten
Ergebnis: WORD 0
`,
  },
];

/** English examples (same ids, algorithms and results as the German ones). */
const BASE_EXAMPLES_EN: readonly Example[] = [
  {
    id: 'multiplikation',
    title: 'Multiplication',
    description: 'Product by repeated addition (example from the manual, own comments)',
    extended: false,
    check: { label: 'product', expected: 20 },
    source: `# Multiplication by repeated addition:
# product = factor1 · factor2

        LOADI 0
        STORE product      # start the product with 0
loop:
        LOAD factor1
        JMPNP done         # counter <= 0? Then we are done.
        SUBI 1             # decrease the counter by 1
        STORE factor1
        LOAD product
        ADD factor2        # add factor2 once more
        STORE product
        JMP loop
done:
        HALT

# Data
factor1: WORD 5
factor2: WORD 4
product: WORD 0
`,
  },
  {
    id: 'summe',
    title: 'Sum 1 + 2 + … + n',
    description: 'Counting loop backwards: adds all numbers from n down to 1',
    extended: false,
    check: { label: 'sum', expected: 55 },
    source: `# Sum of the numbers 1 + 2 + … + n
# Idea: count n down to 0 and add every n to the sum.

        LOADI 0
        STORE sum          # start the sum with 0
loop:
        LOAD n
        JMPZ done          # n = 0? Then we are done.
        ADD sum
        STORE sum          # sum = sum + n
        LOAD n
        SUBI 1
        STORE n            # n = n - 1
        JMP loop
done:
        HALT

# Data
n:      WORD 10
sum:    WORD 0
`,
  },
  {
    id: 'maximum',
    title: 'Maximum of a list',
    description: 'Find the largest element – with indirect addressing through a pointer',
    extended: false,
    check: { label: 'max', expected: 12 },
    source: `# Maximum of a list
# A pointer walks over the list; (pointer) reads the element it points to.

        LOADI list
        STORE pointer      # pointer points to the first element
        LOAD (pointer)
        STORE max          # max = first element
loop:
        LOAD count
        SUBI 1
        STORE count
        JMPNP done         # no elements left? Then we are done.
        LOAD pointer
        ADDI 1
        STORE pointer      # pointer to the next element
        LOAD (pointer)
        CMP max            # compare the element with max
        JMPNP loop         # element <= max? Then do nothing.
        STORE max          # else: new maximum (CMP does not change the accumulator)
        JMP loop
done:
        HALT

# Data
count:   WORD 6
max:     WORD 0
pointer: WORD 0
list:    WORD 7
         WORD -3
         WORD 12
         WORD 5
         WORD 9
         WORD 4
`,
  },
  {
    id: 'fakultaet',
    title: 'Factorial n!',
    description: 'n! = 1 · 2 · … · n – from 8! on, 16 bits are not enough (watch the V flag)',
    extended: false,
    check: { label: 'result', expected: 720 },
    source: `# Factorial: result = n! = n · (n-1) · … · 1
# Tip: try n = 8. The result 40320 no longer fits into
# 16 bits with sign – watch the V flag after MUL.

        LOADI 1
        STORE result       # start the result with 1
loop:
        LOAD n
        JMPNP done         # n <= 0? Then we are done.
        MUL result
        STORE result       # result = result · n
        LOAD n
        SUBI 1
        STORE n            # n = n - 1
        JMP loop
done:
        HALT

# Data
n:        WORD 6
result:   WORD 0
`,
  },
  {
    id: 'ggt',
    title: 'Greatest common divisor',
    description: 'Euclidean algorithm with subtraction – branching with CMP',
    extended: false,
    check: { label: 'gcd', expected: 12 },
    source: `# Greatest common divisor (Euclid, with subtraction)
# As long as a and b differ: reduce the larger number by the smaller one.

loop:
        LOAD a
        CMP b
        JMPZ done          # a = b? Then this is the gcd.
        JMPN smaller       # a < b?
        SUB b
        STORE a            # a = a - b
        JMP loop
smaller:
        LOAD b
        SUB a
        STORE b            # b = b - a
        JMP loop
done:
        STORE gcd          # the accumulator still holds a
        HALT

# Data
a:   WORD 84
b:   WORD 36
gcd: WORD 0
`,
  },
  {
    id: 'unterprogramm',
    title: 'Subroutine',
    description: 'Square in a subroutine: parameter on the stack, JSR and RTS',
    extended: true,
    check: { label: 'result', expected: 49 },
    source: `# Subroutine with a parameter on the stack
# (extended mode only – tick “Extended mode”)

        LOADI 7
        PUSH               # put the parameter on the stack
        JSR square         # call the subroutine
        STORE result       # the return value is in the accumulator
        POP                # take the parameter off the stack again
        HALT

# Subroutine: accumulator = parameter · parameter
# On the stack: 0(SP) = return address, 1(SP) = parameter
square:
        LOAD 1(SP)
        MUL 1(SP)
        RTS

# Data
result: WORD 0
`,
  },
];

/** Order in the examples pop-up: from the basics to the special features. */
const EXAMPLE_ORDER = [
  // basics
  'erste-schritte', 'adressierung', 'verzweigung', 'division',
  // loops
  'multiplikation', 'summe', 'fakultaet', 'ggt', 'quersumme', 'primzahl',
  // lists in memory
  'maximum', 'fibonacci', 'sortieren',
  // flags and bits
  'flags', 'bits',
  // stack (extended mode)
  'stack', 'unterprogramm', 'rekursion',
];

function ordered(examples: readonly Example[]): readonly Example[] {
  const rank = (e: Example): number => {
    const i = EXAMPLE_ORDER.indexOf(e.id);
    return i < 0 ? EXAMPLE_ORDER.length : i;
  };
  return [...examples].sort((a, b) => rank(a) - rank(b));
}

/** All German examples, in the order of the pop-up. */
export const EXAMPLES: readonly Example[] = ordered([...BASE_EXAMPLES, ...MORE_EXAMPLES]);
/** All English examples, in the order of the pop-up. */
export const EXAMPLES_EN: readonly Example[] = ordered([...BASE_EXAMPLES_EN, ...MORE_EXAMPLES_EN]);

const BY_LANGUAGE: Record<Language, readonly Example[]> = { de: EXAMPLES, en: EXAMPLES_EN };

/** Examples in the given language. */
export function getExamples(lang: Language): readonly Example[] {
  return BY_LANGUAGE[lang];
}

/** True if the text is one of the examples (in any language), unchanged. */
export function isExampleSource(text: string): boolean {
  return EXAMPLES.some((e) => e.source === text) || EXAMPLES_EN.some((e) => e.source === text);
}

/**
 * If `text` is one of the examples unchanged in the other language,
 * returns the same example in `lang`; otherwise null.
 */
export function translateExample(text: string, lang: Language): string | null {
  const other = lang === 'de' ? EXAMPLES_EN : EXAMPLES;
  const found = other.find((e) => e.source === text);
  if (!found) return null;
  return getExamples(lang).find((e) => e.id === found.id)?.source ?? null;
}

/** Program shown on the very first start. */
export function defaultProgram(lang: Language): string {
  const examples = getExamples(lang);
  return (examples.find((e) => e.id === 'multiplikation') ?? examples[0]!).source;
}

/** German default program (kept for tests). */
export const DEFAULT_PROGRAM = defaultProgram('de');

/**
 * Example programs shipped with the app (own wording; the algorithms are
 * the usual school examples). Each one is executed in tests/examples.test.ts.
 */

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

export const EXAMPLES: readonly Example[] = [
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
    title: 'Unterprogramm (erweiterter Modus)',
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

/** Program shown on the very first start. */
export const DEFAULT_PROGRAM = EXAMPLES[0]!.source;

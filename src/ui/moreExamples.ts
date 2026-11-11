/**
 * Further example programs: basics (first steps, addressing, branches) and
 * special features (flags, bit operations, stack, recursion), in German and
 * English. They are merged with the ones in examples.ts (see EXAMPLE_ORDER there).
 */
import type { Example } from './examples';

/** German examples. */
export const MORE_EXAMPLES: readonly Example[] = [
  {
    id: 'erste-schritte',
    title: 'Erste Schritte',
    description: 'Laden, rechnen, speichern: der Akku als Zwischenspeicher für jede Rechnung',
    extended: false,
    check: { label: 'Ergebnis', expected: 13 },
    source: `# Erste Schritte: Ergebnis = (a + b) · 2 - 1
# Fast jeder Befehl arbeitet mit dem Akkumulator (Akku):
# erst eine Zahl hineinladen, dann damit rechnen, am Ende abspeichern.
# Tipp: mit „Schritt“ (F10) Befehl für Befehl ausführen und den Akku beobachten.

        LOAD a             # Akku = a          (3)
        ADD b              # Akku = Akku + b   (7)
        MULI 2             # Akku = Akku · 2   (14)  – „I“: die Zahl steht direkt im Befehl
        SUBI 1             # Akku = Akku - 1   (13)
        STORE Ergebnis     # Akku in die Zelle „Ergebnis“ schreiben
        HALT

# Daten: WORD reserviert eine Speicherzelle mit Startwert
a:        WORD 3
b:        WORD 4
Ergebnis: WORD 0
`,
  },
  {
    id: 'adressierung',
    title: 'Adressierungsarten',
    description: 'Unmittelbar, direkt und indirekt: drei Wege, an einen Wert zu kommen',
    extended: false,
    check: { label: 'Ergebnis', expected: 35 },
    source: `# Adressierungsarten: Woher kommt der Wert für den Befehl?
#   LOADI 5 / ADD $5   unmittelbar: die Zahl 5 selbst
#   ADD Wert           direkt: der Inhalt der Zelle „Wert“
#   ADD (Zeiger)       indirekt: in „Zeiger“ steht eine Adresse,
#                      der Wert kommt aus der Zelle an dieser Adresse

        LOADI Ziel         # unmittelbar: die ADRESSE von „Ziel“ als Zahl
        STORE Zeiger       # Zeiger zeigt jetzt auf „Ziel“

        LOADI 5            # unmittelbar:  Akku = 5
        ADD Wert           # direkt:       Akku = 5 + 10
        ADD (Zeiger)       # indirekt:     Akku = 15 + 20
        ADD $0             # unmittelbar mit $: + 0 (gleich wie ADDI 0)
        STORE Ergebnis     # 35
        HALT

# Daten
Wert:     WORD 10
Zeiger:   WORD 0
Ziel:     WORD 20
Ergebnis: WORD 0
`,
  },
  {
    id: 'verzweigung',
    title: 'Verzweigung: Betrag',
    description: 'Wenn x negativ ist, Vorzeichen umdrehen – ein bedingter Sprung überspringt Befehle',
    extended: false,
    check: { label: 'Betrag', expected: 17 },
    source: `# Betrag einer Zahl: |x|
# Wenn x >= 0 ist, bleibt x, sonst wird 0 - x gerechnet.
# Bedingte Sprünge schauen auf die Flags, die der letzte Befehl gesetzt hat:
# JMPNN springt, wenn das Ergebnis nicht negativ war (N-Flag = 0).
# Tipp: x auf eine positive Zahl ändern und den anderen Weg beobachten.

        LOAD x
        JMPNN Fertig       # x >= 0? Dann die nächsten zwei Befehle überspringen.
        LOADI 0
        SUB x              # Akku = 0 - x
Fertig:
        STORE Betrag
        HALT

# Daten
x:      WORD -17
Betrag: WORD 0
`,
  },
  {
    id: 'division',
    title: 'Division mit Rest',
    description: 'Minuten in Stunden und Minuten umrechnen – DIV liefert den Quotienten, MOD den Rest',
    extended: false,
    check: { label: 'Minuten', expected: 15 },
    source: `# Division mit Rest: 135 Minuten = 2 Stunden und 15 Minuten
# DIVI 60 teilt ganzzahlig (der Rest fällt weg),
# MODI 60 liefert genau diesen Rest.

        LOAD Gesamt
        DIVI 60            # 135 : 60 = 2
        STORE Stunden
        LOAD Gesamt
        MODI 60            # 135 mod 60 = 15
        STORE Minuten
        HALT

# Daten
Gesamt:  WORD 135
Stunden: WORD 0
Minuten: WORD 0
`,
  },
  {
    id: 'quersumme',
    title: 'Quersumme',
    description: 'Ziffern einzeln abtrennen: MODI 10 liefert die letzte Ziffer, DIVI 10 streicht sie',
    extended: false,
    check: { label: 'Summe', expected: 10 },
    source: `# Quersumme: 1234 → 1 + 2 + 3 + 4 = 10
# Die letzte Ziffer ist der Rest bei Division durch 10.
# Teilt man durch 10, fällt die letzte Ziffer weg.

        LOADI 0
        STORE Summe
Schleife:
        LOAD n
        JMPZ Fertig        # keine Ziffern mehr? Dann fertig.
        MODI 10            # letzte Ziffer
        ADD Summe
        STORE Summe        # Summe = Summe + Ziffer
        LOAD n
        DIVI 10
        STORE n            # letzte Ziffer streichen
        JMP Schleife
Fertig:
        HALT

# Daten
n:     WORD 1234
Summe: WORD 0
`,
  },
  {
    id: 'primzahl',
    title: 'Primzahltest',
    description: 'Teiler ausprobieren, bis Teiler² > n – mit zwei verschiedenen Ausgängen',
    extended: false,
    check: { label: 'Prim', expected: 1 },
    source: `# Ist n eine Primzahl? Ergebnis: Prim = 1 (ja) oder 0 (nein), für n >= 2
# Idee: Teiler 2, 3, 4, … ausprobieren. Ist ein Teiler gefunden, ist n
# keine Primzahl. Ist Teiler · Teiler größer als n, gibt es keinen mehr.
# Tipp: n = 91 probieren (= 7 · 13).

        LOADI 2
        STORE Teiler
Schleife:
        LOAD Teiler
        MUL Teiler
        CMP n              # Teiler² mit n vergleichen
        JMPP IstPrim       # Teiler² > n? Dann ist n prim.
        LOAD n
        MOD Teiler         # Rest von n : Teiler
        JMPZ KeinePrim     # Rest 0? Dann ist Teiler ein Teiler von n.
        LOAD Teiler
        ADDI 1
        STORE Teiler       # nächsten Teiler probieren
        JMP Schleife
IstPrim:
        LOADI 1
        STORE Prim
        HALT
KeinePrim:
        LOADI 0
        STORE Prim
        HALT

# Daten
n:      WORD 97
Teiler: WORD 0
Prim:   WORD 0
`,
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci-Folge',
    description: 'Eine Liste in den Speicher schreiben – STORE (Zeiger) schreibt dorthin, wohin der Zeiger zeigt',
    extended: false,
    check: { label: 'Letzte', expected: 34 },
    source: `# Fibonacci-Folge: 0, 1, 1, 2, 3, 5, 8, …  (jede Zahl ist die Summe der zwei davor)
# Die ersten 10 Zahlen werden in die Liste „Folge“ geschrieben.
# Tipp: im Speicher zusehen, wie sich die Liste füllt.

        LOADI Folge
        STORE Zeiger       # Zeiger auf die erste Zelle der Liste
Schleife:
        LOAD Anzahl
        JMPNP Fertig       # alle Zahlen geschrieben? Dann fertig.
        SUBI 1
        STORE Anzahl
        LOAD a
        STORE (Zeiger)     # a in die Zelle schreiben, auf die Zeiger zeigt
        ADD b
        STORE Neu          # Neu = a + b
        LOAD b
        STORE a            # a = b
        LOAD Neu
        STORE b            # b = Neu
        LOAD Zeiger
        ADDI 1
        STORE Zeiger       # Zeiger auf die nächste Zelle
        JMP Schleife
Fertig:
        HALT

# Daten
Anzahl: WORD 10
a:      WORD 0
b:      WORD 1
Neu:    WORD 0
Zeiger: WORD 0
Folge:  WORD 0             # 10 Zellen für die Folge
        WORD 0
        WORD 0
        WORD 0
        WORD 0
        WORD 0
        WORD 0
        WORD 0
        WORD 0
Letzte: WORD 0
`,
  },
  {
    id: 'sortieren',
    title: 'Sortieren (Bubblesort)',
    description: 'Nachbarn vergleichen und tauschen, bis nichts mehr getauscht wird – mit zwei Zeigern',
    extended: false,
    check: { label: 'Liste', expected: -2 },
    source: `# Bubblesort: Liste aufsteigend sortieren
# In jedem Durchlauf werden benachbarte Elemente verglichen und
# vertauscht, wenn sie falsch herum stehen. Gab es in einem Durchlauf
# keinen Tausch mehr, ist die Liste sortiert.
# Tipp: die Liste im Speicher beobachten (Lauf mit geringer Geschwindigkeit).

Durchlauf:
        LOADI 0
        STORE Getauscht    # noch nichts getauscht
        LOADI Liste
        STORE p            # p zeigt auf das erste Element
        LOAD Anzahl
        SUBI 1
        STORE Rest         # Anzahl - 1 Vergleiche pro Durchlauf
Vergleich:
        LOAD Rest
        JMPNP Ende         # Durchlauf zu Ende?
        SUBI 1
        STORE Rest
        LOAD p
        ADDI 1
        STORE q            # q zeigt auf den rechten Nachbarn
        LOAD (p)
        CMP (q)            # linkes mit rechtem Element vergleichen
        JMPNP Weiter       # links <= rechts? Dann passt es.
        STORE Merk         # sonst tauschen: Merk = links
        LOAD (q)
        STORE (p)          # links = rechts
        LOAD Merk
        STORE (q)          # rechts = Merk
        LOADI 1
        STORE Getauscht
Weiter:
        LOAD q
        STORE p            # ein Element weiter
        JMP Vergleich
Ende:
        LOAD Getauscht
        JMPNZ Durchlauf    # wurde getauscht? Dann noch ein Durchlauf.
        HALT

# Daten
Anzahl:    WORD 6
Getauscht: WORD 0
Rest:      WORD 0
p:         WORD 0
q:         WORD 0
Merk:      WORD 0
Liste:     WORD 5
           WORD 9
           WORD -2
           WORD 7
           WORD 0
           WORD 3
`,
  },
  {
    id: 'flags',
    title: 'Überlauf: V- und C-Flag',
    description: 'Wenn 16 Bit nicht reichen: Überlauf mit Vorzeichen (V) und ohne Vorzeichen (C)',
    extended: false,
    check: { label: 'FlagC', expected: 1 },
    source: `# Überlauf: Eine Speicherzelle hat 16 Bit.
# Mit Vorzeichen passen -32768 … 32767 hinein, ohne Vorzeichen 0 … 65535.
# Wird ein Ergebnis zu groß, setzt die CPU ein Flag:
#   V (oVerflow): Überlauf beim Rechnen mit Vorzeichen
#   C (Carry):    Übertrag beim Rechnen ohne Vorzeichen
# Tipp: nach jedem ADDI auf das Statusregister schauen.

# 1. Mit Vorzeichen: 30000 + 30000 = 60000 ist zu groß
        LOADI 30000
        ADDI 30000         # Akku zeigt -5536, das V-Flag ist gesetzt
        JMPV MitV          # JMPV springt nur, wenn V gesetzt ist
        JMP Teil2
MitV:
        LOADI 1
        STORE FlagV        # merken: V war gesetzt

# 2. Ohne Vorzeichen: 65535 + 1 = 65536 ist zu groß
Teil2:
        LOADI -1           # -1 ist dasselbe Bitmuster wie 65535
        ADDI 1             # Akku = 0, das C-Flag ist gesetzt
        LOADC              # C-Flag in den Akku holen (1 oder 0)
        STORE FlagC
        HALT

# Daten
FlagV: WORD 0
FlagC: WORD 0
`,
  },
  {
    id: 'bits',
    title: 'Bits zählen',
    description: 'Wie viele Einsen hat eine Zahl im Binärsystem? Mit ANDI 1 und Schieben (SHRI)',
    extended: false,
    check: { label: 'Einsen', expected: 6 },
    source: `# Bits zählen: Wie viele Einsen hat n im Binärsystem?
# 183 = 1011 0111 → 6 Einsen
# ANDI 1 lässt nur das unterste Bit übrig (0 oder 1),
# SHRI 1 schiebt alle Bits eine Stelle nach rechts.
# Tipp: unter „Optionen“ die Detailansicht einschalten, dann zeigt
# der Register-Tab den Akku auch binär.

        LOADI 0
        STORE Einsen
Schleife:
        LOAD n
        JMPZ Fertig        # keine Einsen mehr übrig? Dann fertig.
        ANDI 1             # unterstes Bit
        ADD Einsen
        STORE Einsen       # Einsen = Einsen + Bit
        LOAD n
        SHRI 1             # n eine Stelle nach rechts schieben
        STORE n
        JMP Schleife
Fertig:
        HALT

# Daten
n:      WORD 183
Einsen: WORD 0
`,
  },
  {
    id: 'stack',
    title: 'Stack: Reihenfolge umdrehen',
    description: 'PUSH legt oben auf den Stapel, POP nimmt von oben – was zuletzt kam, geht zuerst',
    extended: true,
    check: { label: 'Erster', expected: 3 },
    source: `# Stack: drei Zahlen in umgekehrter Reihenfolge zurückschreiben
# (nur im erweiterten Modus)
# Der Stack ist ein Stapel am Ende des Speichers; SP zeigt auf das oberste Element.
# PUSH: SP um 1 verringern, Akku dorthin schreiben.
# POP:  oberstes Element in den Akku holen, SP um 1 erhöhen.
# Tipp: SP und das Ende des Speichers beobachten.

        LOAD Erster
        PUSH               # Stapel: 1
        LOAD Zweiter
        PUSH               # Stapel: 1 2
        LOAD Dritter
        PUSH               # Stapel: 1 2 3   (3 liegt oben)

        POP
        STORE Erster       # 3
        POP
        STORE Zweiter      # 2
        POP
        STORE Dritter      # 1
        HALT

# Daten
Erster:  WORD 1
Zweiter: WORD 2
Dritter: WORD 3
`,
  },
  {
    id: 'rekursion',
    title: 'Rekursive Fakultät',
    description: 'Ein Unterprogramm ruft sich selbst auf – Platz auf dem Stack mit RSV reservieren und mit REL freigeben',
    extended: true,
    check: { label: 'Ergebnis', expected: 120 },
    source: `# Rekursive Fakultät: Fak(k) = k · Fak(k - 1), Fak(1) = 1
# (nur im erweiterten Modus)
# Jeder Aufruf bekommt seinen Parameter auf dem Stack, deshalb
# stören sich die verschachtelten Aufrufe nicht.
# RSV $1 reserviert eine Zelle auf dem Stack, REL $1 gibt sie wieder frei.
# 0(SP) ist die oberste Stackzelle, 1(SP) die darunter.
# Tipp: mit „Schritt“ zusehen, wie der Stack wächst und wieder schrumpft.

        LOAD n
        RSV $1             # Platz für den Parameter reservieren
        STORE 0(SP)        # Parameter = n
        JSR Fak            # Akku = n!
        REL $1             # Platz wieder freigeben
        STORE Ergebnis
        HALT

# Unterprogramm Fak: Akku = k!
# Auf dem Stack: 0(SP) = Rücksprungadresse, 1(SP) = k
Fak:
        LOAD 1(SP)
        CMPI 1
        JMPP Rekursion     # k > 1? Dann rekursiv weiter.
        LOADI 1            # sonst: Fak(1) = 1
        RTS
Rekursion:
        SUBI 1             # Akku = k - 1  (CMPI ändert den Akku nicht)
        RSV $1
        STORE 0(SP)        # Parameter für den Aufruf = k - 1
        JSR Fak            # Akku = (k - 1)!
        REL $1
        MUL 1(SP)          # Akku = (k - 1)! · k
        RTS

# Daten
n:        WORD 5
Ergebnis: WORD 0
`,
  },
];

/** English examples (same ids, algorithms and results as the German ones). */
export const MORE_EXAMPLES_EN: readonly Example[] = [
  {
    id: 'erste-schritte',
    title: 'First steps',
    description: 'Load, calculate, store: the accumulator holds the value for every calculation',
    extended: false,
    check: { label: 'result', expected: 13 },
    source: `# First steps: result = (a + b) · 2 - 1
# Almost every instruction works with the accumulator:
# first load a number into it, then calculate, finally store it.
# Tip: run it instruction by instruction with “Step” (F10) and watch the accumulator.

        LOAD a             # acc = a          (3)
        ADD b              # acc = acc + b    (7)
        MULI 2             # acc = acc · 2    (14)  – “I”: the number is part of the instruction
        SUBI 1             # acc = acc - 1    (13)
        STORE result       # write the accumulator into the cell “result”
        HALT

# Data: WORD reserves one memory cell with a start value
a:      WORD 3
b:      WORD 4
result: WORD 0
`,
  },
  {
    id: 'adressierung',
    title: 'Addressing modes',
    description: 'Immediate, direct and indirect: three ways to get a value',
    extended: false,
    check: { label: 'result', expected: 35 },
    source: `# Addressing modes: where does the value for the instruction come from?
#   LOADI 5 / ADD $5   immediate: the number 5 itself
#   ADD value          direct: the content of the cell “value”
#   ADD (pointer)      indirect: “pointer” holds an address,
#                      the value comes from the cell at that address

        LOADI target       # immediate: the ADDRESS of “target” as a number
        STORE pointer      # pointer now points to “target”

        LOADI 5            # immediate:  acc = 5
        ADD value          # direct:     acc = 5 + 10
        ADD (pointer)      # indirect:   acc = 15 + 20
        ADD $0             # immediate with $: + 0 (same as ADDI 0)
        STORE result       # 35
        HALT

# Data
value:   WORD 10
pointer: WORD 0
target:  WORD 20
result:  WORD 0
`,
  },
  {
    id: 'verzweigung',
    title: 'Branch: absolute value',
    description: 'If x is negative, flip its sign – a conditional jump skips instructions',
    extended: false,
    check: { label: 'absolute', expected: 17 },
    source: `# Absolute value of a number: |x|
# If x >= 0, x stays, otherwise 0 - x is calculated.
# Conditional jumps look at the flags set by the last instruction:
# JMPNN jumps if the result was not negative (N flag = 0).
# Tip: change x to a positive number and watch the other path.

        LOAD x
        JMPNN done         # x >= 0? Then skip the next two instructions.
        LOADI 0
        SUB x              # acc = 0 - x
done:
        STORE absolute
        HALT

# Data
x:        WORD -17
absolute: WORD 0
`,
  },
  {
    id: 'division',
    title: 'Division with remainder',
    description: 'Convert minutes to hours and minutes – DIV gives the quotient, MOD the remainder',
    extended: false,
    check: { label: 'minutes', expected: 15 },
    source: `# Division with remainder: 135 minutes = 2 hours and 15 minutes
# DIVI 60 divides as integers (the remainder is dropped),
# MODI 60 gives exactly that remainder.

        LOAD total
        DIVI 60            # 135 : 60 = 2
        STORE hours
        LOAD total
        MODI 60            # 135 mod 60 = 15
        STORE minutes
        HALT

# Data
total:   WORD 135
hours:   WORD 0
minutes: WORD 0
`,
  },
  {
    id: 'quersumme',
    title: 'Digit sum',
    description: 'Split off the digits one by one: MODI 10 gives the last digit, DIVI 10 removes it',
    extended: false,
    check: { label: 'sum', expected: 10 },
    source: `# Digit sum: 1234 → 1 + 2 + 3 + 4 = 10
# The last digit is the remainder of a division by 10.
# Dividing by 10 removes the last digit.

        LOADI 0
        STORE sum
loop:
        LOAD n
        JMPZ done          # no digits left? Then done.
        MODI 10            # last digit
        ADD sum
        STORE sum          # sum = sum + digit
        LOAD n
        DIVI 10
        STORE n            # remove the last digit
        JMP loop
done:
        HALT

# Data
n:   WORD 1234
sum: WORD 0
`,
  },
  {
    id: 'primzahl',
    title: 'Prime test',
    description: 'Try divisors until divisor² > n – with two different exits',
    extended: false,
    check: { label: 'prime', expected: 1 },
    source: `# Is n a prime number? Result: prime = 1 (yes) or 0 (no), for n >= 2
# Idea: try the divisors 2, 3, 4, … If one divides n, n is not prime.
# Once divisor · divisor is bigger than n, there is none left.
# Tip: try n = 91 (= 7 · 13).

        LOADI 2
        STORE divisor
loop:
        LOAD divisor
        MUL divisor
        CMP n              # compare divisor² with n
        JMPP isPrime       # divisor² > n? Then n is prime.
        LOAD n
        MOD divisor        # remainder of n : divisor
        JMPZ notPrime      # remainder 0? Then divisor divides n.
        LOAD divisor
        ADDI 1
        STORE divisor      # try the next divisor
        JMP loop
isPrime:
        LOADI 1
        STORE prime
        HALT
notPrime:
        LOADI 0
        STORE prime
        HALT

# Data
n:       WORD 97
divisor: WORD 0
prime:   WORD 0
`,
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci sequence',
    description: 'Write a list into memory – STORE (pointer) writes to where the pointer points',
    extended: false,
    check: { label: 'last', expected: 34 },
    source: `# Fibonacci sequence: 0, 1, 1, 2, 3, 5, 8, …  (each number is the sum of the two before)
# The first 10 numbers are written into the list “sequence”.
# Tip: watch the list fill up in the memory view.

        LOADI sequence
        STORE pointer      # pointer to the first cell of the list
loop:
        LOAD count
        JMPNP done         # all numbers written? Then done.
        SUBI 1
        STORE count
        LOAD a
        STORE (pointer)    # write a into the cell the pointer points to
        ADD b
        STORE next         # next = a + b
        LOAD b
        STORE a            # a = b
        LOAD next
        STORE b            # b = next
        LOAD pointer
        ADDI 1
        STORE pointer      # pointer to the next cell
        JMP loop
done:
        HALT

# Data
count:    WORD 10
a:        WORD 0
b:        WORD 1
next:     WORD 0
pointer:  WORD 0
sequence: WORD 0           # 10 cells for the sequence
          WORD 0
          WORD 0
          WORD 0
          WORD 0
          WORD 0
          WORD 0
          WORD 0
          WORD 0
last:     WORD 0
`,
  },
  {
    id: 'sortieren',
    title: 'Sorting (bubble sort)',
    description: 'Compare and swap neighbours until nothing is swapped any more – with two pointers',
    extended: false,
    check: { label: 'list', expected: -2 },
    source: `# Bubble sort: sort a list in ascending order
# In every pass, neighbouring elements are compared and swapped
# if they are in the wrong order. If a pass swaps nothing,
# the list is sorted.
# Tip: watch the list in the memory view (run at a low speed).

pass:
        LOADI 0
        STORE swapped      # nothing swapped yet
        LOADI list
        STORE p            # p points to the first element
        LOAD count
        SUBI 1
        STORE left         # count - 1 comparisons per pass
compare:
        LOAD left
        JMPNP passEnd      # end of this pass?
        SUBI 1
        STORE left
        LOAD p
        ADDI 1
        STORE q            # q points to the right neighbour
        LOAD (p)
        CMP (q)            # compare left and right element
        JMPNP next         # left <= right? Then it is fine.
        STORE temp         # otherwise swap: temp = left
        LOAD (q)
        STORE (p)          # left = right
        LOAD temp
        STORE (q)          # right = temp
        LOADI 1
        STORE swapped
next:
        LOAD q
        STORE p            # one element further
        JMP compare
passEnd:
        LOAD swapped
        JMPNZ pass         # anything swapped? Then one more pass.
        HALT

# Data
count:   WORD 6
swapped: WORD 0
left:    WORD 0
p:       WORD 0
q:       WORD 0
temp:    WORD 0
list:    WORD 5
         WORD 9
         WORD -2
         WORD 7
         WORD 0
         WORD 3
`,
  },
  {
    id: 'flags',
    title: 'Overflow: V and C flag',
    description: 'When 16 bits are not enough: overflow with sign (V) and without sign (C)',
    extended: false,
    check: { label: 'flagC', expected: 1 },
    source: `# Overflow: a memory cell has 16 bits.
# With sign it holds -32768 … 32767, without sign 0 … 65535.
# If a result is too big, the CPU sets a flag:
#   V (oVerflow): overflow when calculating with sign
#   C (carry):    carry when calculating without sign
# Tip: look at the status register after each ADDI.

# 1. With sign: 30000 + 30000 = 60000 is too big
        LOADI 30000
        ADDI 30000         # acc shows -5536, the V flag is set
        JMPV withV         # JMPV only jumps if V is set
        JMP part2
withV:
        LOADI 1
        STORE flagV        # remember: V was set

# 2. Without sign: 65535 + 1 = 65536 is too big
part2:
        LOADI -1           # -1 is the same bit pattern as 65535
        ADDI 1             # acc = 0, the C flag is set
        LOADC              # load the C flag into the accumulator (1 or 0)
        STORE flagC
        HALT

# Data
flagV: WORD 0
flagC: WORD 0
`,
  },
  {
    id: 'bits',
    title: 'Counting bits',
    description: 'How many ones does a number have in binary? With ANDI 1 and shifting (SHRI)',
    extended: false,
    check: { label: 'ones', expected: 6 },
    source: `# Counting bits: how many ones does n have in binary?
# 183 = 1011 0111 → 6 ones
# ANDI 1 keeps only the lowest bit (0 or 1),
# SHRI 1 shifts all bits one place to the right.
# Tip: switch on “Details” under “Options”, then the registers tab
# also shows the accumulator in binary.

        LOADI 0
        STORE ones
loop:
        LOAD n
        JMPZ done          # no ones left? Then done.
        ANDI 1             # lowest bit
        ADD ones
        STORE ones         # ones = ones + bit
        LOAD n
        SHRI 1             # shift n one place to the right
        STORE n
        JMP loop
done:
        HALT

# Data
n:    WORD 183
ones: WORD 0
`,
  },
  {
    id: 'stack',
    title: 'Stack: reversing the order',
    description: 'PUSH puts on top of the stack, POP takes from the top – last in, first out',
    extended: true,
    check: { label: 'first', expected: 3 },
    source: `# Stack: write three numbers back in reverse order
# (extended mode only)
# The stack is a pile at the end of memory; SP points to the top element.
# PUSH: decrease SP by 1, write the accumulator there.
# POP:  load the top element into the accumulator, increase SP by 1.
# Tip: watch SP and the end of the memory.

        LOAD first
        PUSH               # stack: 1
        LOAD second
        PUSH               # stack: 1 2
        LOAD third
        PUSH               # stack: 1 2 3   (3 is on top)

        POP
        STORE first        # 3
        POP
        STORE second       # 2
        POP
        STORE third        # 1
        HALT

# Data
first:  WORD 1
second: WORD 2
third:  WORD 3
`,
  },
  {
    id: 'rekursion',
    title: 'Recursive factorial',
    description: 'A subroutine calls itself – reserve space on the stack with RSV and release it with REL',
    extended: true,
    check: { label: 'result', expected: 120 },
    source: `# Recursive factorial: fac(k) = k · fac(k - 1), fac(1) = 1
# (extended mode only)
# Every call gets its parameter on the stack, so the
# nested calls do not get in each other's way.
# RSV $1 reserves one cell on the stack, REL $1 releases it again.
# 0(SP) is the top stack cell, 1(SP) the one below.
# Tip: use “Step” to watch the stack grow and shrink again.

        LOAD n
        RSV $1             # reserve space for the parameter
        STORE 0(SP)        # parameter = n
        JSR fac            # acc = n!
        REL $1             # release the space again
        STORE result
        HALT

# Subroutine fac: acc = k!
# On the stack: 0(SP) = return address, 1(SP) = k
fac:
        LOAD 1(SP)
        CMPI 1
        JMPP recurse       # k > 1? Then continue recursively.
        LOADI 1            # otherwise: fac(1) = 1
        RTS
recurse:
        SUBI 1             # acc = k - 1  (CMPI does not change the accumulator)
        RSV $1
        STORE 0(SP)        # parameter for the call = k - 1
        JSR fac            # acc = (k - 1)!
        REL $1
        MUL 1(SP)          # acc = (k - 1)! · k
        RTS

# Data
n:      WORD 5
result: WORD 0
`,
  },
];

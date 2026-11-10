# Kompatibilität zur Minimaschine 4.0

Hier stehen alle Punkte, die das Benutzermanual nicht eindeutig festlegt, sowie jede bewusste Abweichung vom Original.

Status: **offen** = noch nicht geklärt · **Annahme** = so umgesetzt, aber nicht am Original geprüft · **geklärt** = am Original (Webversion) überprüft

## Offene Punkte

| # | Thema | Status | Annahme / Notiz |
|---|---|---|---|
| 1 | Numerische Opcodes und Kodierung der Adressierungsart in Wort 1 | geklärt für den Standardmodus (Test 1 + 3a) | Siehe Abschnitt „Opcode-Tabelle“. Offen sind noch die Codes der SP-Adressierungsarten und der Stackbefehle (`JSR`, `RTS`, `PUSH`, `POP`, `RSV`, `REL`) → Test 3b im erweiterten Modus. |
| 2 | C-Flag bei `SUB`/`SUBI`/`CMP`/`CMPI` (Carry oder Borrow?) | geklärt (Test 1) | **Borrow:** C = 1 genau dann, wenn A < Operand (vorzeichenlos). 5−3 → C=0, 3−5 → C=1, 7−7 → C=0, 0−1 → C=1, 0xFFFF−1 → C=0, −32768−1 → C=0, V=1. `SUB` mit Adresse verhält sich wie `SUBI`. |
| 3 | V/C-Flag bei `MUL`, `DIV`, `MOD`, `MULH`, Shifts, Logikbefehlen | geklärt (Test 4 + 5) | Siehe Abschnitt „Flags der Rechen-, Logik- und Schiebebefehle“. |
| 4 | `CMP`: Manual sagt „setzt Null- und Negativflag“, `JLO`/`JHI` nach Vergleich nutzen aber C | geklärt (Test 1 + 6) | `CMP`/`CMPI` setzen Z, N, V und C exakt wie `SUB`, der Akku bleibt unverändert. `JLO` springt nach `3 CMP 5`. `-32768 CMPI 1` → V=1. |
| 4a | Flags bei Ladebefehlen | geklärt (Test 1) | `LOAD`/`LOADI`/`LOADC` setzen Z und N nach dem geladenen Wert und **löschen V und C**. `STORE` und Sprünge lassen die Flags unverändert. |
| 5 | Division durch 0 | geklärt (Test 2) – Abweichung geplant | **Original:** `DIV`/`DIVI` (auch mit negativem Dividenden), `MODI`, `DIVUI` und `MODUI` durch 0 brechen ab. Es erscheint ein Browser-Pop-up „Division durch 0“, und Akku, Flags usw. werden zurückgesetzt. **Eigene Lösung (freigegeben, muss nicht dem Original entsprechen):** siehe „Bewusste Neuerungen“. |
| 5a | `DIV`/`MOD` mit negativen Operanden | geklärt (Test 6) | Wie Java/JavaScript: **Quotient Richtung 0 gerundet**, **Rest hat das Vorzeichen des Dividenden**. `-7 DIVI 2` → −3, `-7 MODI 2` → −1, `7 MODI -2` → 1. |
| 6 | Startwert des Stackpointers (SP) | offen | Vorläufig 0 in `createInitialState()`. |
| 7 | Verhalten von `RESET` als Befehl im Programm | geklärt (Test 4 + 6) – Abweichung geplant | **Original, Befehl `RESET`:** setzt Akku, Programmzähler, Befehlsregister und Flags zurück, der Speicher (inkl. Programm) ist danach 0, die Maschine ist angehalten (nur „Zurücksetzen“ aktiv). **Original, Knopf „Zurücksetzen“:** setzt Akku, PC, Befehlsregister und Flags zurück, der **Speicher bleibt erhalten** (Screenshot Test 6). Befehl und Knopf verhalten sich also verschieden. **Eigene Lösung:** siehe „Bewusste Neuerungen“. |
| 8 | Feinaufteilung der Mikroschritte (Holen – Dekodieren – Ausführen) | offen | |
| 9 | Dateiendung für Assemblerdateien | offen | Vermutlich `.mia` – Bestätigung ausstehend. |
| 10 | Shifts um ≥ 16 Stellen | geklärt (Test 4) | **Schiebeweite modulo 32, gerechnet auf 32 Bit, Ergebnis auf 16 Bit abgeschnitten** (wie JavaScript `<<`, `>>>`, `>>`). `5 SHLI 16` = 0, `5 SHLI 17` = 0, `5 SHLI 100` = 80 (100 mod 32 = 4), `5 SHLI -1` = 0 (−1 mod 32 = 31), `-1 SHRI 16` = 0, `-32768 SHRAI 16` = −1, `-32768 SHRAI 15` = −1, `5 SHLI 0` = 5. Weder Modulo 16 noch Fehlermeldung. |
| 11 | Speicherlayout beim Assemblieren | beobachtet (Test 2) | Die Befehle liegen ab Adresse 0 lückenlos mit je 2 Worten, `WORD`-Zellen schließen direkt an. In Test 2 wurde `STORE schritt` zu Adresse 75 übersetzt (37 Befehle = 74 Worte, `null` = 74, `schritt` = 75). Mit auskommentierten Fällen ergaben sich andere Adressen, z. B. 73. Exakte Adressgleichheit mit dem Original ist kein Muss, wird aber notiert. |
| 12 | Ungültiger Befehlscode (unbekannter Opcode oder unbekannte Adressierungsart in Wort 1) | Annahme (M1) | Maschine hält an, der PC bleibt auf dem ungültigen Befehl. Als ungültig gilt auch eine Adressierungsart, die der Befehl nicht erlaubt (z. B. `STORE` immediate = 0x0215, `NOT` mit Art 1, Sprünge mit Art 2/3). Prüfbar mit Speicher-Editieren im Original. |
| 13 | PC nach `HALT` | Annahme (M1) | Der PC zeigt hinter den `HALT`-Befehl (normaler Befehlszyklus: PC wird beim Holen um 2 erhöht). |
| 14 | Indirekte Sprünge (`JMP (adr)`) | Annahme (M1) | Nicht erlaubt; Sprünge kennen nur direkte Adressen. Im Original prüfen, ob der Assembler `JMP (10)` annimmt. |
| 15 | Groß-/Kleinschreibung bei Marken | Annahme (M2) | Marken unterscheiden Groß- und Kleinschreibung (`Ende` ≠ `ende`), Befehle nicht. Bei einem Treffer, der sich nur in der Schreibweise unterscheidet, gibt der Assembler einen Hinweis. Im Original prüfen. |
| 16 | Befehlsnamen als Marken | Annahme (M2) | Nicht erlaubt (z. B. `load:`, `word:`, `sp:`), auch keine Namen der Stackbefehle. |
| 17 | Negative Zahlen und Marken als Zahlenwert | Annahme (M2) | Negative Zahlen (−32768 … −1) gibt es nur bei Immediate (`LOADI -7`, `ADD $-1`) und `WORD`. Eine negative Adresse (`LOAD -1`) ist ein Fehler. `LOADI Marke` und `WORD Marke` sind erlaubt und liefern die Adresse der Marke. |

## Opcode-Tabelle (am Original ermittelt)

**Wort 1 = Adressierungsart · 256 + Opcode** (High-Byte = Art, Low-Byte = Opcode). Wort 2 = Adressteil, bei Befehlen ohne Adresse 0.

| Art (High-Byte) | Bedeutung | Beispiel |
|---|---|---|
| 0 | ohne Adresse | `NOT` = 0x0038 |
| 1 | direkt `adr` (auch alle Sprünge, `STORE`) | `LOAD 11` = 0x0114 |
| 2 | immediate `$adr` | `LOAD $11` = `LOADI 11` = 0x0214 |
| 3 | indirekt `(adr)` | `LOAD (11)` = 0x0314 |
| ? | `adr(SP)`, `@adr(SP)`, `$adr(SP)` | offen (Test 3b) |

Die `…I`-Befehle sind keine eigenen Opcodes, sondern Art 2 des Grundbefehls (`ADDI 11` = `ADD $11` = 0x020A).

| Opcode | Befehl | Opcode | Befehl | Opcode | Befehl |
|---|---|---|---|---|---|
| 0 | `NOOP` | 20 (0x14) | `LOAD` | 38 (0x26) | `JMPC` |
| 1 | `RESET` | 21 (0x15) | `STORE` | 40 (0x28) | `JHI` |
| 10 (0x0A) | `ADD` | 22 (0x16) | `LOADC` | 41 (0x29) | `JHS` |
| 11 (0x0B) | `SUB` | 30 (0x1E) | `JMPP` | 42 (0x2A) | `JLO` |
| 12 (0x0C) | `MUL` | 31 (0x1F) | `JMPNN` | 43 (0x2B) | `JLS` |
| 13 (0x0D) | `DIV` | 32 (0x20) | `JMPN` | 50 (0x32) | `AND` |
| 14 (0x0E) | `MOD` | 33 (0x21) | `JMPNP` | 51 (0x33) | `OR` |
| 15 (0x0F) | `CMP` | 34 (0x22) | `JMPZ` | 52 (0x34) | `XOR` |
| 16 (0x10) | `DIVU` | 35 (0x23) | `JMPNZ` | 53 (0x35) | `SHL` |
| 17 (0x11) | `MODU` | 36 (0x24) | `JMP` | 54 (0x36) | `SHR` |
| 18 (0x12) | `MULH` | 37 (0x25) | `JMPV` | 55 (0x37) | `SHRA` |
| 19 (0x13) | `MULHU` | | | 56 (0x38) | `NOT` |
| | | | | 99 (0x63) | `HALT` |

Lücken (z. B. 2–9, 23–29, 39, 44–49) gehören vermutlich zu den Stackbefehlen. Prüfen mit Test 3b.

**Ansicht „Opcodes anzeigen“ im Original:**
- Die Ansicht dekodiert den Speicher immer paarweise ab Adresse 0 (gerade Adresse = Wort 1, ungerade = Adressteil), egal ob dort Befehle oder Daten stehen.
- Wort 1 erscheint als Mnemonic, der Adressteil als Dezimalzahl.
- Immediate wird als `LOADI`/`ADDI` angezeigt (nicht `LOAD $`). Indirekt erscheint als `LOAD @` / `ADD @`, also anders als die Eingabesyntax `(11)`.
- Unbekannte Codes (z. B. 0xFFFF) erscheinen als `---`. Der Wert 0 erscheint als `NOOP`, deshalb zeigt leerer Speicher `NOOP 0`.

## Flags der Rechen-, Logik- und Schiebebefehle (am Original ermittelt, Test 4)

Vorbelegung der Flags mit `CMPI` (C=1/N=1 bzw. V=1), dann der Befehl.

- `MUL`, `DIV`, `MOD`, `MULH`, `AND`, `OR`, `XOR`, `NOT`, `SHR`, `SHRA` setzen Z und N nach dem Ergebnis und **löschen V und C** (auch wenn sie vorher 1 waren).
- `SHL` setzt Z und N nach dem Ergebnis, löscht V und setzt **C = Bit 16 des 32-Bit-Ergebnisses**, also das zuletzt herausgeschobene Bit (`-32768 SHLI 1` → 0, Z=1, C=1; `3 SHLI 1` → C=0; `16384 SHLI 1` → −32768, N=1, V=0, C=0; `5 SHLI 16` → 0, Z=1, C=1). V wird auch bei Vorzeichenwechsel nicht gesetzt. Das gilt auch bei Schiebeweite ≥ 17: `5 SHLI 17` → 0, Z=1, **C=0** (Bit 16 von 0xA0000 ist 0, obwohl 1-Bits verloren gehen).
- `ADD` setzt Z und N nach dem Ergebnis, **V = vorzeichenbehafteter Überlauf**, **C = vorzeichenloser Übertrag** (`32767 ADDI 1` → −32768, V=1, C=0; `-1 ADDI 1` → 0, Z=1, V=0, C=1).
- `SHR`/`SHRA` setzen C **nicht**, auch wenn ein 1-Bit herausfällt (`3 SHRI 1` → 1, C=0; `1 SHRI 1` → 0, Z=1, C=0; `-1 SHRAI 1` → −1, N=1, C=0).
- `MUL` liefert die unteren 16 Bit des Produkts, Z und N nach diesem Ergebnis, und bestimmt V und C **getrennt**: **V = 1, wenn das vorzeichenbehaftete Produkt nicht in −32768…32767 passt**, **C = 1, wenn das Produkt der vorzeichenlos gelesenen Operanden nicht in 0…65535 passt**.
  - `300 MULI 300` → 24464, N=0, V=1, C=1 (90000 passt in keinen Bereich)
  - `200 MULI 200` → −25536, N=1, V=1, C=0 (40000 passt nur unsigned)
  - `-1 MULI 2` → −2, N=1, V=0, C=1 (65535 · 2 passt nur signed)
  - `-1 MULI -1` → 1, N=0, V=0, C=1 (65535 · 65535 passt nur signed)
- `MULH` setzt keine Überlaufflags: `300 MULHI 300` → 1, alle Flags 0.
- **`DIVU`, `MODU`, `MULHU`** (Test 5) lesen beide Operanden vorzeichenlos (0…65535), setzen Z nach dem Ergebnis und löschen V und C.
  - `-1 DIVUI 2` → 32767, `-1 MODUI 2` → 1, `7 DIVUI -1` → 0, `-32768 DIVUI -1` → 0, `-32768 MODUI -1` → −32768 (= 32768), `-1 MULHUI -1` → −2 (= 0xFFFE), `-1 MULHUI 2` → 1, `300 MULHUI 300` → 1.
  - **N ist bei diesen drei Befehlen immer 0**, auch wenn Bit 15 des Ergebnisses gesetzt ist: `-32768 DIVUI 1` → −32768, N=0; `-32768 MODUI -1` → −32768, N=0; `-1 MULHUI -1` → −2, N=0. Vorher gesetztes N=1 wird gelöscht (`3 DIVUI 1` → N=0). N wird also aus dem vorzeichenlosen Ergebnis bestimmt.
- `DIV`: `-32768 DIVI -1` → −32768 (Überlauf wird ohne Abbruch abgeschnitten), N=1, V=0, C=0.
- **`MULH` = vorzeichenbehaftetes Produkt / 65536, Richtung 0 gerundet** – also *nicht* das echte hohe Wort (arithmetisches Schieben). Belege: `-300 MULHI 300` → −1 (echtes hohes Wort wäre −2), `3 MULHI -1` → 0 (statt −1), `-32768 MULHI 1` → 0, `-32768 MULHI -1` → 0, `300 MULHI 300` → 1. Für positive Produkte stimmen beide Varianten überein. `MULH` setzt Z und N nach dem Ergebnis und löscht V und C.

## Funde im Manual

| Stelle | Fund | Umgang |
|---|---|---|
| 3.3 (EBNF) vs. 3.4 (Befehlsübersicht) | `JOV` und `JOC` stehen in der Befehlsübersicht, fehlen aber in der EBNF. | Beide werden als Aliase von `JMPV`/`JMPC` akzeptiert. |

## Bewusste Neuerungen gegenüber dem Original

- **Opcode-Ansicht** (Disassembler): Befehle werden in Eingabesyntax angezeigt, also `LOAD (11)` statt `LOAD @ 11` wie im Original, damit man sie direkt in den Editor kopieren kann. Auf Wunsch erscheinen Marken statt Adressen (`JMP Start`). Immediate-Werte werden mit Vorzeichen gezeigt (`LOADI -7`).
- Schritt zurück, Haltepunkte, Marken neben Speicherzellen, animierte Mikroschritte mit Erklärtext (siehe Projekt-Instruktionen, Abschnitt 6).
- **Division durch 0** (Vorschlag, Punkt 5): Die Maschine hält an, statt zurückzusetzen. Akku, Flags und Speicher bleiben unverändert, und der PC zeigt auf den auslösenden Befehl, damit man den Fehler untersuchen und mit „Schritt zurück“ zurückgehen kann. Die Meldung erscheint in der Oberfläche (Statuszeile, Befehl rot markiert), nicht als Browser-Pop-up, zum Beispiel: „Division durch 0 bei Adresse 6 (DIVI 0) – Programm angehalten.“ Das betrifft alle sechs Divisions- und Modulobefehle samt Immediate-Varianten.
- **Befehl `RESET`** (Punkt 7): Setzt wie der Knopf „Zurücksetzen“ Akku, PC, Befehlsregister und Flags auf 0 und hält die Maschine an. Anders als im Original **bleibt der Speicher erhalten**. Begründung: Für Anfänger wäre es verwirrend, wenn das eigene Programm aus dem Speicher verschwindet. Die Statuszeile meldet: „Programm hat RESET ausgeführt – Maschine zurückgesetzt und angehalten.“

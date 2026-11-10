# Kompatibilität zur Minimaschine 4.0

Hier stehen alle Punkte, die das Benutzermanual nicht eindeutig festlegt, sowie jede bewusste Abweichung vom Original.

Status: **offen** = noch nicht geklärt · **Annahme** = so umgesetzt, aber nicht am Original geprüft · **geklärt** = am Original (Webversion) überprüft

## Offene Punkte

| # | Thema | Status | Annahme / Notiz |
|---|---|---|---|
| 1 | Numerische Opcodes und Kodierung der Adressierungsart in Wort 1 | geklärt für den Standardmodus (Test 1 + 3a) | Siehe Abschnitt „Opcode-Tabelle“. Offen sind noch die Codes der SP-Adressierungsarten und der Stackbefehle (`JSR`, `RTS`, `PUSH`, `POP`, `RSV`, `REL`) → Test 3b im erweiterten Modus. |
| 2 | C-Flag bei `SUB`/`SUBI`/`CMP`/`CMPI` (Carry oder Borrow?) | geklärt (Test 1) | **Borrow:** C = 1 genau dann, wenn A < Operand (vorzeichenlos). 5−3 → C=0, 3−5 → C=1, 7−7 → C=0, 0−1 → C=1, 0xFFFF−1 → C=0, −32768−1 → C=0, V=1. `SUB` mit Adresse verhält sich wie `SUBI`. |
| 3 | V/C-Flag bei `MUL`, `DIV`, `MOD`, Shifts | offen | |
| 4 | `CMP`: Manual sagt „setzt Null- und Negativflag“, `JLO`/`JHI` nach Vergleich nutzen aber C | geklärt (Test 1) | `CMP`/`CMPI` setzen Z, N und C exakt wie `SUB`, der Akku bleibt unverändert. `JLO` springt nach `3 CMP 5`. |
| 4a | Flags bei Ladebefehlen | geklärt (Test 1) | `LOAD`/`LOADI`/`LOADC` setzen Z und N nach dem geladenen Wert und **löschen V und C**. `STORE` und Sprünge lassen die Flags unverändert. |
| 5 | Division durch 0 | geklärt (Test 2) – Abweichung geplant | **Original:** `DIV`/`DIVI` (auch mit negativem Dividenden), `MODI`, `DIVUI` und `MODUI` durch 0 brechen ab. Es erscheint ein Browser-Pop-up „Division durch 0“, und Akku, Flags usw. werden zurückgesetzt. **Eigene Lösung (freigegeben, muss nicht dem Original entsprechen):** siehe „Bewusste Neuerungen“. |
| 6 | Startwert des Stackpointers (SP) | offen | Vorläufig 0 in `createInitialState()`. |
| 7 | Verhalten von `RESET` als Befehl im Programm | offen | |
| 8 | Feinaufteilung der Mikroschritte (Holen – Dekodieren – Ausführen) | offen | |
| 9 | Dateiendung für Assemblerdateien | offen | Vermutlich `.mia` – Bestätigung ausstehend. |
| 10 | Shifts um ≥ 16 Stellen | offen | |
| 11 | Speicherlayout beim Assemblieren | beobachtet (Test 2) | Die Befehle liegen ab Adresse 0 lückenlos mit je 2 Worten, `WORD`-Zellen schließen direkt an. In Test 2 wurde `STORE schritt` zu Adresse 75 übersetzt (37 Befehle = 74 Worte, `null` = 74, `schritt` = 75). Mit auskommentierten Fällen ergaben sich andere Adressen, z. B. 73. Exakte Adressgleichheit mit dem Original ist kein Muss, wird aber notiert. |

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

## Funde im Manual

| Stelle | Fund | Umgang |
|---|---|---|
| 3.3 (EBNF) vs. 3.4 (Befehlsübersicht) | `JOV` und `JOC` stehen in der Befehlsübersicht, fehlen aber in der EBNF. | Beide werden als Aliase von `JMPV`/`JMPC` akzeptiert. |

## Bewusste Neuerungen gegenüber dem Original

- Schritt zurück, Haltepunkte, Marken neben Speicherzellen, animierte Mikroschritte mit Erklärtext (siehe Projekt-Instruktionen, Abschnitt 6).
- **Division durch 0** (Vorschlag, Punkt 5): Die Maschine hält an, statt zurückzusetzen. Akku, Flags und Speicher bleiben unverändert, und der PC zeigt auf den auslösenden Befehl, damit man den Fehler untersuchen und mit „Schritt zurück“ zurückgehen kann. Die Meldung erscheint in der Oberfläche (Statuszeile, Befehl rot markiert), nicht als Browser-Pop-up, zum Beispiel: „Division durch 0 bei Adresse 6 (DIVI 0) – Programm angehalten.“ Das betrifft alle sechs Divisions- und Modulobefehle samt Immediate-Varianten.

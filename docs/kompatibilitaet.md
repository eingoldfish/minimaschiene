# Kompatibilität zur Minimaschine 4.0

Hier stehen alle Punkte, die das Benutzermanual nicht eindeutig festlegt, sowie jede bewusste Abweichung vom Original.

Status: **offen** = noch nicht geklärt · **Annahme** = so umgesetzt, aber nicht am Original geprüft · **geklärt** = am Original (Webversion) überprüft

## Offene Punkte

| # | Thema | Status | Annahme / Notiz |
|---|---|---|---|
| 1 | Numerische Opcodes und Kodierung der Adressierungsart in Wort 1 | geklärt (Test 1, 3a, 3b) | Siehe Abschnitt „Opcode-Tabelle“. Erweiterter Modus gemessen: `JSR` = 5, `RTS` = 6, `PUSH` = 25, `POP` = 26; Adressierungsarten `adr(SP)` = 4, `@adr(SP)` = 5, `$adr(SP)` = 6 (z. B. `LOAD 2(SP)` = 1044, `STORE 2(SP)` = 1045, `JSR 8` = 261). `RSV`/`REL` gibt es im Original nicht (Punkt 22) und haben bei uns die freien Codes 27/28, als Immediate (Art 2) kodiert. |
| 2 | C-Flag bei `SUB`/`SUBI`/`CMP`/`CMPI` (Carry oder Borrow?) | geklärt (Test 1) | **Borrow:** C = 1 genau dann, wenn A < Operand (vorzeichenlos). 5−3 → C=0, 3−5 → C=1, 7−7 → C=0, 0−1 → C=1, 0xFFFF−1 → C=0, −32768−1 → C=0, V=1. `SUB` mit Adresse verhält sich wie `SUBI`. |
| 3 | V/C-Flag bei `MUL`, `DIV`, `MOD`, `MULH`, Shifts, Logikbefehlen | geklärt (Test 4 + 5) | Siehe Abschnitt „Flags der Rechen-, Logik- und Schiebebefehle“. |
| 4 | `CMP`: Manual sagt „setzt Null- und Negativflag“, `JLO`/`JHI` nach Vergleich nutzen aber C | geklärt (Test 1 + 6) | `CMP`/`CMPI` setzen Z, N, V und C exakt wie `SUB`, der Akku bleibt unverändert. `JLO` springt nach `3 CMP 5`. `-32768 CMPI 1` → V=1. |
| 4a | Flags bei Ladebefehlen | geklärt (Test 1) | `LOAD`/`LOADI`/`LOADC` setzen Z und N nach dem geladenen Wert und **löschen V und C**. `STORE` und Sprünge lassen die Flags unverändert. |
| 5 | Division durch 0 | geklärt (Test 2) – Abweichung geplant | **Original:** `DIV`/`DIVI` (auch mit negativem Dividenden), `MODI`, `DIVUI` und `MODUI` durch 0 brechen ab. Es erscheint ein Browser-Pop-up „Division durch 0“, und Akku, Flags usw. werden zurückgesetzt. **Eigene Lösung (freigegeben, muss nicht dem Original entsprechen):** siehe „Bewusste Neuerungen“. |
| 5a | `DIV`/`MOD` mit negativen Operanden | geklärt (Test 6) | Wie Java/JavaScript: **Quotient Richtung 0 gerundet**, **Rest hat das Vorzeichen des Dividenden**. `-7 DIVI 2` → −3, `-7 MODI 2` → −1, `7 MODI -2` → 1. |
| 6 | Startwert des Stackpointers (SP) | geklärt (Test 3b) | Nach „Zurücksetzen“ ist **SP = 65534**; nach `LOADI 7`, `PUSH` ist SP = 65533 (die 7 steht nicht in Zelle 0). Bei uns setzen auch der Befehl `RESET` und das Einschalten SP auf 65534. |
| 7 | Verhalten von `RESET` als Befehl im Programm | geklärt (Test 4 + 6) – Abweichung geplant | **Original, Befehl `RESET`:** setzt Akku, Programmzähler, Befehlsregister und Flags zurück, der Speicher (inkl. Programm) ist danach 0, die Maschine ist angehalten (nur „Zurücksetzen“ aktiv). **Original, Knopf „Zurücksetzen“:** setzt Akku, PC, Befehlsregister und Flags zurück, der **Speicher bleibt erhalten** (Screenshot Test 6). Befehl und Knopf verhalten sich also verschieden. **Eigene Lösung:** siehe „Bewusste Neuerungen“. |
| 8 | Feinaufteilung der Mikroschritte (Holen – Dekodieren – Ausführen) | Annahme (M4) | Eigene Aufteilung, zentral in `src/core/microcode.ts`: **Holen 1/2** (PC → Adressbus, Befehlswort → Befehlsregister, PC+1), **Holen 2/2** (Adressteil → Befehlsregister, PC+1), **Dekodieren**, dann **Ausführen** in 1–3 Schritten: [Adresse nachschlagen bei indirekt] [Operand holen bzw. Zahl aus dem Adressteil] Rechnen/Laden/Vergleichen bzw. Schreiben (STORE) bzw. Sprung prüfen. Beispiele: `LOAD 20` = 5, `LOAD (20)` = 6, `STORE 20` = 4, `JMP x` = 4 Mikroschritte. Im Original mit der Detaildarstellung prüfen und ggf. anpassen. |
| 9 | Dateiendung für Assemblerdateien | Annahme (M6) | `.mia`, zentral in `src/storage/files.ts` (`FILE_EXTENSION`). Beim Öffnen werden auch `.txt` und `.asm` angenommen. Im Original prüfen: Programm speichern und die Endung ansehen. |
| 10 | Shifts um ≥ 16 Stellen | geklärt (Test 4) | **Schiebeweite modulo 32, gerechnet auf 32 Bit, Ergebnis auf 16 Bit abgeschnitten** (wie JavaScript `<<`, `>>>`, `>>`). `5 SHLI 16` = 0, `5 SHLI 17` = 0, `5 SHLI 100` = 80 (100 mod 32 = 4), `5 SHLI -1` = 0 (−1 mod 32 = 31), `-1 SHRI 16` = 0, `-32768 SHRAI 16` = −1, `-32768 SHRAI 15` = −1, `5 SHLI 0` = 5. Weder Modulo 16 noch Fehlermeldung. |
| 11 | Speicherlayout beim Assemblieren | beobachtet (Test 2) | Die Befehle liegen ab Adresse 0 lückenlos mit je 2 Worten, `WORD`-Zellen schließen direkt an. In Test 2 wurde `STORE schritt` zu Adresse 75 übersetzt (37 Befehle = 74 Worte, `null` = 74, `schritt` = 75). Mit auskommentierten Fällen ergaben sich andere Adressen, z. B. 73. Exakte Adressgleichheit mit dem Original ist kein Muss, wird aber notiert. |
| 12 | Ungültiger Befehlscode | geklärt (Java-Quelltext) | Maschine hält an, der **PC steht wie im Original schon hinter dem Befehl** (+2); die Meldung nennt die Adresse des fehlerhaften Befehls, im Editor wird seine Zeile rot markiert. Ungültig sind: unbekannter Opcode oder unbekannte Art, eine Art, die der Befehl nicht erlaubt (z. B. `STORE` immediate = 0x0215, `NOT` mit Art 1, Sprünge mit Art 2), **ein Adressteil ≠ 0 bei Befehlen ohne Adresse** (z. B. `NOOP 5`) und **Stackbefehle ohne erweiterten Modus**. Nicht übernommen: Das Original nimmt auch Arten 7–255 an (Operand 0); das ist nur durch Speicher-Editieren erreichbar. |
| 13 | PC nach `HALT` | Annahme (M1) | Der PC zeigt hinter den `HALT`-Befehl (normaler Befehlszyklus: PC wird beim Holen um 2 erhöht). |
| 14 | Indirekte Sprünge (`JMP (adr)`) | geklärt (Java-Quelltext) | **Erlaubt** wie im Original: Alle Sprünge und `JSR` akzeptieren `(adr)` und springen zur Adresse, die in Zelle `adr` steht (z. B. `JMP (10)` = 0x0324). `JSR` liest das Sprungziel, bevor der Stack verändert wird. Nicht übernommen: Sprünge mit `@x(SP)` und `JSR` mit `x(SP)`/`$x(SP)`, siehe `abgleich-java.md`. |
| 15 | Groß-/Kleinschreibung bei Marken | geklärt (Java-Quelltext) | Marken unterscheiden Groß- und Kleinschreibung (`Ende` ≠ `ende`), Befehle nicht. Bei einem Treffer, der sich nur in der Schreibweise unterscheidet, gibt der Assembler einen Hinweis. Im Original prüfen. |
| 16 | Befehlsnamen als Marken | geklärt (Java-Quelltext) | **Erlaubt** wie im Original (z. B. `load:`, `WORD:`, `JMP load`). Nur `SP` (in jeder Schreibweise) ist im erweiterten Modus als Marke verboten. |
| 17 | Negative Zahlen und Marken als Zahlenwert | Annahme (M2) | Negative Zahlen (−32768 … −1) gibt es nur bei Immediate (`LOADI -7`, `ADD $-1`) und `WORD`. Eine negative Adresse (`LOAD -1`) ist ein Fehler. `LOADI Marke` und `WORD Marke` sind erlaubt und liefern die Adresse der Marke. |
| 18 | Reihenfolge bei `PUSH`/`POP`/`JSR`/`RTS` | `PUSH` geklärt (Test 3b), Rest Annahme | `PUSH` verringert erst SP und schreibt dann nach Speicher[SP]: nach `LOADI 7`, `PUSH`, `LOAD 0(SP)` steht 7 im Akku, die 7 liegt also in Zelle 65533. Entsprechend (Annahme, passend zum Manual): `JSR` erst SP − 1, dann Rücksprungadresse ablegen; `POP` und `RTS` erst lesen, dann SP + 1. |
| 19 | Flags der Stackbefehle | `POP` geklärt (Test 3b), Rest Annahme | `POP` setzt Z/N wie `LOAD` und löscht V und C: nach `LOADI -5`, `PUSH`, `LOADI 1`, `CMPI 2` (N=1, C=1) liefert `POP` Akku = −5 mit N=1, Z=V=C=0. `PUSH`, `JSR`, `RTS`, `RSV`, `REL` lassen die Flags unverändert (Annahme). |
| 20 | Stackbefehle ohne erweiterten Modus | geklärt (Java-Quelltext) | Der Assembler lehnt Stackbefehle und SP-Adressierung ohne „Erweiterter Modus“ ab. Die CPU behandelt `JSR`, `RTS`, `PUSH`, `POP`, `RSV`, `REL` wie im Original als ungültigen Befehlscode, wenn der erweiterte Modus aus ist. Umschalten des Modus setzt die CPU zurück (Desktopversion), der Speicher bleibt. |
| 21 | Negative Offsets bei SP-Adressierung | Annahme (M5) | `LOAD -1(SP)` ist erlaubt (Adresse = SP − 1, mit Überlauf modulo 65536). |
| 22 | `RSV` und `REL` im Original | beobachtet (Test 3b) – Abweichung | `JSR 8`, `RTS`, `PUSH`, `POP`, `LOAD 2(SP)`, `LOAD @2(SP)`, `LOAD $2(SP)` und `STORE 2(SP)` lassen sich im Original assemblieren, `RSV 3` und `REL 3` nicht – obwohl beide im Manual (3.3 EBNF und 3.4 Befehlsübersicht) stehen. Bei uns bleiben `RSV` und `REL` erhalten, siehe „Bewusste Neuerungen“. In der Ansicht „Opcodes anzeigen“ zeigt das Original alle drei SP-Arten nur als `LOAD 2` (ohne `@`, `$` oder `(SP)`). |

## Noch am Original zu prüfen (Stand M7)

Diese Annahmen sind umgesetzt, aber nicht am Original überprüft. Jeder Test dauert nur einen Moment in der Webversion des Originals. Wenn ein Ergebnis abweicht, wird die Tabelle oben angepasst und ein Test ergänzt.

| # | So prüfen | Unsere Annahme |
|---|---|---|
| 9 | Ein Programm speichern und die Dateiendung ansehen | `.mia` |
| 13 | `LOADI 1`, `HALT` ausführen, PC ansehen | PC = 4 (hinter `HALT`) |
| 15 | `JMP ende` mit der Marke `Ende:` assemblieren | Fehler, Marken unterscheiden Groß-/Kleinschreibung |
| 17 | `LOAD -1` assemblieren | Fehler; nur Immediate und `WORD` erlauben negative Zahlen |
| 18 | Erweitert: `JSR 6`, `HALT`, `HALT`, `RTS` – vor/nach `JSR` SP und Zelle 65533 ansehen | `JSR` verringert erst SP, dann wird die Rücksprungadresse 2 (der Befehl nach `JSR`) geschrieben |
| 19 | Erweitert: `LOADI -1`, `CMPI 5`, `PUSH` – Flags vor und nach `PUSH` | `PUSH`, `JSR`, `RTS` ändern die Flags nicht |
| 21 | Erweitert: `LOADI 7`, `PUSH`, `LOAD -1(SP)` assemblieren | erlaubt (Adresse SP − 1) |

Punkt 8 (genaue Aufteilung der Mikroschritte) und Punkt 20 (Stackbefehle ohne erweiterten Modus) sind eigene didaktische Entscheidungen und müssen nicht dem Original entsprechen.

## Opcode-Tabelle (am Original ermittelt)

**Wort 1 = Adressierungsart · 256 + Opcode** (High-Byte = Art, Low-Byte = Opcode). Wort 2 = Adressteil, bei Befehlen ohne Adresse 0.

| Art (High-Byte) | Bedeutung | Beispiel |
|---|---|---|
| 0 | ohne Adresse | `NOT` = 0x0038 |
| 1 | direkt `adr` (auch alle Sprünge, `STORE`) | `LOAD 11` = 0x0114 |
| 2 | immediate `$adr` | `LOAD $11` = `LOADI 11` = 0x0214 |
| 3 | indirekt `(adr)` | `LOAD (11)` = 0x0314 |
| 4 / 5 / 6 | `adr(SP)`, `@adr(SP)`, `$adr(SP)` (nur erweiterter Modus) | `LOAD 2(SP)` = 0x0414, `LOAD @2(SP)` = 0x0514, `LOAD $2(SP)` = 0x0614 |

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

Erweiterter Modus (Test 3b): 5 (0x05) = `JSR`, 6 (0x06) = `RTS`, 25 (0x19) = `PUSH`, 26 (0x1A) = `POP`. Eigene Codes ohne Gegenstück im Original: 27 (0x1B) = `RSV`, 28 (0x1C) = `REL`.

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

## Speicher und Bedienung wie im Original (Java-Quelltext)

- **Oberste Zellen:** Nach dem Start, nach „Speicher löschen“ und beim Assemblieren (ohne „Speicher behalten“) stehen in den Zellen 65534 und 65535 jeweils −1 (0xFFFF), alle anderen Zellen sind 0. Ein Programm, das ohne `HALT` durch den leeren Speicher läuft, hält deshalb dort mit „ungültiger Befehl“ an. Beim Kopieren des Speichers zählen diese beiden Zellen mit −1 als leer.
- **„Speicher löschen“** (Speicherbereich): löscht den Speicher, Akku, Befehlszähler und Flags bleiben.
- **Ohne Assemblieren ausführen:** Die CPU führt aus, was im Speicher steht, auch wenn man ihn nur von Hand gefüllt hat. Nur bei völlig leerem Speicher kommt der Hinweis „zuerst assemblieren“.
- **Hex-Ansicht:** Beim Bearbeiten einer Zelle wird die Eingabe als Hexzahl gelesen, auch ohne `0x` (`10` = 16, `FF` = 255). Negative Dezimalzahlen wie `-5` gehen weiterhin.

## Zeichen in Marken

Wie im Original darf in Marken auch der Unterstrich `_` vorkommen, auch am Anfang (`my_label:`, `_start:`). Sonst: Buchstaben inkl. Ä Ö Ü ä ö ü ß und Ziffern (nicht am Anfang).

## Funde im Manual

| Stelle | Fund | Umgang |
|---|---|---|
| 3.3 (EBNF) vs. 3.4 (Befehlsübersicht) | `JOV` und `JOC` stehen in der Befehlsübersicht, fehlen aber in der EBNF. | Beide werden als Aliase von `JMPV`/`JMPC` akzeptiert. |

## Bewusste Neuerungen gegenüber dem Original

- **Zweisprachig (Deutsch/Englisch):** Die gesamte Oberfläche ist umschaltbar, auch Assemblermeldungen, Mikroschritt-Erklärungen, Befehlshilfe und Beispielprogramme. Die Befehlsnamen (Mnemonics) bleiben gleich, Programme laufen also in beiden Sprachen.
- **Kopierknöpfe:** Programmtext und Speicher lassen sich kopieren. Beim Speicher wird nur bis zur letzten belegten Zelle kopiert, als Tabelle wie angezeigt; ein benutzter Stack kommt als eigener Block dazu.
- **Beamer-Modus:** große Schrift und automatisch helle Farben.
- **Befehlshilfe** (Tooltip im Editor) darf über den Rand des Editors hinausragen.

- **`RSV n` / `REL n`** (M5, Punkt 22): `RSV 3` und `REL 3` ließen sich im Original nicht assemblieren; bei uns gibt es beide Befehle wie im Manual beschrieben (SP − n bzw. SP + n). Sie reservieren bzw. geben Platz für lokale Variablen auf dem Stack frei. Programme, die sie benutzen, laufen deshalb evtl. nicht im Original.
- **Speichern, Teilen, Offline** (M6): automatisches Speichern im Browser, Teilen-Link mit dem komprimierten Programm im URL-Fragment (`#code=…`, kein Server), Offline-Nutzung als PWA, sechs eigene Beispielprogramme (Multiplikation, Summe, Maximum, Fakultät, ggT, Unterprogramm).
- **Mikroschritte mit Erklärung** (M4): Zu jedem Mikroschritt erscheint ein Erklärtext mit den konkreten Werten; Werte wandern animiert über die Busse (abschaltbar, bei `prefers-reduced-motion` aus). Auch Mikroschritte lassen sich mit „Schritt zurück“ einzeln zurücknehmen; „Schritt“ führt einen angefangenen Befehl zu Ende.
- **Abbruchschranke** (M3): Sie greift nur beim Tempo „Maximal“. Bei langsamem Tempo sieht man das Programm laufen und kann jederzeit „Pause“ drücken; eine Zeitgrenze würde dort längere, aber korrekte Programme abbrechen. Wenn sie greift, sind wie im Original „Ausführen“ und „Schritt“ gesperrt, bis man zurücksetzt oder neu assembliert („Schritt zurück“ geht weiterhin).
- **Hervorhebung nach HALT** (M3): Der PC zeigt nach `HALT` hinter den Befehl (Punkt 13). Im Editor wird trotzdem die `HALT`-Zeile markiert, weil die nächste Zeile oft schon Daten sind.
- **Zuletzt geänderte Zelle** (M3): bleibt markiert, bis die nächste Zelle geschrieben wird (durch `STORE` oder durch Bearbeiten im Speicher). Wie im Original bleibt sie auch beim Zurücksetzen markiert; „Speicher löschen“ entfernt die Markierung.
- **Opcode-Ansicht** (Disassembler): Befehle werden in Eingabesyntax angezeigt, also `LOAD (11)` statt `LOAD @ 11` wie im Original, damit man sie direkt in den Editor kopieren kann. Auf Wunsch erscheinen Marken statt Adressen (`JMP Start`). Immediate-Werte werden mit Vorzeichen gezeigt (`LOADI -7`).
- Schritt zurück, Haltepunkte, Marken neben Speicherzellen, animierte Mikroschritte mit Erklärtext (siehe Projekt-Instruktionen, Abschnitt 6).
- **Division durch 0** (Vorschlag, Punkt 5): Die Maschine hält an, statt zurückzusetzen. Akku, Flags und Speicher bleiben unverändert, und der PC zeigt auf den auslösenden Befehl, damit man den Fehler untersuchen und mit „Schritt zurück“ zurückgehen kann. Die Meldung erscheint in der Oberfläche (Statuszeile, Befehl rot markiert), nicht als Browser-Pop-up, zum Beispiel: „Division durch 0 bei Adresse 6 (DIVI 0) – Programm angehalten.“ Das betrifft alle sechs Divisions- und Modulobefehle samt Immediate-Varianten.
- **Befehl `RESET`** (Punkt 7): Setzt wie der Knopf „Zurücksetzen“ Akku, PC, Befehlsregister und Flags auf 0 und hält die Maschine an. Anders als im Original **bleibt der Speicher erhalten**. Begründung: Für Anfänger wäre es verwirrend, wenn das eigene Programm aus dem Speicher verschwindet. Die Statuszeile meldet: „Programm hat RESET ausgeführt – Maschine zurückgesetzt und angehalten.“

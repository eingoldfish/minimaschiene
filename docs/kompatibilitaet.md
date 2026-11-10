# Kompatibilität zur Minimaschine 4.0

Hier stehen alle Punkte, die das Benutzermanual nicht eindeutig festlegt, sowie jede bewusste Abweichung vom Original.

Status: **offen** = noch nicht geklärt · **Annahme** = so umgesetzt, aber nicht am Original geprüft · **geklärt** = am Original (Webversion) überprüft

## Offene Punkte

| # | Thema | Status | Annahme / Notiz |
|---|---|---|---|
| 1 | Numerische Opcodes und Kodierung der Adressierungsart in Wort 1 | teilweise geklärt | Aus dem Speicherabzug von Test 1: Wort 1 = Adressierungsart · 256 + Opcode. Art: 0 = ohne Adresse, 1 = direkt (auch Sprünge), 2 = immediate. `LOADI` ist identisch mit `LOAD $`. Bekannte Opcodes: `SUB` 11, `CMP` 15, `LOAD` 20, `STORE` 21, `LOADC` 22, `JMP` 36, `JLO` 42, `HALT` 99. Codes der übrigen Befehle und der Arten indirekt/SP-Modi → Test 3. |
| 2 | C-Flag bei `SUB`/`SUBI`/`CMP`/`CMPI` (Carry oder Borrow?) | geklärt (Test 1) | **Borrow:** C = 1 genau dann, wenn A < Operand (vorzeichenlos). 5−3 → C=0, 3−5 → C=1, 7−7 → C=0, 0−1 → C=1, 0xFFFF−1 → C=0, −32768−1 → C=0, V=1. `SUB` mit Adresse verhält sich wie `SUBI`. |
| 3 | V/C-Flag bei `MUL`, `DIV`, `MOD`, Shifts | offen | |
| 4 | `CMP`: Manual sagt „setzt Null- und Negativflag“, `JLO`/`JHI` nach Vergleich nutzen aber C | geklärt (Test 1) | `CMP`/`CMPI` setzen Z, N und C exakt wie `SUB`, der Akku bleibt unverändert. `JLO` springt nach `3 CMP 5`. |
| 4a | Flags bei Ladebefehlen | geklärt (Test 1) | `LOAD`/`LOADI`/`LOADC` setzen Z und N nach dem geladenen Wert und **löschen V und C**. `STORE` und Sprünge lassen die Flags unverändert. |
| 5 | Division durch 0 | offen | |
| 6 | Startwert des Stackpointers (SP) | offen | Vorläufig 0 in `createInitialState()`. |
| 7 | Verhalten von `RESET` als Befehl im Programm | offen | |
| 8 | Feinaufteilung der Mikroschritte (Holen – Dekodieren – Ausführen) | offen | |
| 9 | Dateiendung für Assemblerdateien | offen | Vermutlich `.mia` – Bestätigung ausstehend. |
| 10 | Shifts um ≥ 16 Stellen | offen | |

## Funde im Manual

| Stelle | Fund | Umgang |
|---|---|---|
| 3.3 (EBNF) vs. 3.4 (Befehlsübersicht) | `JOV` und `JOC` stehen in der Befehlsübersicht, fehlen aber in der EBNF. | Beide werden als Aliase von `JMPV`/`JMPC` akzeptiert. |

## Bewusste Neuerungen gegenüber dem Original

- Schritt zurück, Haltepunkte, Marken neben Speicherzellen, animierte Mikroschritte mit Erklärtext (siehe Projekt-Instruktionen, Abschnitt 6).

# Kompatibilität zur Minimaschine 4.0

Hier stehen alle Punkte, die das Benutzermanual nicht eindeutig festlegt, sowie jede bewusste Abweichung vom Original.

Status: **offen** = noch nicht geklärt · **Annahme** = so umgesetzt, aber nicht am Original geprüft · **geklärt** = am Original (Webversion) überprüft

## Offene Punkte

| # | Thema | Status | Annahme / Notiz |
|---|---|---|---|
| 1 | Numerische Opcodes und Kodierung der Adressierungsart in Wort 1 | offen | Eigene Kodierung, zentral in `src/core/isa.ts`. Betrifft nur Anzeige „Opcodes“ und Speicher-Editieren. |
| 2 | C-Flag bei `SUB`/`SUBI`/`CMP`/`CMPI` (Carry oder Borrow?) | offen | |
| 3 | V/C-Flag bei `MUL`, `DIV`, `MOD`, Shifts | offen | |
| 4 | `CMP`: Manual sagt „setzt Null- und Negativflag“, `JLO`/`JHI` nach Vergleich nutzen aber C | offen | Vermutlich setzt `CMP` alle vier Flags wie `SUB`. |
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

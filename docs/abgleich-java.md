# Abgleich mit der Java-Desktopversion 4.0 (dekompiliert)

Stand: 11.11.2026. Grundlage: dekompilierte Quellen in `decompiled_app_old/` (Über-Dialog: „V4.0“). Es wurde nur **Verhalten** verglichen, kein Code übernommen. Eine Java-Laufzeit war nicht installiert. Das Java-Verhalten stammt deshalb aus dem Lesen des Codes, das Verhalten der Web-App wurde mit Vitest überprüft.

Einschränkung: Zwei Methoden der Detail-CPU (`CpuDetail.MikroSchritt`, `Excecute1`) ließen sich nicht dekompilieren. Für die Mikroschritte wurde ergänzend die Webversion des Originals gelesen (`CPUs.js`), deren übrige Logik fast Zeile für Zeile der Java-Version entspricht.

Legende: **A** = Web-App lehnt ab, was das Original annimmt (oder umgekehrt) · **E** = anderes Ergebnis bei der Ausführung · **U** = Oberfläche/Bedienung · ✅ = bewusste Neuerung laut `kompatibilitaet.md`

## 1. Assembler: Was wird angenommen, was abgelehnt?

| # | Eingabe | Original | Web-App | Art |
|---|---|---|---|---|
| 1 | `my_label:`, `_x:` (Unterstrich in Marken) | erlaubt | ~~Fehler~~ **angeglichen**: erlaubt | – |
| 2 | Befehlsname als Marke (`load:`, `word:`) | erlaubt; nur `SP`/`sp` im erweiterten Modus verboten | ~~Fehler~~ **angeglichen**: erlaubt, `SP` nur im erweiterten Modus verboten | – |
| 3 | `Load 5` (gemischte Schreibweise) | Fehler, nur `LOAD` oder `load` | erlaubt | A |
| 4 | `LOAD 5(Sp)` | Fehler, nur `SP`/`sp` | erlaubt | A |
| 5 | `WORD +5`, `LOADI +5`, `ADD $+5` | erlaubt | Fehler | A |
| 6 | Zahlen außerhalb 16 Bit (`LOAD 70000`, `LOADI -40000`) | ohne Meldung modulo 65536 | Fehler | A (Web-App ist strenger, sinnvoll) |
| 7 | `JMP (10)`, `JMPZ (x)`; erweitert `JMPZ @2(SP)` | erlaubt (indirekter Sprung) | **angeglichen** für `(adr)`; `@2(SP)` bei Sprüngen weiter Fehler | A (Rest) |
| 8 | `JSR (4)`, `JSR 2(SP)`, `JSR @2(SP)`, `JSR $2(SP)` | erlaubt | **angeglichen** für `JSR (4)`; SP-Arten weiter Fehler | A (Rest) |
| 9 | `LOAD -1(SP)`, `LOAD @-1(SP)` | Fehler; Minus nur bei `$-1(SP)` | erlaubt | A |
| 10 | Marke als SP-Offset (`LOAD x(SP)`) | Fehler | erlaubt | A |
| 11 | `LOAD (SP)`, `LOAD @(SP)` | erlaubt als `0(SP)` bzw. `@0(SP)` | Fehler | A |
| 12 | `RSV $3` / `REL $3` | erlaubt, Opcodes **7/8**, nur mit `$` | **angeglichen**: `RSV $3`, Opcodes 7/8; `RSV 3` Fehler | – |
| 13 | `RSV $3` ohne erweiterten Modus | wird assembliert, CPU meldet dann „Illegaler Befehlscode“ | Fehler beim Assemblieren | A |
| 14 | `a$b:` (Dollar in Marke) / `LOAD$5` | Marke erlaubt / ein Bezeichner, Fehler | Fehler / als `LOAD $5` gelesen | A (Randfall) |
| 15 | geschütztes Leerzeichen, Seitenvorschub | unerlaubtes Zeichen | als Leerraum akzeptiert | A (Randfall) |
| 16 | `NOOP 5`, `JMPV $3`, `AND` ohne Operand, `STORE $2(SP)` | wird assembliert, CPU meldet zur Laufzeit „Illegaler Befehlscode“ | Fehler beim Assemblieren | A (Web-App ist strenger, sinnvoll) |
| 17 | mehrere Fehler | nur der **erste** wird angezeigt; undefinierte Marken immer am Textende | alle Fehler mit Zeile | ✅ (freundlichere Meldungen) |
| 18 | Assemblieren mit Fehler | Speicher ist schon gelöscht; bei „Speicher behalten“ sind die Zellen 0 … pc−1 auf 0 gesetzt | Speicher bleibt unverändert | A |

**Übereinstimmung:** `#`-Kommentare, Zeilenenden, Zeilen nur mit Marke, eine Marke pro Zeile, Doppelpunkt nötig, doppelte und undefinierte Marken, Vorwärtsverweise, Speicherlayout (2 Worte je Befehl, 1 je `WORD`, ab 0 lückenlos), Kodierung (Art · 256 + Opcode), alle anderen Opcodes und Aliase, Umlaute/ß in Marken, Groß-/Kleinschreibung von Marken, `.mia`, Stackbefehle nur im erweiterten Modus.

## 2. CPU: Ausführung

| # | Thema | Original | Web-App | Art |
|---|---|---|---|---|
| 19 | Zellen 65534 und 65535 nach Start, „Speicher löschen“, Assemblieren und Befehl `RESET` | **−1 (0xFFFF)** | **angeglichen** (auch Befehl `RESET`) | – |
| 20 | PC nach illegalem Befehlscode | hinter dem Befehl (+2) | **angeglichen** | – |
| 21 | Befehle ohne Adresse (`NOOP`, `RESET`, `LOADC`, `NOT`, `HALT`, `RTS`, `PUSH`, `POP`) mit Adressteil ≠ 0 | illegal | **angeglichen** | – |
| 22 | Sprünge mit Art 3 (indirekt), `JSR` mit Art 3–6 | werden ausgeführt | **angeglichen** für Art 3; Art 4–6 weiter illegal | E (Rest) |
| 23 | Rechen-/`LOAD`-Befehle mit Art 7–255 | legal, Operand 0; `STORE` mit Art 7+ wie direkt | illegal | E (nur durch Speicher-Editieren erreichbar) |
| 24 | Stackbefehle (5, 6, 7, 8, 25, 26) ohne erweiterten Modus | illegal | **angeglichen** | – |
| 25 | `$adr(SP)` (Art 6) | Operand = adr + SP **ohne** Kürzen auf 16 Bit, beeinflusst V/C | auf 16 Bit gekürzt | E (Randfall) |
| 26 | `MUL`: C-Flag, `MULHU`: Ergebnis | 32-Bit-Überlauf in Java: `-1 MULI -1` → C=0; `-1 MULHUI -1` → −1 | C=1 bzw. −2 | E, **nur Desktop**: Die Webversion des Originals liefert wie die Web-App C=1 bzw. −2 (gemessen, siehe `kompatibilitaet.md`). Web-App so lassen. |
| 27 | Division durch 0 | Desktop: Meldung, Programm läuft **weiter** (A bleibt, V=C=1). Web: Rücksetzen | hält an | ✅ |
| 28 | Nach Ende eines Laufs (HALT, illegal, Zeitschranke) | Ausführen/Schritt gesperrt bis Zurücksetzen oder Assemblieren | **angeglichen** („Schritt zurück“ bleibt möglich ✅) | – |
| 29 | SP-Arithmetik | interner Tippfehler (−32268 statt −32768), wirkt praktisch nie | sauber modulo 65536 | nicht nachbauen |

**Übereinstimmung:** alle Opcodes (auch RSV/REL), Ergebnisse und Flags von ADD, SUB, CMP, DIV, MOD, DIVU, MODU, MULH, LOAD, LOADC, AND, OR, XOR, NOT, SHL/SHR/SHRA (Schiebeweite mod 32, C bei SHL), alle 13 Sprungbedingungen, Flags bei STORE/Sprüngen unverändert, Adressierungsarten 1–5, PC-Überlauf, PC nach `HALT` (+2), `PUSH`/`POP`/`JSR`/`RTS`-Reihenfolge und -Flags, SP-Start 65534, Zurücksetzen behält den Speicher, Zeitschranke 5 s.

## 3. Mikroschritte (Punkt 8, eigene didaktische Entscheidung)

Das Original kennt die Zustände: Holen Befehl → Holen Adressteil → [Holen indirekt] → Dekodieren → Ausführen 1 → [Ausführen 2] → **Abschluss** (eigener Tastendruck, leert Busse und ALU).

| Befehl | Original (mit Abschluss) | Web-App |
|---|---|---|
| `LOAD`/`LOADI`, `STORE`, Sprünge, `NOOP`, `HALT`, `LOADC` | 5 | LOAD 5, STORE 4, JMP 4, NOOP/HALT 4 |
| `ADD`/`ADDI`/`CMP`/`NOT`, `PUSH`, `POP`, `JSR`, `RTS` | 6 | ADD 5, NOT 4, PUSH 5, POP 6, JSR 6, RTS 5 |
| zusätzlich bei `(adr)` / `@x(SP)` | +1 | +1 |
| bei `x(SP)` / `$x(SP)` | +0 (Adresse wird beim Holen in der ALU berechnet) | +1 (eigener Schritt „Adresse berechnen“) |

Weitere Unterschiede:
- Die indirekte Adresse wird im Original **vor** dem Dekodieren geholt, in der Web-App danach.
- Das Befehlsregister zeigt im Original bis zum Dekodieren die rohe Zahl (z. B. 266) und erst dann den Befehlsnamen.
- Der Stackpointer ±1 wird im Original in der ALU angezeigt.
- Nach einem ganzen Schritt sind im Original ALU und Busse leer. Die Web-App zeigt die letzte Rechnung weiter an (`lastAlu`).
- Das Original hat drei getrennte Fenster: Programm (4 Zellen), Daten (2) und Stack (3). Die Web-App hat ein gemeinsames Fenster mit 7 Zeilen.
- Im Original folgt das Diagramm dem gewählten Zahlenformat (hex, ohne Vorzeichen). Die Web-App zeigt es immer mit Vorzeichen in dezimal.

## 4. Oberfläche und Bedienung

| # | Thema | Original | Web-App |
|---|---|---|---|
| 30 | Speicher editieren in der Hex-Ansicht | Eingabe wird als Hex gelesen (`10` = 16, `FF` ohne `0x` erlaubt) | **angeglichen** |
| 31 | „Speicher löschen“ (ohne CPU-Reset) | vorhanden | **angeglichen** |
| 32 | Speicher nur von Hand bearbeitet, nie assembliert | CPU führt aus, was im Speicher steht | **angeglichen** (Hinweis nur bei ganz leerem Speicher) |
| 33 | Erweiterten Modus umschalten | Desktop: CPU wird zurückgesetzt | **angeglichen** (plus Hinweis „neu assemblieren“) |
| 34 | Zurücksetzen und Markierung „zuletzt geändert“ | Markierung bleibt | **angeglichen** |
| 35 | Hex-Format | Speicher `00FF`, CPU `00ff`, ohne Präfix | `0x00FF` |
| 36 | Opcode-Ansicht bei unzulässigen Kombinationen (z. B. 0x0138) | zeigt den Befehlsnamen | `---` |
| 37 | Opcode-Ansicht, Adressteil | immer mit Vorzeichen (`-25536`) | ohne Vorzeichen bzw. Marke |
| 38 | Flags | `*` oder leer | 0/1 |
| 39 | Speicher editieren | muss erst eingeschaltet werden | immer möglich |

## 5. Korrekturen für `kompatibilitaet.md`

| Punkt | Bisher | Laut Java-Code |
|---|---|---|
| 1 / 22 | RSV/REL gibt es im Original nicht | Es gibt sie: Opcodes 7/8, Schreibweise `RSV $3`. Im Test wurde `RSV 3` ohne `$` probiert. – **übernommen** |
| 9 | `.mia` (Annahme) | bestätigt |
| 12 | PC bleibt auf illegalem Befehl | PC steht dahinter (+2); andere Regeln, was illegal ist (Nr. 21–24) – **übernommen** (außer Nr. 22/23) |
| 13 | PC nach HALT = +2 (Annahme) | bestätigt |
| 14 | keine indirekten Sprünge | Original erlaubt `JMP (adr)` – **übernommen** |
| 15 | Marken unterscheiden Groß-/Kleinschreibung | bestätigt |
| 16 | Befehlsnamen als Marken verboten | Original erlaubt sie (außer `SP`) – **übernommen** |
| 17 | negative Zahlen nur bei Immediate/WORD | bestätigt, zusätzlich `+` erlaubt und keine Bereichsprüfung |
| 18 / 19 | Reihenfolge und Flags von JSR/RTS/PUSH (Annahme) | bestätigt |
| 20 | CPU führt Stackbefehle auch ohne erweiterten Modus aus | Original: illegal – **übernommen** |
| 21 | `LOAD -1(SP)` erlaubt | Original: Fehler |
| 5 | Division durch 0 setzt zurück | gilt für die Webversion; die Desktopversion läuft weiter |

# Minimaschine Web

**Ein Modellrechner zum Anfassen – direkt im Browser.**

👉 **Loslegen:** https://eingoldfish.github.io/minimaschiene/

Die Minimaschine ist ein stark vereinfachter Computer, an dem man sieht, was in einem echten Prozessor passiert: Wie ein Befehl aus dem Speicher geholt, entschlüsselt und ausgeführt wird, wie der Akkumulator rechnet und wie Flags und Sprünge Schleifen und Verzweigungen möglich machen. Man schreibt kleine Programme in Assembler, übersetzt sie und lässt sie Schritt für Schritt – oder sogar Mikroschritt für Mikroschritt – laufen.

Gedacht ist das Ganze für den Informatikunterricht (z. B. Oberstufe, Thema „Aufbau und Funktionsweise eines Rechners“), zum Üben zu Hause und für alle, die verstehen wollen, wie ein Computer auf unterster Ebene arbeitet. Installation ist nicht nötig; nach dem ersten Besuch funktioniert die Seite auch offline, am Laptop, Tablet und Smartphone.

## Woher die Idee kommt

Das Vorbild und die **Hauptquelle** ist die **Minimaschine von A. Wiedemann**: **https://schule.awiedemann.de/**
Dort gibt es das Original-Programm (Java), das Handbuch und weiteres Unterrichtsmaterial. Wer die Maschine gründlich verstehen oder im Unterricht einsetzen will, sollte dort zuerst nachlesen.

Diese Web-Version ist eine **eigenständige, inoffizielle Nachbildung**: Sie verhält sich wie die Minimaschine 4.0 und versteht dieselben Programme, wurde aber komplett neu geschrieben, damit sie ohne Java direkt im Browser läuft. Sie ist kein Produkt von A. Wiedemann.

Ehrlicher Hinweis: Das Projekt ist größtenteils **„gevibecoded“**, also mit Hilfe einer KI (Claude) programmiert. Das Verhalten wurde mit vielen Tests gegen das Original abgeglichen – trotzdem können Fehler drin sein. Im Zweifel gilt das Original.

## Wie die Maschine aufgebaut ist

- **Speicher:** 65 536 Zellen (Adressen 0 bis 65535), jede enthält eine 16-Bit-Zahl. Programm und Daten liegen im selben Speicher.
- **Akkumulator (A):** das einzige Rechenregister. Fast jeder Befehl arbeitet mit ihm: Werte werden in den Akku geladen, mit ihm verrechnet und wieder gespeichert.
- **Befehlszähler (PC):** die Adresse des nächsten Befehls.
- **Befehlsregister:** der gerade ausgeführte Befehl.
- **Flags** – sie beschreiben das Ergebnis der letzten Rechnung und steuern die bedingten Sprünge:
  - **Z** (Zero): Ergebnis war 0
  - **N** (Negativ): Ergebnis war negativ
  - **V** (Overflow): Überlauf beim Rechnen mit Vorzeichen
  - **C** (Carry): Überlauf ohne Vorzeichen bzw. „Borgen“ beim Subtrahieren
- **Stackpointer (SP):** nur im *erweiterten Modus*; zeigt auf das oberste Element des Stacks (der Stack wächst nach unten).

Jeder Befehl belegt **zwei Speicherzellen**: In der ersten steht, *was* getan wird (Opcode und Adressierungsart), in der zweiten der *Adressteil*.

## Was man auf dem Bildschirm sieht

- **Programm (links):** der Editor für dein Assembler-Programm. Er färbt Befehle ein, unterstreicht Fehler und zeigt eine Hilfe, wenn du mit der Maus auf einen Befehl zeigst. Ein Klick auf eine Zeilennummer setzt einen **Haltepunkt**.
- **Maschine (rechts):**
  - **Schaubild:** Prozessor mit Rechenwerk und Steuerwerk, Speicher und die drei Busse (Daten-, Adress-, Steuerbus). Bei Mikroschritten sieht man, welcher Wert gerade wohin wandert, und liest dazu eine Erklärung.
  - **Register:** Akku, Befehlszähler, Befehlsregister, Flags (und SP) als Zahlen mit kurzer Erklärung.
  - **Speicher:** die Speicherzellen als Tabelle – wahlweise mit/ohne Vorzeichen, hexadezimal oder „als Befehle“. Zellen lassen sich per Klick ändern.
- **Statuszeile:** sagt, was gerade passiert ist und was als Nächstes zu tun ist, und erklärt Fehler in verständlichen Worten.

## So benutzt du sie

1. **Programm schreiben** – oder über **Datei → Beispiel laden** ein fertiges Beispiel holen (Multiplikation, Summe, Maximum, Fakultät, ggT, Unterprogramm).
2. **Assemblieren** (F9): Das Programm wird in Maschinencode übersetzt und in den Speicher geschrieben. Fehler stehen unter dem Editor.
3. **Ausführen:**
   - **Schritt ▶** (F10): genau einen Befehl ausführen.
   - **Mikroschritt** (F11): einen Teilschritt des Befehlszyklus *Holen – Dekodieren – Ausführen* zeigen.
   - **▶▶ Ausführen** (F5): bis `HALT`, zu einem Haltepunkt oder bis zur Abbruchschranke laufen lassen (Esc hält an). Das **Tempo** ist einstellbar.
   - **◀ Schritt zurück** (Umschalt+F10): den letzten Schritt rückgängig machen.
   - **Zurücksetzen:** Akku, Befehlszähler und Flags auf 0 – der Speicher bleibt.
4. **Beobachten**, wie sich Register, Flags und Speicher verändern.

### Weitere Funktionen

- **Optionen:** *Detailansicht* (Werte zusätzlich hex/binär), *Animationen* (Werte wandern sichtbar über die Busse), *Erweiterter Modus* (Stack und Unterprogramme).
- **Anleitung** (Optionen → Anleitung): ausführliche Hilfe zu Bedienung, Assemblersprache, allen Befehlen und Flags, direkt verlinkbar unter `…/#anleitung` (einzelne Abschnitte z. B. `#anleitung/befehle`).
- **Datei:** Programme als `.mia`-Datei öffnen und speichern (Strg/⌘+O, Strg/⌘+S).
- **Link teilen:** erzeugt einen Link, in dem das Programm steckt. Es wird nichts auf einem Server gespeichert.
- **Automatisches Speichern:** Dein letztes Programm ist beim nächsten Besuch wieder da.
- **Deutsch/Englisch** (Flaggen-Knopf), **Hell/Dunkel**, **Vollbild**.
- **Kopieren:** Programmtext oder Speicherinhalt (als Tabelle, z. B. für eine Tabellenkalkulation).

Auf dem Mac musst du für die F-Tasten eventuell zusätzlich `fn` drücken.

## Ein erstes Programm

```
# Summe 1 + 2 + … + n
        LOADI 0
        STORE Summe        # Summe = 0
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

n:      WORD 10
Summe:  WORD 0
```

Nach „Assemblieren“ und „Ausführen“ steht in der Zelle `Summe` der Wert 55.

## Schreibweise (Syntax)

- Eine Zeile: `[Marke:] [Befehl [Adresse]]` – alles nach `#` ist ein Kommentar.
- **Marken** (z. B. `Schleife:`) geben einer Adresse einen Namen. Sie beginnen mit einem Buchstaben.
- **Zahlen** dezimal (`42`, `-5`) oder hexadezimal (`0x2A`).
- Groß- und Kleinschreibung der Befehle ist egal.
- `Name: WORD Wert` reserviert eine Speicherzelle mit Startwert (Variable).

### Adressierungsarten

| Schreibweise | Name | Operand ist … | Beispiel |
|---|---|---|---|
| `adr` | direkt | der Inhalt der Zelle `adr` | `LOAD x` |
| `$zahl` | unmittelbar | die Zahl selbst | `LOAD $5` (= `LOADI 5`) |
| `(adr)` | indirekt | der Inhalt der Zelle, deren Adresse in `adr` steht | `LOAD (zeiger)` |
| `adr(SP)` | relativ zum SP\* | der Inhalt der Zelle `adr + SP` | `LOAD 1(SP)` |
| `@adr(SP)` | indirekt relativ zum SP\* | der Inhalt der Zelle, deren Adresse in `adr + SP` steht | `LOAD @1(SP)` |
| `$adr(SP)` | unmittelbar relativ zum SP\* | die Zahl `adr + SP` | `LOAD $1(SP)` |

\* nur im erweiterten Modus

Für die unmittelbare Adressierung gibt es Kurzformen mit angehängtem **I**: `LOADI 5` bedeutet dasselbe wie `LOAD $5`. Das gibt es für alle Rechen-, Lade- und Logikbefehle (`ADDI`, `SUBI`, `CMPI`, `ANDI`, `SHLI` …).

## Alle Befehle

### Transport

| Befehl | Wirkung |
|---|---|
| `LOAD x` | Lädt den Operanden in den Akku. |
| `STORE adr` | Speichert den Akku in der angegebenen Zelle. |
| `LOADC` | Lädt das Carry-Flag (0 oder 1) in den Akku. |

### Rechnen

| Befehl | Wirkung |
|---|---|
| `ADD x` | Akku = Akku + Operand |
| `SUB x` | Akku = Akku − Operand |
| `MUL x` | Akku = Akku · Operand (untere 16 Bit) |
| `DIV x` | Akku = Akku / Operand (ganzzahlig, mit Vorzeichen) |
| `MOD x` | Akku = Rest von Akku / Operand (mit Vorzeichen) |
| `DIVU x` | Division ohne Vorzeichen |
| `MODU x` | Rest der Division ohne Vorzeichen |
| `MULH x` | Produkt (mit Vorzeichen) / 65536 |
| `MULHU x` | obere 16 Bit des Produkts (ohne Vorzeichen) |
| `CMP x` | Vergleicht Akku mit Operand (rechnet Akku − Operand, setzt nur die Flags; der Akku bleibt) |

### Logik und Schieben

| Befehl | Wirkung |
|---|---|
| `AND x` | bitweises Und |
| `OR x` | bitweises Oder |
| `XOR x` | bitweises Exklusiv-Oder |
| `NOT` | kehrt alle Bits im Akku um |
| `SHL x` | schiebt um x Stellen nach links (C = zuletzt herausgeschobenes Bit) |
| `SHR x` | schiebt um x Stellen nach rechts, links kommen Nullen nach |
| `SHRA x` | schiebt nach rechts, das Vorzeichen bleibt erhalten |

### Sprünge

Sprünge werten die Flags der **letzten Rechnung** aus (oft eines `CMP`). Die Schreibweise in Klammern ist gleichwertig.

| Befehl | springt, wenn … |
|---|---|
| `JMP adr` | immer |
| `JMPZ adr` (`JEQ`) | Ergebnis = 0 |
| `JMPNZ adr` (`JNE`) | Ergebnis ≠ 0 |
| `JMPP adr` (`JGT`) | Ergebnis > 0 |
| `JMPNN adr` (`JGE`) | Ergebnis ≥ 0 |
| `JMPN adr` (`JLT`) | Ergebnis < 0 |
| `JMPNP adr` (`JLE`) | Ergebnis ≤ 0 |
| `JMPV adr` (`JOV`) | Überlauf mit Vorzeichen (V) |
| `JMPC adr` (`JOC`) | Überlauf ohne Vorzeichen (C) |
| `JHI adr` | ohne Vorzeichen „größer“ |
| `JHS adr` | ohne Vorzeichen „größer oder gleich“ |
| `JLO adr` | ohne Vorzeichen „kleiner“ |
| `JLS adr` | ohne Vorzeichen „kleiner oder gleich“ |

Mit `JMP (adr)` springt man zu der Adresse, die in der Zelle `adr` steht.

### Steuerung

| Befehl | Wirkung |
|---|---|
| `HALT` (`HOLD`) | hält die Maschine an |
| `NOOP` | tut nichts |
| `RESET` | setzt Akku, Befehlszähler und Flags auf 0, löscht den ganzen Speicher (auch das Programm) und hält an |

### Stack und Unterprogramme (nur im erweiterten Modus)

| Befehl | Wirkung |
|---|---|
| `JSR adr` (`CALL`) | Unterprogramm aufrufen: Rücksprungadresse auf den Stack, dann Sprung |
| `RTS` (`RETURN`) | Rücksprung aus dem Unterprogramm |
| `PUSH` | legt den Akku auf den Stack |
| `POP` | holt den obersten Stack-Wert in den Akku |
| `RSV $n` | reserviert n Zellen auf dem Stack (z. B. für lokale Variablen) |
| `REL $n` | gibt n Zellen auf dem Stack wieder frei |

### Pseudobefehl

| Befehl | Wirkung |
|---|---|
| `WORD wert` | reserviert eine Speicherzelle mit dem Startwert `wert` |

Die genaue Wirkung jedes Befehls auf die Flags zeigt der Editor, wenn du mit der Maus auf den Befehl zeigst.

## Tastenkürzel

| Taste | Wirkung |
|---|---|
| F9 / Umschalt+F9 | Assemblieren / … und Speicher behalten |
| F10 / Umschalt+F10 | Schritt / Schritt zurück |
| F11 | Mikroschritt |
| F5 | Ausführen bzw. Pause (Esc hält an) |
| Strg+S / Strg+O (Mac: ⌘S / ⌘O) | Speichern / Öffnen |

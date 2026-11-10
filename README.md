# Minimaschine Web

Ein moderner, im Browser laufender CPU-Simulator nach dem Vorbild der **Minimaschine 4.0** (A. Wiedemann): eine 16-Bit-Akkumulatormaschine für den Informatikunterricht (LehrplanPLUS Bayern, Jgst. 12/13). Eigenständige Neuimplementierung – nur das dokumentierte Verhalten wird nachgebildet.

**Stand:** Meilenstein M4 – Grund-Oberfläche plus Mikroschritte: SVG-Schaubild (Rechenwerk, Steuerwerk, Busse, Speicher) mit animiertem Datenfluss und Erklärtext zu Holen – Dekodieren – Ausführen. Es fehlen noch der erweiterte Modus (M5) und Speichern/Teilen/Offline (M6).

## Voraussetzungen

- [Node.js](https://nodejs.org) ab Version 20 (enthält `npm`). Auf dem Mac z. B.:

  ```bash
  brew install node
  ```

## Befehle

Alle Befehle im Projektordner ausführen (dem Ordner, in dem diese `README.md` liegt).

| Befehl | Wirkung |
|---|---|
| `npm install` | Abhängigkeiten installieren (einmalig bzw. nach Änderungen an `package.json`) |
| `npm run dev` | Entwicklungsserver starten → http://localhost:5173 |
| `npm test` | Tests im Beobachtungsmodus (laufen bei jeder Änderung neu) |
| `npm run test:run` | Tests einmal ausführen |
| `npm run typecheck` | TypeScript prüfen (inkl. „Core ohne DOM“) |
| `npm run build` | Produktionsversion nach `dist/` bauen |
| `npm run preview` | Gebaute Version lokal ansehen |

## Abhängigkeiten

| Paket | Wozu |
|---|---|
| `@codemirror/*`, `@lezer/highlight` | Code-Editor mit Zeilennummern, Rückgängig, Hervorhebung, Fehlermarkierung und Tooltips (in den Projekt-Instruktionen ausdrücklich erlaubt) |
| `typescript`, `vite`, `vitest` (nur Entwicklung) | Übersetzen, Entwicklungsserver/Build, Tests |

## Tastenkürzel

| Taste | Wirkung |
|---|---|
| F9 / Umschalt+F9 | Assemblieren / … und Speicher behalten |
| F10 / Umschalt+F10 | Schritt / Schritt zurück |
| F11 | Mikroschritt (in manchen Browsern unter Windows schaltet F11 stattdessen den Vollbildmodus – dann den Knopf benutzen) |
| F5 | Ausführen bzw. Pause (auch Esc hält an) |

Auf dem Mac ggf. zusätzlich die `fn`-Taste drücken.

## Projektstruktur

```
index.html          Einstiegsseite
src/
  main.ts           Startet die App
  styles.css        Farben (hell/dunkel), Layout
  core/             Reine Logik, KEIN DOM-Zugriff (vom Compiler erzwungen)
    isa.ts          Befehlssatz (zentrale Tabelle)
    alu.ts          Rechenwerk: Operationen, Flags, Sprungbedingungen (reine Funktionen)
    cpu.ts          Register, Speicher, Befehlsausführung
    assembler.ts    Text → Speicherabbild
    disassembler.ts Speicher → Befehlstext
    format.ts       Zahlendarstellung (signed/unsigned/hex/binär)
    microcode.ts    Mikroschritte: Holen – Dekodieren – Ausführen mit Erklärtexten
    index.ts        Öffentliche API des Cores
  ui/               Oberfläche (nutzt nur src/core/index.ts)
    app.ts          Aufbau der Seite, Knöpfe, Tastenkürzel, Programmlauf
    session.ts      Steuerlogik ohne DOM (Assemblieren, Schritt, Haltepunkte) – getestet
    editor.ts       Code-Editor (CodeMirror 6)
    machineView.ts  Anzeige der Register und Flags (Reiter „Register“)
    diagramView.ts  SVG-Schaubild mit Animation (Reiter „Schaubild“)
    memoryView.ts   Speichertabelle (nur sichtbare Zeilen werden gezeichnet)
    dom.ts, texts.ts, examples.ts  Hilfsfunktionen, Texte, Beispielprogramm
  storage/          localStorage, Dateien, Teilen-Link (ab M6)
tests/              Vitest-Tests
docs/
  kompatibilitaet.md  Annahmen und Abweichungen zum Original
```

## Deployment

Folgt in M7 (Ziel: GitHub Pages; reine statische Dateien aus `dist/`).

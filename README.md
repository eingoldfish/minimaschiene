# Minimaschine Web

Ein moderner, im Browser laufender CPU-Simulator nach dem Vorbild der **Minimaschine 4.0** (A. Wiedemann): eine 16-Bit-Akkumulatormaschine für den Informatikunterricht (LehrplanPLUS Bayern, Jgst. 12/13). Eigenständige Neuimplementierung – nur das dokumentierte Verhalten wird nachgebildet.

**Stand:** Meilenstein M2 – Befehlssatz, CPU, Assembler und Disassembler für den Standardmodus mit Tests. Die Oberfläche zeigt noch Platzhalter.

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

## Projektstruktur

```
index.html          Einstiegsseite
src/
  main.ts           Startet die App
  styles.css        Farben (hell/dunkel), Layout
  core/             Reine Logik, KEIN DOM-Zugriff (vom Compiler erzwungen)
    isa.ts          Befehlssatz (zentrale Tabelle)
    alu.ts          Rechenwerk: Operationen und Flags (reine Funktionen)
    cpu.ts          Register, Speicher, Befehlsausführung
    assembler.ts    Text → Speicherabbild
    disassembler.ts Speicher → Befehlstext
    format.ts       Zahlendarstellung (signed/unsigned/hex/binär)
    index.ts        Öffentliche API des Cores
  ui/               Oberfläche (nutzt nur src/core/index.ts)
  storage/          localStorage, Dateien, Teilen-Link (ab M6)
tests/              Vitest-Tests
docs/
  kompatibilitaet.md  Annahmen und Abweichungen zum Original
```

## Deployment

Folgt in M7 (Ziel: GitHub Pages; reine statische Dateien aus `dist/`).

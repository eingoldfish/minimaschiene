/**
 * Builds the basic page layout: toolbar on top, editor left, machine right,
 * memory below. Status (M0): placeholders only; real components follow in M3.
 */
import { Cpu, formatWord } from '../core';

/** Toolbar buttons shown as a preview (disabled until M3). */
const TOOLBAR_BUTTONS: ReadonlyArray<{ label: string; shortcut?: string }> = [
  { label: 'Assemblieren' },
  { label: 'Schritt', shortcut: 'F10' },
  { label: 'Mikroschritt', shortcut: 'F11' },
  { label: 'Ausführen', shortcut: 'F5' },
  { label: 'Pause' },
  { label: 'Schritt zurück' },
  { label: 'Zurücksetzen' },
];

export function renderLayout(root: HTMLElement): void {
  const cpu = new Cpu();
  const state = cpu.getState();

  root.innerHTML = `
    <header class="app-header">
      <h1>Minimaschine Web</h1>
      <nav class="toolbar" aria-label="Steuerung">
        ${TOOLBAR_BUTTONS.map(
          (b) =>
            `<button type="button" disabled ${b.shortcut ? `title="Tastenkürzel: ${b.shortcut}"` : ''}>
              ${b.label}${b.shortcut ? ` <kbd>${b.shortcut}</kbd>` : ''}
            </button>`,
        ).join('')}
      </nav>
    </header>
    <main class="app-main">
      <section class="panel panel-editor" aria-labelledby="h-editor">
        <h2 id="h-editor">Programm</h2>
        <p class="placeholder">Hier entsteht der Code-Editor (Meilenstein M3).</p>
      </section>
      <section class="panel panel-machine" aria-labelledby="h-machine">
        <h2 id="h-machine">Maschine</h2>
        <dl class="registers">
          <dt>Akkumulator (A)</dt><dd>${formatWord(state.a, 'signed')}</dd>
          <dt>Programmzähler (PC)</dt><dd>${formatWord(state.pc, 'unsigned')}</dd>
          <dt>Statusregister</dt><dd>Z ${+state.flags.z} · N ${+state.flags.n} · V ${+state.flags.v} · C ${+state.flags.c}</dd>
        </dl>
      </section>
      <section class="panel panel-memory" aria-labelledby="h-memory">
        <h2 id="h-memory">Speicher</h2>
        <p class="placeholder">Hier entsteht die Speicheransicht (Meilenstein M3).</p>
      </section>
    </main>
  `;
}

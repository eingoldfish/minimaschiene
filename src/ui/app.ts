/**
 * The application: builds the page, connects buttons, editor, machine view
 * and memory view with the Session, and runs programs.
 *
 * Rule: the UI never changes the CPU directly, only through Session/Core
 * methods. After every action, render() redraws everything from the state.
 */
import { disassembleAt, type AssembleError, type CyclePhase, type MicroStepEvent } from '../core';
import { DiagramView } from './diagramView';
import { h, setChildren } from './dom';
import { createEditor, type ProgramEditor } from './editor';
import { DEFAULT_PROGRAM } from './examples';
import { MachineView } from './machineView';
import { MemoryView, type MemoryFormat } from './memoryView';
import { Session, type StopReason } from './session';
import { KEYS } from './texts';

type StatusKind = 'info' | 'success' | 'warning' | 'error';
type Theme = 'auto' | 'light' | 'dark';

const SPEEDS: ReadonlyArray<{ label: string; perSecond: number }> = [
  { label: '1 Befehl/s', perSecond: 1 },
  { label: '2 Befehle/s', perSecond: 2 },
  { label: '5 Befehle/s', perSecond: 5 },
  { label: '10 Befehle/s', perSecond: 10 },
  { label: '50 Befehle/s', perSecond: 50 },
  { label: '500 Befehle/s', perSecond: 500 },
  { label: 'Maximal', perSecond: Infinity },
];

const THEME_LABELS: Record<Theme, string> = { auto: 'automatisch', light: 'hell', dark: 'dunkel' };

/** Button with a visible keyboard shortcut. */
function button(label: string, onclick: () => void, opts: { key?: string; title?: string; class?: string } = {}): HTMLButtonElement {
  return h('button', {
    type: 'button',
    class: opts.class ?? '',
    title: [opts.title, opts.key ? `Tastenkürzel: ${opts.key}` : ''].filter(Boolean).join(' – '),
    onclick,
  }, label, opts.key ? h('kbd', {}, opts.key) : null);
}

export class App {
  private readonly session = new Session();
  private readonly editor: ProgramEditor;
  private readonly machine = new MachineView();
  private readonly diagram = new DiagramView();
  private readonly memory: MemoryView;
  /** The last micro step (shown in the diagram), null after whole steps. */
  private lastEvent: MicroStepEvent | null = null;
  /** Increased for every micro step animation, to detect outdated ones. */
  private animationCounter = 0;

  // ----- settings -----
  private detailed = false;
  private format: MemoryFormat = 'signed';
  private hexAddresses = false;
  private followPc = true;
  private speedIndex = 3;
  private limitSeconds = 5;
  private theme: Theme = 'auto';
  private animations = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private machineTab: 'diagram' | 'registers' = 'diagram';

  // ----- run state -----
  /** The source was edited after the last successful assembling. */
  private programStale = false;
  private running = false;
  private runStart = 0;
  private lastFrame = 0;
  private stepCarry = 0;
  private firstSlice = true;

  // ----- elements -----
  private readonly statusEl: HTMLElement;
  private readonly errorList: HTMLElement;
  private readonly btn: Record<'stepBack' | 'step' | 'micro' | 'run' | 'reset', HTMLButtonElement>;
  private readonly themeBtn: HTMLButtonElement;
  private readonly explanationEl: HTMLElement;
  private readonly tabButtons: Record<'diagram' | 'registers', HTMLButtonElement>;
  private readonly tabPanes: Record<'diagram' | 'registers', HTMLElement>;

  constructor(root: HTMLElement) {
    // ----- header with run controls -----
    this.btn = {
      stepBack: button('◀ Schritt zurück', () => this.stepBack(), { key: KEYS.stepBack, title: 'Den letzten Befehl rückgängig machen' }),
      step: button('Schritt ▶', () => this.step(), { key: KEYS.step, title: 'Genau einen Befehl ausführen' }),
      micro: button('Mikroschritt', () => void this.microStep(), { key: KEYS.microStep, title: 'Einen Teilschritt des Befehlszyklus (Holen – Dekodieren – Ausführen) ausführen und im Schaubild zeigen' }),
      run: button('▶▶ Ausführen', () => this.toggleRun(), { key: KEYS.run, class: 'primary', title: 'Programm bis HALT, Haltepunkt oder Abbruchschranke ausführen' }),
      reset: button('Zurücksetzen', () => this.reset(), { title: 'Akku, Befehlszähler und Flags auf 0 setzen. Der Speicher bleibt erhalten.' }),
    };

    const speedSelect = h('select', {
      'aria-label': 'Tempo beim Ausführen',
      onchange: (ev: Event) => { this.speedIndex = Number((ev.target as HTMLSelectElement).value); },
    }, ...SPEEDS.map((s, i) => h('option', { value: String(i), selected: i === this.speedIndex }, s.label)));

    const limitInput = h('input', {
      type: 'number', min: '1', max: '600', value: String(this.limitSeconds), class: 'limit-input',
      'aria-label': 'Abbruchschranke in Sekunden',
      onchange: (ev: Event) => {
        const input = ev.target as HTMLInputElement;
        const v = Number(input.value);
        if (Number.isFinite(v) && v >= 1) this.limitSeconds = Math.min(600, v);
        input.value = String(this.limitSeconds);
      },
    });

    this.themeBtn = button('', () => this.cycleTheme(), { class: 'subtle', title: 'Farbschema wechseln' });

    const header = h('header', { class: 'app-header' },
      h('div', { class: 'title-row' },
        h('h1', {}, 'Minimaschine'),
        h('div', { class: 'view-settings' },
          h('label', { class: 'check', title: 'Zeigt Werte zusätzlich hexadezimal/binär und den Opcode im Befehlsregister' },
            h('input', { type: 'checkbox', onchange: (ev: Event) => { this.detailed = (ev.target as HTMLInputElement).checked; this.render(); } }),
            'Detailansicht'),
          h('label', { class: 'check', title: 'Werte im Schaubild wandern sichtbar über die Busse' },
            h('input', { type: 'checkbox', checked: this.animations, onchange: (ev: Event) => { this.animations = (ev.target as HTMLInputElement).checked; } }),
            'Animationen'),
          h('label', { class: 'check disabled', title: 'Stackpointer und Stackbefehle – folgt in einer späteren Version' },
            h('input', { type: 'checkbox', disabled: true }), 'Erweiterter Modus'),
          button('Beamer', () => this.toggleBeamer(), { class: 'subtle', title: 'Große Schrift für die Projektion' }),
          this.themeBtn)),
      h('nav', { class: 'toolbar', 'aria-label': 'Programm ausführen' },
        h('div', { class: 'btn-group' }, this.btn.stepBack, this.btn.step, this.btn.micro, this.btn.run, this.btn.reset),
        h('label', { class: 'field', title: 'Wie schnell „Ausführen“ die Befehle abarbeitet' }, 'Tempo', speedSelect),
        h('label', { class: 'field', title: 'Bei Tempo „Maximal“ wird das Programm nach dieser Zeit angehalten (Schutz vor Endlosschleifen).' },
          'Abbruch nach', limitInput, 's')));

    this.statusEl = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });

    // ----- editor panel -----
    const editorHost = h('div', { class: 'editor-host' });
    this.errorList = h('ul', { class: 'error-list', hidden: true, 'aria-label': 'Fehler im Programm' });
    const editorPanel = h('section', { class: 'panel panel-editor', 'aria-labelledby': 'h-editor' },
      h('div', { class: 'panel-head' },
        h('h2', { id: 'h-editor' }, 'Programm'),
        h('div', { class: 'btn-group' },
          button('Assemblieren', () => this.assemble(false), { key: KEYS.assemble, class: 'primary', title: 'Programm übersetzen und in den (vorher gelöschten) Speicher laden' }),
          button('… und Speicher behalten', () => this.assemble(true), { key: KEYS.assembleKeep, title: 'Programm übersetzen, ohne den übrigen Speicher zu löschen' }))),
      editorHost,
      this.errorList,
      h('p', { class: 'hint' }, 'Tipp: Klick auf eine Zeilennummer setzt einen Haltepunkt. Zeig mit der Maus auf einen Befehl, um eine Hilfe zu sehen.'));

    // ----- machine panel -----
    this.explanationEl = h('div', { class: 'explanation', 'aria-live': 'polite' });
    this.tabPanes = {
      diagram: h('div', { class: 'tab-pane', role: 'tabpanel', id: 'pane-diagram' }, this.diagram.element, this.explanationEl),
      registers: h('div', { class: 'tab-pane', role: 'tabpanel', id: 'pane-registers' }, this.machine.element),
    };
    const tab = (id: 'diagram' | 'registers', label: string) =>
      h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-controls': `pane-${id}`, onclick: () => this.setMachineTab(id) }, label);
    this.tabButtons = { diagram: tab('diagram', 'Schaubild'), registers: tab('registers', 'Register') };
    const machinePanel = h('section', { class: 'panel panel-machine', 'aria-labelledby': 'h-machine' },
      h('div', { class: 'panel-head' },
        h('h2', { id: 'h-machine' }, 'Maschine'),
        h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Ansicht der Maschine' }, this.tabButtons.diagram, this.tabButtons.registers)),
      this.tabPanes.diagram, this.tabPanes.registers);

    // ----- memory panel -----
    this.memory = new MemoryView((address, value) => {
      this.session.writeMemory(address, value);
      this.setStatus(`Adresse ${address} geändert. („Schritt zurück“ ist danach erst wieder nach dem nächsten Schritt möglich.)`, 'info');
      this.render();
    });
    const formatNames: Record<MemoryFormat, string> = {
      signed: 'mit Vorzeichen', unsigned: 'ohne Vorzeichen', hex: 'hexadezimal', opcodes: 'als Befehle',
    };
    const formatGroup = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Darstellung der Speicherinhalte' },
      ...(Object.keys(formatNames) as MemoryFormat[]).map((f) =>
        h('label', {},
          h('input', { type: 'radio', name: 'mem-format', value: f, checked: f === this.format,
            onchange: () => { this.format = f; this.render(); } }),
          h('span', {}, formatNames[f]))));
    const gotoInput = h('input', {
      class: 'goto-input', placeholder: 'Adresse', 'aria-label': 'Gehe zu Adresse',
      onkeydown: (ev: KeyboardEvent) => {
        ev.stopPropagation();
        if (ev.key !== 'Enter') return;
        const input = ev.target as HTMLInputElement;
        const text = input.value.trim();
        const label = this.session.program?.labels.get(text);
        const num = /^0[xX][0-9a-fA-F]+$/.test(text) ? parseInt(text.slice(2), 16) : /^[0-9]+$/.test(text) ? Number(text) : NaN;
        const target = label ?? num;
        if (Number.isInteger(target) && target >= 0 && target <= 0xffff) {
          this.followPc = false;
          followBox.checked = false;
          this.memory.scrollToAddress(target, true);
        } else {
          this.setStatus(`„${text}“ ist keine Adresse (0 bis 65535, 0x… oder eine Marke).`, 'error');
        }
      },
    });
    const followBox = h('input', { type: 'checkbox', checked: this.followPc,
      onchange: (ev: Event) => { this.followPc = (ev.target as HTMLInputElement).checked; this.render(); } });
    const memoryPanel = h('section', { class: 'panel panel-memory', 'aria-labelledby': 'h-memory' },
      h('div', { class: 'panel-head' },
        h('h2', { id: 'h-memory' }, 'Speicher'),
        formatGroup),
      h('div', { class: 'mem-tools' },
        h('label', { class: 'check' }, followBox, 'dem PC folgen'),
        button('Zum PC', () => this.memory.scrollToAddress(this.session.state.pc, true), { class: 'small' }),
        button('Zum Adressteil', () => this.memory.scrollToAddress(this.session.state.ir.address, true),
          { class: 'small', title: 'Zur Adresse aus dem Befehlsregister springen' }),
        h('label', { class: 'field' }, 'Gehe zu', gotoInput),
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', onchange: (ev: Event) => { this.hexAddresses = (ev.target as HTMLInputElement).checked; this.render(); } }),
          'Adressen hexadezimal')),
      this.memory.element);

    setChildren(root, header, this.statusEl,
      h('main', { class: 'app-main' }, editorPanel, machinePanel, memoryPanel));

    // ----- editor (needs its host element in the page) -----
    this.editor = createEditor(editorHost, DEFAULT_PROGRAM, {
      onChange: () => this.onSourceChanged(),
      onBreakpointsChange: (lines) => this.session.setBreakpointLines(lines),
    });

    document.addEventListener('keydown', (ev) => this.onKey(ev));
    this.applyTheme();
    this.setMachineTab(this.machineTab);
    this.setStatus('Willkommen! Drücke „Assemblieren“, um das Beispielprogramm in den Speicher zu laden.', 'info');
    this.render();
  }

  // ==================================================================
  // Actions
  // ==================================================================

  /** Ends the micro step display (whole steps, runs, resets …). */
  private leaveMicroView(): void {
    this.animationCounter++; // a still running micro step animation must not redraw afterwards
    this.diagram.finishAnimation();
    this.btn.micro.classList.remove('is-busy');
    this.lastEvent = null;
  }

  private assemble(keepMemory: boolean): void {
    this.stopRun();
    this.leaveMicroView();
    const result = this.session.assemble(this.editor.getText(), { keepMemory });
    this.editor.setErrors(result.errors);
    this.showErrors(result.errors);
    if (result.ok) {
      this.programStale = false;
      if (result.size === 0) {
        this.setStatus('Das Programm ist leer – es gibt nichts zu übersetzen.', 'warning');
      } else {
        this.setStatus(`Assembliert: Speicherzellen 0 bis ${result.size - 1} belegt${keepMemory ? ', übriger Speicher behalten' : ''}. `
          + `Weiter mit „Schritt“ (${KEYS.step}) oder „Ausführen“ (${KEYS.run}).`, 'success');
      }
      this.memory.scrollToAddress(0, true);
    } else {
      const n = result.errors.length;
      this.setStatus(`${n} Fehler gefunden – siehe Liste unter dem Programm. Die Maschine wurde nicht verändert.`, 'error');
    }
    this.render();
  }

  private step(): void {
    if (this.running) return;
    if (!this.checkReady()) return;
    this.leaveMicroView();
    const st = this.session.state;
    const line = this.session.currentLine;
    const wasMicro = st.micro !== null;
    const text = disassembleAt(st.memory, this.session.instructionAddress, (a) => this.session.labelAt(a)).text;
    const reason = this.session.step();
    if (reason !== 'none') this.reportStop(reason);
    else this.setStatus(`${wasMicro ? 'Fertig ausgeführt' : 'Ausgeführt'}: ${text}${line !== undefined && !this.programStale ? ` (Zeile ${line})` : ''}`, 'info');
    this.render();
  }

  private stepBack(): void {
    if (this.running) return;
    this.leaveMicroView();
    const wasMicro = this.session.state.micro !== null;
    if (this.session.stepBack()) {
      const nowMicro = this.session.state.micro !== null;
      this.setStatus(wasMicro || nowMicro ? 'Einen Mikroschritt zurückgegangen.' : 'Einen Befehl zurückgegangen.', 'info');
    } else {
      this.setStatus('Weiter zurück geht es nicht.', 'info');
    }
    this.render();
  }

  /** One micro step, animated in the diagram. */
  private async microStep(): Promise<void> {
    if (this.running) return;
    // Pressed again during an animation: end it, show its result, then do the next micro step.
    if (this.diagram.isAnimating) {
      this.animationCounter++;
      this.diagram.finishAnimation();
      this.render();
    }
    if (!this.checkReady()) {
      this.render();
      return;
    }
    const myAnimation = ++this.animationCounter;
    const event = this.session.microStep();
    if (!event) return;
    this.lastEvent = event;
    this.setMachineTab('diagram');
    this.renderExplanation();
    if (this.session.state.halted !== 'none') this.reportStop(this.session.state.halted);
    else this.setStatus(`Mikroschritt ${event.index + 1} von ${event.count}: ${event.title}${event.done ? ' – Befehl fertig.' : ''}`, 'info');
    this.btn.micro.classList.add('is-busy');
    await this.diagram.play(event, this.animations);
    // A newer micro step (or another action) took over: it will redraw.
    if (myAnimation !== this.animationCounter) return;
    this.btn.micro.classList.remove('is-busy');
    this.render();
  }

  private reset(): void {
    this.stopRun();
    this.leaveMicroView();
    this.session.reset();
    this.setStatus('Zurückgesetzt: Akku, Befehlszähler und Flags sind 0. Der Speicher ist unverändert.', 'info');
    this.render();
  }

  private toggleRun(): void {
    if (this.running) {
      this.stopRun();
      this.setStatus('Pause. Weiter mit „Ausführen“ oder „Schritt“.', 'info');
      this.render();
      return;
    }
    if (!this.checkReady()) return;
    this.leaveMicroView();
    this.running = true;
    this.firstSlice = true;
    this.runStart = performance.now();
    this.lastFrame = this.runStart;
    this.stepCarry = 1; // execute the first instruction right away
    this.setStatus('Programm läuft …', 'info');
    this.render();
    requestAnimationFrame((t) => this.tick(t));
  }

  /** One animation frame of a program run. */
  private tick(now: number): void {
    if (!this.running) return;
    const speed = SPEEDS[this.speedIndex]?.perSecond ?? 10;
    let result: { reason: StopReason; steps: number } = { reason: 'none', steps: 0 };

    if (speed === Infinity) {
      // As many steps as fit into ~12 ms, so the page stays responsive.
      const end = performance.now() + 12;
      do {
        result = this.session.runSlice(5000, this.firstSlice);
        this.firstSlice = false;
      } while (result.reason === 'none' && performance.now() < end);
      if (result.reason === 'none' && now - this.runStart > this.limitSeconds * 1000) {
        this.stopRun();
        this.setStatus(`Abbruchschranke erreicht: Das Programm lief länger als ${this.limitSeconds} s und wurde angehalten. `
          + 'Vielleicht eine Endlosschleife? Mit „Ausführen“ geht es weiter.', 'warning');
        this.render();
        return;
      }
    } else {
      this.stepCarry += ((now - this.lastFrame) / 1000) * speed;
      const n = Math.floor(this.stepCarry);
      if (n > 0) {
        this.stepCarry -= n;
        result = this.session.runSlice(n, this.firstSlice);
        this.firstSlice = false;
      }
    }
    this.lastFrame = now;

    if (result.reason !== 'none') {
      this.stopRun();
      this.reportStop(result.reason);
    }
    this.render();
    if (this.running) requestAnimationFrame((t) => this.tick(t));
  }

  private stopRun(): void {
    this.running = false;
  }

  /** Checks that a program was assembled and the machine is not halted. */
  private checkReady(): boolean {
    if (!this.session.program) {
      this.setStatus(`Bitte zuerst „Assemblieren“ (${KEYS.assemble}), damit das Programm im Speicher steht.`, 'warning');
      return false;
    }
    if (this.session.state.halted !== 'none') {
      this.setStatus('Die Maschine ist angehalten. Mit „Zurücksetzen“ beginnt das Programm von vorn – oder geh mit „Schritt zurück“.', 'info');
      return false;
    }
    return true;
  }

  private reportStop(reason: StopReason): void {
    const st = this.session.state;
    switch (reason) {
      case 'halt':
        this.setStatus('Programm beendet (HALT).', 'success');
        break;
      case 'reset':
        this.setStatus('Das Programm hat RESET ausgeführt: Akku, Befehlszähler und Flags sind 0, die Maschine ist angehalten. Der Speicher bleibt erhalten.', 'info');
        break;
      case 'illegalOpcode':
        this.setStatus(`An Adresse ${st.pc} steht kein gültiger Befehl (Wert ${st.memory[st.pc]}). `
          + 'Läuft das Programm vielleicht in den Datenbereich, weil ein HALT fehlt?', 'error');
        break;
      case 'divisionByZero':
        this.setStatus(`Division durch 0 bei Adresse ${st.pc} (${disassembleAt(st.memory, st.pc).text}) – Programm angehalten.`, 'error');
        break;
      case 'breakpoint':
        this.setStatus(`Haltepunkt in Zeile ${this.session.currentLine ?? '?'} erreicht. Weiter mit „Ausführen“ oder „Schritt“.`, 'info');
        break;
      case 'none':
        break;
    }
  }

  private onSourceChanged(): void {
    if (this.session.program && !this.programStale) {
      this.programStale = true;
      this.setStatus(`Das Programm wurde geändert. Zum Ausführen der neuen Fassung zuerst assemblieren (${KEYS.assemble}).`, 'warning');
      this.render();
    }
  }

  private showErrors(errors: readonly AssembleError[]): void {
    this.errorList.hidden = errors.length === 0;
    setChildren(this.errorList, ...errors.map((e) =>
      h('li', {},
        h('button', { type: 'button', class: 'error-item', onclick: () => this.editor.goToLine(e.line) },
          h('strong', {}, `Zeile ${e.line}: `), e.message, e.hint ? h('span', { class: 'error-hint' }, ` ${e.hint}`) : null))));
  }

  // ==================================================================
  // View settings
  // ==================================================================

  private setMachineTab(tab: 'diagram' | 'registers'): void {
    this.machineTab = tab;
    for (const id of ['diagram', 'registers'] as const) {
      this.tabPanes[id].hidden = id !== tab;
      this.tabButtons[id].setAttribute('aria-selected', String(id === tab));
    }
  }

  /** Text under the diagram: phase of the instruction cycle and what happens. */
  private renderExplanation(): void {
    const ev = this.lastEvent;
    const phases: Array<[CyclePhase, string]> = [['fetch', 'Holen'], ['decode', 'Dekodieren'], ['execute', 'Ausführen']];
    const pills = h('ol', { class: 'phases', 'aria-label': 'Befehlszyklus' },
      ...phases.map(([phase, label]) => h('li', { class: ev?.phase === phase ? 'current' : '' }, label)));
    if (!ev) {
      setChildren(this.explanationEl, pills,
        h('p', { class: 'muted' }, `Mit „Mikroschritt“ (${KEYS.microStep}) siehst du, wie ein Befehl in den Phasen `
          + 'Holen – Dekodieren – Ausführen abgearbeitet wird.'));
      return;
    }
    setChildren(this.explanationEl, pills,
      h('p', { class: 'explanation-title' },
        h('strong', {}, ev.title),
        h('span', { class: 'muted' }, ` · Mikroschritt ${ev.index + 1} von ${ev.count}`)),
      h('p', {}, ev.explanation));
  }

  private toggleBeamer(): void {
    document.documentElement.classList.toggle('beamer');
    this.render();
  }

  private cycleTheme(): void {
    const order: Theme[] = ['auto', 'light', 'dark'];
    this.theme = order[(order.indexOf(this.theme) + 1) % order.length] ?? 'auto';
    this.applyTheme();
  }

  private applyTheme(): void {
    const rootEl = document.documentElement;
    if (this.theme === 'auto') delete rootEl.dataset['theme'];
    else rootEl.dataset['theme'] = this.theme;
    this.themeBtn.replaceChildren(`Farben: ${THEME_LABELS[this.theme]}`);
  }

  private onKey(ev: KeyboardEvent): void {
    const actions: Record<string, () => void> = {
      F9: () => this.assemble(false),
      'Shift+F9': () => this.assemble(true),
      F10: () => this.step(),
      'Shift+F10': () => this.stepBack(),
      F11: () => void this.microStep(),
      F5: () => this.toggleRun(),
    };
    const key = (ev.shiftKey ? 'Shift+' : '') + ev.key;
    const action = actions[key];
    if (action) {
      ev.preventDefault(); // e.g. F5 would reload the page
      action();
    } else if (ev.key === 'Escape' && this.running) {
      this.toggleRun();
    }
  }

  // ==================================================================
  // Rendering
  // ==================================================================

  private setStatus(text: string, kind: StatusKind): void {
    this.statusEl.textContent = text;
    this.statusEl.className = `status status-${kind}`;
    this.statusEl.hidden = text === '';
  }

  private render(): void {
    const s = this.session;
    const st = s.state;
    const ir = st.ir;
    const hasExecuted = !(ir.opcode === 0 && ir.mode === 'none' && ir.address === 0 && !s.canStepBack);
    const currentLine = this.programStale ? undefined : s.currentLine;

    this.machine.update(st, {
      detailed: this.detailed,
      format: this.format === 'opcodes' ? 'signed' : this.format,
      currentLine,
      hasExecuted,
      labelAt: (a) => s.labelAt(a),
    });
    this.diagram.update(st, this.lastEvent, { labelAt: (a) => s.labelAt(a) });
    this.renderExplanation();
    this.memory.update(st, {
      format: this.format,
      hexAddresses: this.hexAddresses,
      labelAt: (a) => s.labelAt(a),
    });
    if (this.followPc) this.memory.scrollToAddress(st.pc);

    const isError = st.halted === 'illegalOpcode' || st.halted === 'divisionByZero';
    // After HALT the PC already points behind it (often into the data);
    // highlighting the HALT line itself is clearer.
    const execLine = st.halted === 'halt' && !this.programStale
      ? s.program?.addressToLine.get((st.pc - 2) & 0xffff)
      : currentLine;
    this.editor.setExecLine(execLine ?? null, isError ? 'error' : 'normal');

    this.btn.stepBack.disabled = this.running || !s.canStepBack;
    this.btn.step.disabled = this.running;
    this.btn.micro.disabled = this.running;
    this.btn.run.firstChild!.textContent = this.running ? '❚❚ Pause' : '▶▶ Ausführen';
    this.btn.run.classList.toggle('is-running', this.running);
  }
}

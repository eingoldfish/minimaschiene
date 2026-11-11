/**
 * The application: builds the page, connects buttons, editor, machine view
 * and memory view with the Session, and runs programs.
 *
 * Rule: the UI never changes the CPU directly, only through Session/Core
 * methods. After every action, render() redraws everything from the state.
 */
import { assemble as assembleSource, decodeWord1, disassembleAt, type AssembleError, type CyclePhase, type Language, type MicroStepEvent } from '../core';
import { DiagramView } from './diagramView';
import { h, setChildren } from './dom';
import { createEditor, type ProgramEditor } from './editor';
import { loadFileName, loadSettings, loadSource, saveFileName, saveSettings, saveSource } from '../storage/autosave';
import { openFile, saveFile, type SaveTarget } from '../storage/files';
import { decodeShare, encodeShare } from '../storage/share';
import { defaultProgram, getExamples, isExampleSource, translateExample } from './examples';
import { defaultLanguage, keys, setLanguage, t } from './i18n';
import { menu, menuItemWithInfo } from './menu';
import { bookIcon, checkIcon, copyIcon, exitFullscreenIcon, flagIcon, fullscreenIcon, maximizeIcon, restoreIcon } from './icons';
import { machineAsText, MachineView, type MachineViewOptions } from './machineView';
import { MemoryView } from './memoryView';
import { memoryAsTable, type MemoryFormat } from './memoryTable';
import { Session, type StopReason } from './session';
import { guideHash, parseGuideHash } from './guide/route';
// The guide itself is loaded on demand (own chunk, see syncGuide and main.ts).
import type { GuideView } from './guide/view';

type StatusKind = 'info' | 'success' | 'warning' | 'error';
type Theme = 'auto' | 'light' | 'dark';
/** Which panel fills the window (phones: the editor covers the whole screen). */
type Maximized = 'none' | 'editor' | 'machine';

/** Instructions per second for "Run" (Infinity = as fast as possible). */
const SPEEDS: readonly number[] = [1, 2, 5, 10, 50, 500, Infinity];

/** Same width as the phone layout in styles.css. */
const PHONE_QUERY = '(max-width: 600px)';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** How long unimportant status messages stay visible. */
const TRANSIENT_STATUS_MS = 5000;

const speedLabel = (perSecond: number) => (perSecond === Infinity ? t().speedMax : t().speedPerSecond(perSecond));

/**
 * State that survives a rebuild of the page (after switching the language):
 * the machine, the program text with its breakpoints and the file info.
 */
interface AppCarry {
  session: Session;
  text: string;
  breakpoints: number[];
  fileName: string | null;
  saveTarget: SaveTarget | undefined;
  savedText: string | null;
  programStale: boolean;
  hadErrors: boolean;
  scrollY: number;
  machineTab: 'diagram' | 'registers';
  maximized: Maximized;
  /** The guide was opened with the button (closing it goes back in the history). */
  guideOpenedHere: boolean;
  /** A status message was visible: the new one replaces it without animation (no jumping). */
  statusShown: boolean;
}

/** Button with a visible keyboard shortcut. */
function button(label: string, onclick: () => void, opts: { key?: string; title?: string; class?: string } = {}): HTMLButtonElement {
  return h('button', {
    type: 'button',
    class: opts.class ?? '',
    title: [opts.title, opts.key ? `${t().shortcut}: ${opts.key}` : ''].filter(Boolean).join(' – '),
    onclick,
  }, label, opts.key ? h('kbd', {}, opts.key) : null);
}

export class App {
  private readonly session: Session;
  /** Removes the global event listeners when the page is rebuilt. */
  private readonly listeners = new AbortController();
  private readonly editor: ProgramEditor;
  private readonly machine = new MachineView();
  private readonly diagram: DiagramView;
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
  /** Extended mode: stack pointer and stack instructions. */
  private extended = false;
  /** Set when the time limit stopped a run: like the original, Run/Step stay blocked until reset or assemble. */
  private timedOut = false;
  private language: Language = defaultLanguage();
  private maximized: Maximized = 'none';
  /** Width of the program panel in percent of the area next to the machine (wide screens). */
  private splitPercent = 50;

  // ----- guide (#anleitung) -----
  /** The guide page, built the first time it is opened. */
  private guide: GuideView | null = null;
  /** The guide was opened with the button in the options menu (not by a link). */
  private guideOpenedHere = false;
  /** Scroll position of the machine page, restored when the guide is closed. */
  private appScrollY = 0;

  // ----- file -----
  /** Name of the opened/saved file, null if never saved. */
  private fileName: string | null = loadFileName();
  /** For saving into the same file again (Chrome/Edge only). */
  private saveTarget: SaveTarget | undefined;
  /** Text at the last open/save/example load – to warn before replacing unsaved work. */
  private savedText: string | null = null;
  private autosaveTimer = 0;
  private statusTimer = 0;

  // ----- run state -----
  /** The source was edited after the last successful assembling. */
  private programStale = false;
  /** programStale was only set because the instruction RESET cleared the memory ("step back" undoes it). */
  private staleByReset = false;
  private running = false;
  private runStart = 0;
  private lastFrame = 0;
  private stepCarry = 0;
  private firstSlice = true;

  // ----- elements -----
  private readonly statusEl: HTMLElement;
  private readonly errorList: HTMLElement;
  private readonly btn: Record<'stepBack' | 'step' | 'micro' | 'run' | 'reset', HTMLButtonElement>;
  /** Light/dark switches: one in the header (wide screens), one in the options menu (phones). */
  private readonly themeSwitches: HTMLButtonElement[] = [];
  private readonly explanationEl: HTMLElement;
  private readonly spButton: HTMLButtonElement;
  private readonly fileNameEl: HTMLElement;
  private readonly tabButtons: Record<'diagram' | 'registers', HTMLButtonElement>;
  private readonly tabPanes: Record<'diagram' | 'registers', HTMLElement>;
  private readonly mainEl: HTMLElement;
  private readonly maxButtons: Record<'editor' | 'machine', HTMLButtonElement>;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly footerEl: HTMLElement;

  constructor(private readonly root: HTMLElement, carry?: AppCarry) {
    this.applySavedSettings(loadSettings());
    setLanguage(this.language);
    this.session = carry?.session ?? new Session();
    this.session.cpu.extended = this.extended;
    this.session.setLanguage(this.language);
    this.diagram = new DiagramView(); // its labels need the language
    if (carry) {
      this.fileName = carry.fileName;
      this.saveTarget = carry.saveTarget;
      this.savedText = carry.savedText;
      this.programStale = carry.programStale;
      this.machineTab = carry.machineTab;
      this.maximized = carry.maximized;
      this.guideOpenedHere = carry.guideOpenedHere;
    } else if (window.matchMedia(PHONE_QUERY).matches) {
      // Small screens: the registers are easier to read than the small diagram.
      this.machineTab = 'registers';
    }
    const d = t();
    const k = keys();

    // ----- header with run controls -----
    this.btn = {
      stepBack: button(d.stepBack, () => this.stepBack(), { key: k.stepBack, title: d.stepBackTitle }),
      step: button(d.step, () => this.step(), { key: k.step, title: d.stepTitle }),
      micro: button(d.micro, () => void this.microStep(), { key: k.microStep, title: d.microTitle }),
      run: button(d.run, () => this.toggleRun(), { key: k.run, class: 'primary', title: d.runTitle }),
      reset: button(d.reset, () => this.reset(), { title: d.resetTitle }),
    };

    const speedSelect = h('select', {
      'aria-label': d.speedLabel,
      onchange: (ev: Event) => { this.speedIndex = Number((ev.target as HTMLSelectElement).value); this.persistSettings(); },
    }, ...SPEEDS.map((s, i) => h('option', { value: String(i), selected: i === this.speedIndex }, speedLabel(s))));

    const limitInput = h('input', {
      type: 'number', min: '1', max: '600', value: String(this.limitSeconds), class: 'limit-input',
      'aria-label': d.limitLabel,
      onchange: (ev: Event) => {
        const input = ev.target as HTMLInputElement;
        const v = Number(input.value);
        if (Number.isFinite(v) && v >= 1) this.limitSeconds = Math.min(600, v);
        input.value = String(this.limitSeconds);
        this.persistSettings();
      },
    });

    const themeSwitch = (cls: string, label?: string): HTMLButtonElement => {
      const sw = h('button', {
        type: 'button', role: 'switch', class: `theme-switch ${cls}`, title: d.darkModeTitle, 'aria-label': d.darkMode,
        onclick: () => this.toggleTheme(),
      }, label ? h('span', {}, label) : null, h('span', { class: 'switch-track', 'aria-hidden': 'true' }, h('span', { class: 'switch-knob' })));
      this.themeSwitches.push(sw);
      return sw;
    };

    // Full screen for the whole page (wide screens only; hidden where the browser cannot do it)
    this.fullscreenButton = h('button', { type: 'button', class: 'subtle icon-btn fullscreen-btn wide-only',
      hidden: !document.fullscreenEnabled, onclick: () => this.toggleFullscreen() });
    this.updateFullscreenButton();

    const header = h('header', { class: 'app-header' },
      h('div', { class: 'title-row' },
        h('h1', {}, d.appTitle),
        h('div', { class: 'view-settings' },
          menu(d.options, { class: 'subtle', title: d.optionsTitle, align: 'right' },
            menuItemWithInfo(h('label', { class: 'check', title: d.detailedTitle },
              h('input', { type: 'checkbox', checked: this.detailed, onchange: (ev: Event) => { this.detailed = (ev.target as HTMLInputElement).checked; this.persistSettings(); this.render(); } }),
              d.detailed), d.detailedInfo, d.infoAbout(d.detailed)),
            menuItemWithInfo(h('label', { class: 'check', title: d.animationsTitle },
              h('input', { type: 'checkbox', checked: this.animations, onchange: (ev: Event) => { this.animations = (ev.target as HTMLInputElement).checked; this.persistSettings(); } }),
              d.animations), d.animationsInfo(keys().microStep), d.infoAbout(d.animations)),
            h('label', { class: 'check', title: d.extendedTitle },
              h('input', { type: 'checkbox', checked: this.extended, class: 'extended-box', onchange: (ev: Event) => this.setExtended((ev.target as HTMLInputElement).checked) }),
              d.extended),
            // phones: the colour scheme is in this menu, on wider screens it has its own button
            themeSwitch('phone-only', d.darkMode),
            h('button', { type: 'button', class: 'menu-guide', title: d.guideTitle, onclick: () => this.openGuide() },
              d.guide, bookIcon())).element,
          themeSwitch('wide-only'),
          h('button', { type: 'button', class: 'subtle lang-btn', title: d.langSwitchTitle, 'aria-label': d.langSwitchTitle,
            onclick: () => this.switchLanguage() }, flagIcon(this.language === 'de' ? 'en' : 'de')),
          this.fullscreenButton)),
      h('nav', { class: 'toolbar', 'aria-label': d.toolbarLabel },
        h('div', { class: 'btn-group' }, this.btn.stepBack, this.btn.step, this.btn.micro, this.btn.run, this.btn.reset),
        h('div', { class: 'run-settings' },
          h('label', { class: 'field', title: d.speedTitle }, d.speed, speedSelect),
          h('label', { class: 'field', title: d.limitTitle },
            d.limit, limitInput, 's'))));

    // starts hidden, so the first message (also after a language switch) grows in
    this.statusEl = h('div', { class: 'status', role: 'status', 'aria-live': 'polite', hidden: true });

    // ----- editor panel -----
    const editorHost = h('div', { class: 'editor-host' });
    this.fileNameEl = h('span', { class: 'file-name' });
    const fileMenu = menu(d.fileMenu, { class: 'small', title: d.fileMenuTitle },
      button(d.open, () => void this.openProgram(), { key: k.open, title: d.openTitle }),
      button(d.save, () => void this.saveProgram(), { key: k.save, title: d.saveTitle }),
      button(d.share, () => void this.shareProgram(), { title: d.shareTitle })).element;
    const examplesButton = button(d.examplesButton, () => this.openExamples(), { class: 'small', title: d.examplesTitle });
    const fileBar = h('div', { class: 'file-bar' },
      fileMenu,
      examplesButton,
      this.copyButton(d.copyCodeTitle, () => this.copyCode()),
      this.fileNameEl);
    this.errorList = h('ul', { class: 'error-list', hidden: true, 'aria-label': d.errorsLabel });
    this.maxButtons = {
      editor: h('button', { type: 'button', class: 'small icon-btn max-btn', onclick: () => this.toggleMaximized('editor') }),
      machine: h('button', { type: 'button', class: 'small icon-btn max-btn', onclick: () => this.toggleMaximized('machine') }),
    };
    const editorPanel = h('section', { class: 'panel panel-editor', 'aria-labelledby': 'h-editor' },
      h('div', { class: 'panel-head' },
        h('h2', { id: 'h-editor' }, d.program),
        h('div', { class: 'head-actions' },
          h('div', { class: 'btn-group' },
            button(d.assemble, () => this.assemble(false), { key: k.assemble, class: 'primary', title: d.assembleTitle }),
            button(d.assembleKeep, () => this.assemble(true), { key: k.assembleKeep, title: d.assembleKeepTitle })),
          this.maxButtons.editor)),
      fileBar,
      editorHost,
      this.errorList,
      h('p', { class: 'hint' }, d.editorHint));

    // ----- machine panel -----
    this.explanationEl = h('div', { class: 'explanation', 'aria-live': 'polite' });
    this.tabPanes = {
      diagram: h('div', { class: 'tab-pane', role: 'tabpanel', id: 'pane-diagram' }, this.diagram.element, this.explanationEl),
      registers: h('div', { class: 'tab-pane', role: 'tabpanel', id: 'pane-registers' }, this.machine.element),
    };
    const tab = (id: 'diagram' | 'registers', label: string) =>
      h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-controls': `pane-${id}`, onclick: () => this.setMachineTab(id) }, label);
    this.tabButtons = { diagram: tab('diagram', d.diagramTab), registers: tab('registers', d.registersTab) };
    const machinePanel = h('section', { class: 'panel panel-machine', 'aria-labelledby': 'h-machine' },
      h('div', { class: 'panel-head' },
        h('h2', { id: 'h-machine' }, d.machine),
        h('div', { class: 'head-actions' },
          h('div', {
            class: 'tabs', role: 'tablist', 'aria-label': d.machineViewLabel,
            // arrow keys switch between the two tabs (usual keyboard behaviour of tabs)
            onkeydown: (ev: KeyboardEvent) => {
              if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
              ev.preventDefault();
              const next = this.machineTab === 'diagram' ? 'registers' : 'diagram';
              this.setMachineTab(next);
              this.tabButtons[next].focus();
            },
          }, this.tabButtons.diagram, this.tabButtons.registers),
          this.copyButton(d.copyMachineTitle, () => this.copyMachine()),
          this.maxButtons.machine)),
      this.tabPanes.diagram, this.tabPanes.registers);

    // ----- memory panel -----
    this.spButton = button(d.toSp, () => this.memory.scrollToAddress(this.session.state.sp, true),
      { class: 'small', title: d.toSpTitle });
    this.spButton.hidden = true;
    this.memory = new MemoryView((address, value) => {
      this.session.writeMemory(address, value);
      this.setStatus(t().memoryEdited(address), 'info', true);
      this.render();
    });
    const formatNames: Record<MemoryFormat, string> = {
      signed: d.formatSigned, unsigned: d.formatUnsigned, hex: d.formatHex, opcodes: d.formatOpcodes,
    };
    // Phones: the display format is a drop-down that shows the current choice.
    const formatMenu = menu(formatNames[this.format], { class: 'small', title: d.memoryFormatLabel, align: 'right', phoneOnly: true },
      h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': d.memoryFormatLabel },
        ...(Object.keys(formatNames) as MemoryFormat[]).map((f) =>
          h('label', {},
            h('input', { type: 'radio', name: 'mem-format', value: f, checked: f === this.format,
              onchange: () => { this.format = f; formatMenu.setLabel(formatNames[f]); this.persistSettings(); this.render(); } }),
            h('span', {}, formatNames[f])))));
    const gotoInput = h('input', {
      class: 'goto-input', placeholder: d.goToPlaceholder, 'aria-label': d.goToLabel,
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
          this.setStatus(t().notAnAddress(text), 'error');
        }
      },
    });
    const followBox = h('input', { type: 'checkbox', checked: this.followPc,
      onchange: (ev: Event) => { this.followPc = (ev.target as HTMLInputElement).checked; this.persistSettings(); this.render(); } });
    const memoryPanel = h('section', { class: 'panel panel-memory', 'aria-labelledby': 'h-memory' },
      h('div', { class: 'panel-head' },
        h('h2', { id: 'h-memory' }, d.memory),
        formatMenu.element),
      h('div', { class: 'mem-tools' },
        // Phones: navigation and address display in a drop-down; "go to" and copy stay visible.
        menu(d.memoryView, { class: 'small', title: d.memoryViewTitle, phoneOnly: true },
          h('label', { class: 'check' }, followBox, d.followPc),
          button(d.toPc, () => this.memory.scrollToAddress(this.session.state.pc, true), { class: 'small' }),
          button(d.clearMemory, () => this.clearMemory(), { class: 'small', title: d.clearMemoryTitle }),
          this.spButton,
          button(d.toAddressPart, () => this.memory.scrollToAddress(this.session.state.ir.address, true),
            { class: 'small', title: d.toAddressPartTitle }),
          h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: this.hexAddresses, onchange: (ev: Event) => { this.hexAddresses = (ev.target as HTMLInputElement).checked; this.persistSettings(); this.render(); } }),
            d.hexAddresses)).element,
        h('label', { class: 'field' }, d.goTo, gotoInput),
        this.copyButton(d.copyMemoryTitle, () => this.copyMemory())),
      this.memory.element);

    const splitter = h('div', {
      class: 'splitter', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-valuemin': '20', 'aria-valuemax': '80',
      'aria-label': d.splitterLabel, title: d.splitterTitle,
      onpointerdown: (ev: PointerEvent) => this.startSplitDrag(ev, splitter),
      ondblclick: () => this.setSplit(50),
      onkeydown: (ev: KeyboardEvent) => {
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
          ev.preventDefault();
          ev.stopPropagation();
          this.setSplit(this.splitPercent + (ev.key === 'ArrowLeft' ? -5 : 5));
        }
      },
    });
    this.mainEl = h('main', { class: 'app-main' }, editorPanel, splitter, machinePanel, memoryPanel);

    // ----- footer: version (date of the last commit, see vite.config.ts) and a link to the author -----
    const [year, month, day] = __BUILD_DATE__.split('-');
    const versionDate = this.language === 'de' ? `${day}.${month}.${year}` : __BUILD_DATE__;
    const footer = this.footerEl = h('footer', { class: 'app-footer' },
      h('span', {}, 'Minimaschine Web'),
      h('span', {}, `${d.footerVersion} ${versionDate}`, __BUILD_COMMIT__ ? h('span', { class: 'mono muted' }, ` · ${__BUILD_COMMIT__}`) : null),
      h('span', {}, `${d.footerBy} `,
        h('a', { href: 'https://github.com/eingoldfish', target: '_blank', rel: 'noopener', title: d.footerProfileTitle }, 'eingoldfisch')));
    setChildren(root, header, this.statusEl, this.mainEl, footer);
    this.setSplit(this.splitPercent, false);
    this.updateMaximized();

    // ----- editor (needs its host element in the page) -----
    const autosaved = carry ? carry.text : loadSource();
    if (autosaved === null) this.savedText = defaultProgram(this.language);
    this.editor = createEditor(editorHost, autosaved ?? defaultProgram(this.language), {
      onChange: () => this.onSourceChanged(),
      onBreakpointsChange: (lines) => this.session.setBreakpointLines(lines),
    });
    if (carry) {
      this.editor.setBreakpointLines(carry.breakpoints);
      // Show the error list again, now in the new language (the machine stays unchanged).
      if (carry.hadErrors) {
        const errors = assembleSource(carry.text, { extended: this.extended, lang: this.language }).errors;
        this.editor.setErrors(errors);
        this.showErrors(errors);
      }
    }

    const signal = this.listeners.signal;
    document.addEventListener('keydown', (ev) => this.onKey(ev), { signal });
    // Save immediately when the page is closed or hidden (the timer might not run anymore).
    window.addEventListener('pagehide', () => this.autosaveNow(), { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosaveNow(); }, { signal });
    window.addEventListener('hashchange', () => { void this.loadFromHash(); void this.syncGuide(); }, { signal });
    document.addEventListener('fullscreenchange', () => this.updateFullscreenButton(), { signal });
    // A programming error must not leave the user puzzled: save the program and say so.
    const onError = () => {
      this.stopRun();
      this.autosaveNow();
      this.setStatus(t().unexpectedError, 'error');
    };
    window.addEventListener('error', onError, { signal });
    window.addEventListener('unhandledrejection', onError, { signal });
    // In "auto" the switch follows a change of the system setting.
    window.matchMedia(DARK_QUERY).addEventListener('change', () => this.applyTheme(), { signal });

    this.applyTheme();
    this.diagram.setExtended(this.extended);
    this.spButton.hidden = !this.extended;
    this.updateFileName();
    this.setMachineTab(this.machineTab);
    if (carry) {
      this.setStatus(d.languageChanged, 'info', true, !carry.statusShown);
      this.render();
      // after a language switch in the guide: open it again at the same place
      void this.syncGuide().then(() => { if (this.guide?.element.isConnected) window.scrollTo(0, carry.scrollY); });
      return;
    }
    this.setStatus(autosaved === null ? d.welcome : d.welcomeBack, 'info', true);
    this.render();
    void this.loadFromHash();
    void this.syncGuide();
  }

  /** Switches between German and English by rebuilding the page; the machine and the program stay. */
  private switchLanguage(): void {
    this.stopRun();
    this.leaveMicroView();
    this.autosaveNow();
    const oldText = this.editor.getText();
    this.language = this.language === 'de' ? 'en' : 'de';
    this.persistSettings();
    const { text, breakpoints } = this.translateUnchangedExample(oldText);
    const carry: AppCarry = {
      session: this.session,
      text,
      breakpoints,
      fileName: this.fileName,
      saveTarget: this.saveTarget,
      savedText: this.savedText,
      programStale: this.programStale,
      hadErrors: !this.errorList.hidden,
      scrollY: window.scrollY,
      machineTab: this.machineTab,
      maximized: this.maximized,
      guideOpenedHere: this.guideOpenedHere,
      statusShown: !this.statusEl.hidden && !this.statusEl.classList.contains('status-leaving'),
    };
    window.clearTimeout(this.statusTimer);
    this.listeners.abort();
    this.editor.destroy();
    new App(this.root, carry);
  }

  /**
   * Language switch: an example that has not been changed is shown in the new
   * language, too. Both versions give the same machine code, so a program that
   * was already assembled (or is running) just keeps going; only labels, line
   * numbers and breakpoints move to the new text.
   */
  private translateUnchangedExample(oldText: string): { text: string; breakpoints: number[] } {
    const breakpoints = this.editor.getBreakpointLines();
    const text = translateExample(oldText, this.language);
    if (text === null) return { text: oldText, breakpoints };

    const before = assembleSource(oldText, { extended: this.extended, lang: this.language });
    const after = assembleSource(text, { extended: this.extended, lang: this.language });
    const sameCode = before.ok && after.ok && after.memory.length === before.memory.length
      && after.memory.every((v, i) => v === before.memory[i]);

    // Breakpoints: line → address of the instruction there (or the next one below) → line in the new text.
    let newBreakpoints: number[] = [];
    if (sameCode) {
      const instructionLines = [...before.lineToAddress.keys()].sort((a, b) => a - b);
      newBreakpoints = breakpoints
        .map((line) => instructionLines.find((l) => l >= line))
        .map((line) => (line === undefined ? undefined : after.addressToLine.get(before.lineToAddress.get(line)!)))
        .filter((line): line is number => line !== undefined);
    }

    // The machine keeps running with the same code; only labels and line numbers change.
    const s = this.session;
    if (s.program && !this.programStale) {
      if (sameCode) s.replaceProgramInfo(after);
      else this.programStale = true;
    }
    if (this.savedText === oldText) this.savedText = text;
    saveSource(text);
    return { text, breakpoints: [...new Set(newBreakpoints)] };
  }

  // ==================================================================
  // Guide (#anleitung): a page of its own instead of the machine
  // ==================================================================

  private openGuide(): void {
    this.guideOpenedHere = true;
    location.hash = guideHash(this.language);
  }

  private closeGuide(): void {
    if (this.guideOpenedHere) {
      // Back to the entry before the guide: the browser's back button then works as expected, too.
      this.guideOpenedHere = false;
      history.back();
    } else {
      history.pushState(null, '', location.pathname + location.search);
      void this.syncGuide();
    }
  }

  /** Shows or hides the guide according to the address (#anleitung, #anleitung/<section>). */
  private async syncGuide(): Promise<void> {
    const route = parseGuideHash(location.hash);
    const open = this.guide?.element.isConnected ?? false;
    if (route) {
      if (!open) {
        this.stopRun();
        if (!this.guide) {
          const { createGuideView } = await import('./guide/view');
          // the address may have changed while loading, or the page was rebuilt (language)
          if (!this.root.contains(this.footerEl) || !parseGuideHash(location.hash)) return;
          this.guide ??= createGuideView(this.language, {
            close: () => this.closeGuide(),
            switchLanguage: () => this.switchLanguage(),
          });
        }
        if (!this.guide.element.isConnected) {
          this.appScrollY = window.scrollY;
          this.root.insertBefore(this.guide.element, this.footerEl);
          document.documentElement.classList.add('guide-open');
          this.guide.focus();
        }
      }
      this.guide!.showSection(parseGuideHash(location.hash)?.section ?? null);
    } else if (open) {
      this.guideOpenedHere = false;
      this.guide!.element.remove();
      document.documentElement.classList.remove('guide-open');
      window.scrollTo(0, this.appScrollY);
    }
  }

  // ==================================================================
  // Copying
  // ==================================================================

  /** Small button with the copy symbol; shows a check mark for a moment after copying. */
  private copyButton(title: string, copy: () => Promise<boolean>): HTMLButtonElement {
    const btn: HTMLButtonElement = h('button', {
      type: 'button', class: 'small icon-btn', title, 'aria-label': title,
      onclick: async () => {
        if (!(await copy())) return;
        btn.replaceChildren(checkIcon());
        window.setTimeout(() => btn.replaceChildren(copyIcon()), 1500);
      },
    }, copyIcon());
    return btn;
  }

  /** Copies text to the clipboard; falls back to the old copy command. Returns true on success. */
  private async copyText(text: string, success: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      this.setStatus(success, 'success', true);
      return true;
    } catch {
      // Clipboard API not allowed: try a hidden text field.
    }
    const area = h('textarea', { class: 'copy-buffer', readonly: true });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    this.setStatus(ok ? success : t().copyFailed, ok ? 'success' : 'error', ok);
    return ok;
  }

  private copyCode(): Promise<boolean> {
    const text = this.editor.getText();
    const lines = text.replace(/\n+$/, '').split('\n').length;
    return this.copyText(text, t().codeCopied(text.trim() === '' ? 0 : lines));
  }

  /** What the register view shows (also used to copy the registers as text). */
  private machineOptions(): MachineViewOptions {
    const s = this.session;
    const ir = s.state.ir;
    return {
      detailed: this.detailed,
      format: this.format === 'opcodes' ? 'signed' : this.format,
      currentLine: this.programStale ? undefined : s.currentLine,
      hasExecuted: !(ir.opcode === 0 && ir.mode === 'none' && ir.address === 0 && !s.canStepBack),
      labelAt: (a) => s.labelAt(a),
      extended: this.extended,
    };
  }

  /** Copies the registers as text, in the current language. */
  private copyMachine(): Promise<boolean> {
    return this.copyText(machineAsText(this.session.state, this.machineOptions()), t().machineCopied);
  }

  /** Copies the memory up to the last used cell, as displayed (format, hex addresses). */
  private async copyMemory(): Promise<boolean> {
    const st = this.session.state;
    const d = t();
    const table = memoryAsTable(st.memory, this.format, this.hexAddresses, this.extended ? st.sp : null,
      { address: d.addressColumn, stack: d.stackSection });
    if (!table) {
      this.setStatus(d.memoryEmpty, 'info', true);
      return false;
    }
    return this.copyText(table.text, d.memoryCopied(table.last, table.stack));
  }

  // ==================================================================
  // Files, examples, sharing, autosave
  // ==================================================================

  /** Asks before replacing a program that was changed since the last save. */
  private confirmReplace(question = t().confirmReplace): boolean {
    const text = this.editor.getText();
    const unchanged = text.trim() === '' || text === this.savedText || isExampleSource(text);
    return unchanged || window.confirm(question);
  }

  /** Puts a new program into the editor. */
  private replaceProgram(text: string, fileName: string | null, target?: SaveTarget): void {
    this.stopRun();
    this.leaveMicroView();
    this.editor.setText(text);
    this.editor.setErrors([]);
    this.showErrors([]);
    this.fileName = fileName;
    this.saveTarget = target;
    this.savedText = text;
    saveFileName(fileName);
    this.updateFileName();
    this.autosaveNow();
    this.render();
  }

  /** Small pop-up window in the middle of the screen with all examples. */
  private openExamples(): void {
    const d = t();
    const dialog = h('dialog', { class: 'examples-dialog', 'aria-labelledby': 'examples-heading' });
    const close = (): void => dialog.close();
    dialog.append(
      h('div', { class: 'examples-head' },
        h('h2', { id: 'examples-heading' }, d.examplesButton),
        h('button', { type: 'button', class: 'small icon-btn examples-close', title: d.examplesClose, 'aria-label': d.examplesClose, onclick: close }, '✕')),
      h('p', { class: 'examples-hint' }, d.examplesHint),
      h('ul', { class: 'examples-list' },
        ...getExamples(this.language).map((e) => h('li', {},
          h('button', {
            type: 'button',
            class: 'example-card',
            onclick: () => { close(); this.loadExample(e.id); },
          },
          h('span', { class: 'example-title' }, e.title,
            e.extended ? h('span', { class: 'example-badge' }, d.examplesExtended) : null),
          h('span', { class: 'example-desc' }, e.description))))));
    // A click on the dimmed background (outside the window) closes it, too.
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) close(); });
    // Many examples: the list scrolls; soft edges show that there is more above/below.
    const list = dialog.querySelector<HTMLElement>('.examples-list')!;
    const updateEdges = (): void => {
      list.classList.toggle('more-above', list.scrollTop > 2);
      list.classList.toggle('more-below', list.scrollTop + list.clientHeight < list.scrollHeight - 2);
    };
    list.addEventListener('scroll', updateEdges, { passive: true });
    const resize = new ResizeObserver(updateEdges);
    resize.observe(list);
    dialog.addEventListener('close', () => { resize.disconnect(); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
    updateEdges();
    dialog.querySelector<HTMLElement>('.example-card')?.focus();
  }

  private loadExample(id: string): void {
    const example = getExamples(this.language).find((e) => e.id === id);
    if (!example || !this.confirmReplace()) return;
    if (example.extended && !this.extended) this.setExtended(true, true);
    this.replaceProgram(example.source, null);
    this.setStatus(t().exampleLoaded(example.title, example.description, keys().assemble), 'success');
  }

  private async openProgram(): Promise<void> {
    if (!this.confirmReplace()) return;
    try {
      const file = await openFile();
      if (!file) return;
      this.replaceProgram(file.text, file.name, file.target);
      this.setStatus(t().fileOpened(file.name, keys().assemble), 'success');
    } catch (e) {
      this.setStatus(t().fileOpenFailed(e instanceof Error ? e.message : String(e)), 'error');
    }
  }

  private async saveProgram(): Promise<void> {
    const text = this.editor.getText();
    try {
      const result = await saveFile(text, this.fileName ?? (this.language === 'de' ? 'programm' : 'program'), this.saveTarget);
      if (!result) return;
      this.fileName = result.name;
      this.saveTarget = result.target;
      this.savedText = text;
      saveFileName(result.name);
      this.updateFileName();
      this.setStatus(result.downloaded ? t().fileDownloaded(result.name) : t().fileSaved(result.name), 'success', !result.downloaded);
    } catch (e) {
      this.setStatus(t().fileSaveFailed(e instanceof Error ? e.message : String(e)), 'error');
    }
  }

  private async shareProgram(): Promise<void> {
    const fragment = await encodeShare({ source: this.editor.getText(), extended: this.extended });
    const url = `${location.href.split('#')[0]}#${fragment}`;
    const longHint = url.length > 2000 ? t().linkLong(url.length) : '';
    try {
      await navigator.clipboard.writeText(url);
      this.setStatus(t().linkCopied + longHint, 'success', longHint === '');
    } catch {
      // Clipboard not allowed (e.g. old browser): show the link to copy by hand.
      window.prompt(t().linkPrompt, url);
    }
  }

  /** Opens a program from a shared link (#code=…). */
  private async loadFromHash(): Promise<void> {
    if (!location.hash.includes('code=')) return;
    try {
      const shared = await decodeShare(location.hash);
      // Remove the program from the address bar, so a reload does not load it again.
      history.replaceState(null, '', location.pathname + location.search);
      if (!shared) return;
      if (shared.source !== this.editor.getText()
        && !this.confirmReplace(t().confirmReplaceLink)) {
        return;
      }
      if (shared.extended && !this.extended) this.setExtended(true, true);
      this.replaceProgram(shared.source, null);
      this.setStatus(t().linkLoaded(keys().assemble), 'success');
    } catch {
      this.setStatus(t().linkBroken, 'error');
    }
  }

  private autosaveNow(): void {
    window.clearTimeout(this.autosaveTimer);
    saveSource(this.editor.getText());
  }

  private updateFileName(): void {
    this.fileNameEl.textContent = this.fileName ? t().fileName(this.fileName) : '';
  }

  /** Takes over the saved settings, checking every value. */
  private applySavedSettings(saved: Record<string, unknown>): void {
    const bool = (key: string, fallback: boolean) => (typeof saved[key] === 'boolean' ? (saved[key] as boolean) : fallback);
    this.detailed = bool('detailed', this.detailed);
    this.animations = bool('animations', this.animations);
    this.extended = bool('extended', this.extended);
    this.hexAddresses = bool('hexAddresses', this.hexAddresses);
    this.followPc = bool('followPc', this.followPc);
    const speed = saved['speedIndex'];
    if (typeof speed === 'number' && SPEEDS[speed]) this.speedIndex = speed;
    const limit = saved['limitSeconds'];
    if (typeof limit === 'number' && limit >= 1 && limit <= 600) this.limitSeconds = limit;
    const theme = saved['theme'];
    if (theme === 'auto' || theme === 'light' || theme === 'dark') this.theme = theme;
    const format = saved['format'];
    if (format === 'signed' || format === 'unsigned' || format === 'hex' || format === 'opcodes') this.format = format;
    // The projector mode was removed. It had switched to the light theme; give back the theme chosen before it.
    const before = saved['themeBeforeBeamer'];
    if (saved['beamer'] === true && (before === 'auto' || before === 'light' || before === 'dark')) this.theme = before;
    const split = saved['splitPercent'];
    if (typeof split === 'number' && split >= 20 && split <= 80) this.splitPercent = split;
    const language = saved['language'];
    if (language === 'de' || language === 'en') this.language = language;
  }

  private persistSettings(): void {
    saveSettings({
      detailed: this.detailed,
      animations: this.animations,
      extended: this.extended,
      hexAddresses: this.hexAddresses,
      followPc: this.followPc,
      speedIndex: this.speedIndex,
      limitSeconds: this.limitSeconds,
      theme: this.theme,
      format: this.format,
      language: this.language,
      splitPercent: this.splitPercent,
    });
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
    const result = this.session.assemble(this.editor.getText(), { keepMemory, extended: this.extended });
    this.editor.setErrors(result.errors);
    this.showErrors(result.errors);
    if (result.ok) {
      this.programStale = false;
      this.staleByReset = false;
      this.timedOut = false;
      if (result.size === 0) {
        this.setStatus(t().emptyProgram, 'warning');
      } else {
        this.setStatus(t().assembled(result.size - 1, keepMemory, keys().step, keys().run), 'success');
      }
      this.memory.scrollToAddress(0, true);
    } else {
      this.setStatus(t().errorsFound(result.errors.length), 'error');
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
    else {
      const shownLine = this.programStale ? undefined : line;
      this.setStatus(wasMicro ? t().finished(text, shownLine) : t().executed(text, shownLine), 'info', true);
    }
    this.render();
  }

  private stepBack(): void {
    if (this.running) return;
    this.leaveMicroView();
    const wasMicro = this.session.state.micro !== null;
    if (this.session.stepBack()) {
      this.timedOut = false;
      if (this.staleByReset && this.session.state.halted !== 'reset') {
        this.programStale = false; // the memory with the program is back
        this.staleByReset = false;
      }
      const nowMicro = this.session.state.micro !== null;
      this.setStatus(wasMicro || nowMicro ? t().backMicro : t().backStep, 'info', true);
    } else {
      this.setStatus(t().backNone, 'info', true);
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
    else this.setStatus(t().microStatus(event.index + 1, event.count, event.title, event.done), 'info', true);
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
    this.timedOut = false;
    this.setStatus(t().resetDone, 'info', true);
    this.render();
  }

  /** "Speicher löschen": memory cleared, registers stay (as in the original). */
  private clearMemory(): void {
    this.stopRun();
    this.leaveMicroView();
    this.session.clearMemory();
    if (this.session.program) this.programStale = true;
    this.staleByReset = false;
    this.setStatus(t().memoryCleared, 'info', true);
    this.render();
  }

  private toggleRun(): void {
    if (this.running) {
      this.stopRun();
      this.setStatus(t().paused, 'info', true);
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
    this.setStatus(t().running, 'info');
    this.render();
    requestAnimationFrame((t) => this.tick(t));
  }

  /** One animation frame of a program run. */
  private tick(now: number): void {
    if (!this.running) return;
    const speed = SPEEDS[this.speedIndex] ?? 10;
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
        this.timedOut = true;
        this.setStatus(t().limitReached(this.limitSeconds), 'warning');
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
    if (!this.session.hasProgram) {
      this.setStatus(t().assembleFirst(keys().assemble), 'warning');
      return false;
    }
    if (this.timedOut) {
      this.setStatus(t().timedOut, 'info');
      return false;
    }
    if (this.session.state.halted !== 'none') {
      this.setStatus(t().machineHalted, 'info');
      return false;
    }
    return true;
  }

  private reportStop(reason: StopReason): void {
    const st = this.session.state;
    switch (reason) {
      case 'halt':
        this.setStatus(t().stopHalt, 'success');
        break;
      case 'reset':
        // As in the original, RESET has cleared the memory: the program is no longer there.
        if (this.session.program && !this.programStale) {
          this.programStale = true;
          this.staleByReset = true;
        }
        this.setStatus(t().stopReset(keys().assemble), 'info');
        break;
      case 'illegalOpcode': {
        // As in the original, the PC already points behind the faulty instruction.
        const at = (st.pc - 2) & 0xffff;
        const word1 = st.memory[at] ?? 0;
        const word2 = st.memory[(at + 1) & 0xffff] ?? 0;
        const known = decodeWord1(word1);
        let detail = '';
        if (known?.def.extendedOnly && !this.extended) detail = t().illegalNeedsExtended(known.def.mnemonic);
        else if (known && known.mode === 'none' && word2 !== 0) detail = t().illegalAddressPart(known.def.mnemonic, word2);
        this.setStatus(t().stopIllegal(at, word1) + detail, 'error');
        break;
      }
      case 'divisionByZero':
        this.setStatus(t().stopDivZero(st.pc, disassembleAt(st.memory, st.pc).text), 'error');
        break;
      case 'breakpoint':
        this.setStatus(t().stopBreakpoint(String(this.session.currentLine ?? '?')), 'info');
        break;
      case 'none':
        break;
    }
  }

  private onSourceChanged(): void {
    this.staleByReset = false;
    window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => saveSource(this.editor.getText()), 400);
    if (this.session.program && !this.programStale) {
      this.programStale = true;
      this.setStatus(t().sourceChanged(keys().assemble), 'warning');
      this.render();
    }
  }

  private showErrors(errors: readonly AssembleError[]): void {
    this.errorList.hidden = errors.length === 0;
    setChildren(this.errorList, ...errors.map((e) =>
      h('li', {},
        h('button', { type: 'button', class: 'error-item', onclick: () => this.editor.goToLine(e.line) },
          h('strong', {}, t().lineLabel(e.line)), e.message, e.hint ? h('span', { class: 'error-hint' }, ` ${e.hint}`) : null))));
  }

  // ==================================================================
  // View settings
  // ==================================================================

  /** @param quiet true when switched on automatically (example/link): no status message */
  private setExtended(on: boolean, quiet = false): void {
    this.stopRun();
    this.leaveMicroView();
    this.extended = on;
    // As in the original (desktop 4.0): switching resets the CPU, memory stays.
    this.session.setExtended(on);
    this.timedOut = false;
    this.staleByReset = false;
    this.diagram.setExtended(on);
    this.spButton.hidden = !on;
    const box = document.querySelector<HTMLInputElement>('.extended-box');
    if (box) box.checked = on;
    this.persistSettings();
    if (quiet) {
      if (this.session.program) this.programStale = true;
      this.render();
      return;
    }
    if (this.session.program) {
      this.programStale = true;
      this.setStatus((on ? t().extendedOn : t().extendedOff) + t().extendedCpuReset + t().reassemble(keys().assemble), 'info');
    } else {
      this.setStatus((on ? t().extendedOn : t().extendedOff) + t().extendedCpuReset, 'info', true);
    }
    this.render();
  }

  private setMachineTab(tab: 'diagram' | 'registers'): void {
    this.machineTab = tab;
    for (const id of ['diagram', 'registers'] as const) {
      this.tabPanes[id].hidden = id !== tab;
      this.tabButtons[id].setAttribute('aria-selected', String(id === tab));
      this.tabButtons[id].tabIndex = id === tab ? 0 : -1; // Tab key reaches the selected tab only
    }
  }

  /** Text under the diagram: phase of the instruction cycle and what happens. */
  private renderExplanation(): void {
    const ev = this.lastEvent;
    const d = t();
    const phases: Array<[CyclePhase, string]> = [['fetch', d.phaseFetch], ['decode', d.phaseDecode], ['execute', d.phaseExecute]];
    const pills = h('ol', { class: 'phases', 'aria-label': d.cycleLabel },
      ...phases.map(([phase, label]) => h('li', { class: ev?.phase === phase ? 'current' : '' }, label)));
    if (!ev) {
      setChildren(this.explanationEl, pills,
        h('p', { class: 'muted' }, d.microHint(keys().microStep)));
      return;
    }
    setChildren(this.explanationEl, pills,
      h('p', { class: 'explanation-title' },
        h('strong', {}, ev.title),
        h('span', { class: 'muted' }, d.microOf(ev.index + 1, ev.count))),
      h('p', {}, ev.explanation));
  }

  /** True if the page is shown dark right now (chosen, or "auto" and the system is dark). */
  private isDark(): boolean {
    return this.theme === 'dark' || (this.theme === 'auto' && window.matchMedia(DARK_QUERY).matches);
  }

  /**
   * The switch starts in "auto" (follows the system). The first click fixes
   * the opposite of what is shown; after that it only toggles light/dark.
   */
  private toggleTheme(): void {
    this.theme = this.isDark() ? 'light' : 'dark';
    this.applyTheme();
    this.persistSettings();
  }

  private applyTheme(): void {
    const rootEl = document.documentElement;
    if (this.theme === 'auto') delete rootEl.dataset['theme'];
    else rootEl.dataset['theme'] = this.theme;
    const dark = String(this.isDark());
    for (const sw of this.themeSwitches) sw.setAttribute('aria-checked', dark);
  }

  private onKey(ev: KeyboardEvent): void {
    // While the guide is open, the machine does not react to its shortcuts.
    if (this.guide?.element.isConnected) {
      if (ev.key === 'Escape' && !document.querySelector('.menu.open')) this.closeGuide();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 's' || ev.key === 'o')) {
      ev.preventDefault(); // instead of the browser's "save page" / "open file"
      if (ev.key === 's') void this.saveProgram();
      else void this.openProgram();
      return;
    }
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
    } else if (ev.key === 'Escape' && this.maximized !== 'none') {
      this.toggleMaximized(this.maximized);
    }
  }

  // ==================================================================
  // Rendering
  // ==================================================================

  // ==================================================================
  // Panel size: maximize, splitter
  // ==================================================================

  /** Maximizes a panel or makes it small again. On phones the editor then covers the whole screen. */
  private toggleMaximized(panel: 'editor' | 'machine'): void {
    this.maximized = this.maximized === panel ? 'none' : panel;
    this.updateMaximized();
    if (this.maximized === 'editor') this.editor.focus();
    this.render();
  }

  /** Shows the whole page in full screen, or leaves full screen again. */
  private toggleFullscreen(): void {
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    request.catch(() => this.setStatus(t().fullscreenFailed, 'warning'));
  }

  private updateFullscreenButton(): void {
    const d = t();
    const on = document.fullscreenElement !== null;
    const title = on ? d.exitFullscreen : d.fullscreen;
    this.fullscreenButton.title = title;
    this.fullscreenButton.setAttribute('aria-label', title);
    this.fullscreenButton.setAttribute('aria-pressed', String(on));
    const icon = on ? exitFullscreenIcon() : fullscreenIcon();
    // crop the empty margin, so the arrows are as tall as the light/dark switch
    icon.setAttribute('viewBox', '2.5 2.5 19 19');
    this.fullscreenButton.replaceChildren(icon);
  }

  private updateMaximized(): void {
    const rootEl = document.documentElement;
    rootEl.classList.toggle('max-editor', this.maximized === 'editor');
    rootEl.classList.toggle('max-machine', this.maximized === 'machine');
    const d = t();
    for (const panel of ['editor', 'machine'] as const) {
      const on = this.maximized === panel;
      const title = on ? d.restorePanel : panel === 'editor' ? d.maximizeProgram : d.maximizeMachine;
      const btn = this.maxButtons[panel];
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.setAttribute('aria-pressed', String(on));
      btn.replaceChildren(on ? restoreIcon() : maximizeIcon());
    }
  }

  /** Sets the width of the program panel (percent, 20 … 80). */
  private setSplit(percent: number, persist = true): void {
    this.splitPercent = Math.round(Math.min(80, Math.max(20, percent)));
    this.mainEl.style.setProperty('--split', `${this.splitPercent}%`);
    this.mainEl.querySelector('.splitter')?.setAttribute('aria-valuenow', String(this.splitPercent));
    if (persist) this.persistSettings();
  }

  /** Dragging the bar between program and machine with mouse, pen or finger. */
  private startSplitDrag(ev: PointerEvent, splitter: HTMLElement): void {
    ev.preventDefault();
    splitter.setPointerCapture(ev.pointerId);
    splitter.classList.add('dragging');
    const move = (e: PointerEvent) => {
      const box = this.mainEl.getBoundingClientRect();
      this.setSplit(((e.clientX - box.left) / box.width) * 100, false);
    };
    const end = () => {
      splitter.classList.remove('dragging');
      splitter.removeEventListener('pointermove', move);
      splitter.removeEventListener('pointerup', end);
      splitter.removeEventListener('pointercancel', end);
      this.persistSettings();
    };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', end);
    splitter.addEventListener('pointercancel', end);
  }

  /**
   * Shows a message in the status line.
   * @param transient true for unimportant messages (confirmations, single
   *        steps …): they disappear after a few seconds. Errors, warnings and
   *        messages that tell what to do next stay until the next message.
   */
  /** @param animate false: show the message at once (e.g. in place of one that was visible before a rebuild) */
  private setStatus(text: string, kind: StatusKind, transient = false, animate = true): void {
    window.clearTimeout(this.statusTimer);
    if (transient) this.statusTimer = window.setTimeout(() => this.setStatus('', 'info'), TRANSIENT_STATUS_MS);
    const el = this.statusEl;
    const wasShown = !el.hidden && !el.classList.contains('status-leaving');
    if (text === '') {
      if (wasShown) this.animateStatusOut();
      else el.hidden = true;
      return;
    }
    const oldHeight = wasShown ? el.getBoundingClientRect().height : 0;
    for (const a of el.getAnimations()) a.cancel();
    el.textContent = text;
    el.className = `status status-${kind}`;
    el.hidden = false;
    if (!animate) return;
    if (wasShown) this.animateStatusResize(oldHeight);
    else this.animateStatusIn();
  }

  /** True when the status line may be animated (visible on the page, motion allowed). */
  private canAnimateStatus(): boolean {
    return typeof this.statusEl.animate === 'function'
      && this.statusEl.getClientRects().length > 0
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Appearing: first only the coloured bar on the left grows from top to
   * bottom (the line makes room for itself at the same time), then the bar
   * widens to the right and uncovers the rest of the message.
   */
  private animateStatusIn(): void {
    if (!this.canAnimateStatus()) return;
    const el = this.statusEl;
    const cs = getComputedStyle(el);
    const height = el.getBoundingClientRect().height;
    const width = el.getBoundingClientRect().width;
    const bar = parseFloat(cs.borderLeftWidth) || 4;
    const closedRight = `inset(0 ${width - bar}px 0 0)`;
    const growMs = 140;
    const expandMs = 340;
    // phase 1: room + bar grow downwards, the rest stays covered
    el.animate([
      { height: '0px', marginTop: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', overflow: 'hidden' },
      { height: `${height}px`, marginTop: cs.marginTop, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, overflow: 'hidden' },
    ], { duration: growMs, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    // phase 2: bar widens to the right and reveals the message
    el.animate([
      { clipPath: closedRight },
      { clipPath: closedRight, offset: growMs / (growMs + expandMs), easing: 'cubic-bezier(0.3, 0, 0, 1)' },
      { clipPath: 'inset(0 0 0 0)' },
    ], { duration: growMs + expandMs });
  }

  /** Vanishing: fades out upwards while the room it took closes gradually. */
  private animateStatusOut(): void {
    const el = this.statusEl;
    if (!this.canAnimateStatus()) {
      el.hidden = true;
      return;
    }
    for (const a of el.getAnimations()) a.cancel();
    const cs = getComputedStyle(el);
    const height = el.getBoundingClientRect().height;
    el.classList.add('status-leaving');
    const anim = el.animate([
      { height: `${height}px`, marginTop: cs.marginTop, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, opacity: 1, transform: 'translateY(0)', overflow: 'hidden' },
      { opacity: 0, transform: `translateY(-${Math.round(height * 0.6)}px)`, offset: 0.6 },
      { height: '0px', marginTop: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', opacity: 0, transform: `translateY(-${height}px)`, overflow: 'hidden' },
    ], { duration: 240, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' });
    anim.onfinish = () => {
      el.hidden = true;
      el.classList.remove('status-leaving');
    };
    anim.oncancel = () => el.classList.remove('status-leaving');
  }

  /** A new message replaces a visible one: only the height changes smoothly. */
  private animateStatusResize(oldHeight: number): void {
    if (!this.canAnimateStatus()) return;
    const newHeight = this.statusEl.getBoundingClientRect().height;
    if (Math.abs(newHeight - oldHeight) < 1) return;
    this.statusEl.animate([
      { height: `${oldHeight}px`, overflow: 'hidden' },
      { height: `${newHeight}px`, overflow: 'hidden' },
    ], { duration: 150, easing: 'ease-out' });
  }

  private render(): void {
    const s = this.session;
    const st = s.state;
    const currentLine = this.programStale ? undefined : s.currentLine;

    this.machine.update(st, this.machineOptions());
    this.diagram.update(st, this.lastEvent, { labelAt: (a) => s.labelAt(a) });
    this.renderExplanation();
    this.memory.update(st, {
      format: this.format,
      hexAddresses: this.hexAddresses,
      sp: this.extended ? st.sp : null,
      labelAt: (a) => s.labelAt(a),
    });
    if (this.followPc) this.memory.scrollToAddress(st.pc);

    const isError = st.halted === 'illegalOpcode' || st.halted === 'divisionByZero';
    // After HALT or an illegal instruction the PC already points behind it
    // (often into the data); highlighting the instruction itself is clearer.
    const execLine = (st.halted === 'halt' || st.halted === 'illegalOpcode') && !this.programStale
      ? s.program?.addressToLine.get((st.pc - 2) & 0xffff)
      : currentLine;
    this.editor.setExecLine(execLine ?? null, isError ? 'error' : 'normal');

    this.btn.stepBack.disabled = this.running || !s.canStepBack;
    this.btn.step.disabled = this.running;
    this.btn.micro.disabled = this.running;
    this.btn.run.firstChild!.textContent = this.running ? t().pause : t().run;
    this.btn.run.classList.toggle('is-running', this.running);
  }
}

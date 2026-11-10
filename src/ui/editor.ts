/**
 * Code editor based on CodeMirror 6.
 *
 * Features: line numbers, undo/redo, syntax highlighting, error markers,
 * breakpoints (click on the line number), highlighting of the line the PC
 * points to, and a help tooltip when hovering over an instruction.
 *
 * CodeMirror keeps its whole state in an immutable EditorState; changes are
 * made by dispatching "transactions" (similar to an event in Java Swing that
 * carries all changes at once). Our own extra data (breakpoints, current line)
 * lives in "state fields" that are updated by "effects".
 */
import { RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  drawSelection,
  EditorView,
  gutter,
  GutterMarker,
  highlightActiveLine,
  hoverTooltip,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import {
  EXTENDED_MNEMONICS,
  lookupMnemonic,
  WORD_DIRECTIVE,
  type AssembleError,
  type InstructionDef,
} from '../core';

// ====================================================================
// Syntax highlighting
// ====================================================================

const LETTER = 'A-Za-zÄÖÜäöüß';
const WORD_RE = new RegExp(`^[${LETTER}][${LETTER}0-9]*`);

function isInstructionName(word: string): boolean {
  const upper = word.toUpperCase();
  return lookupMnemonic(word) !== undefined || upper === WORD_DIRECTIVE || EXTENDED_MNEMONICS.includes(upper);
}

/** Simple line-by-line tokenizer for the Minimaschine assembler language. */
const minimaschineLanguage = StreamLanguage.define<{ afterOperation: boolean }>({
  name: 'minimaschine',
  startState: () => ({ afterOperation: false }),
  token(stream, state) {
    if (stream.sol()) state.afterOperation = false;
    if (stream.eatSpace()) return null;
    if (stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^0[xX][0-9A-Fa-f]+/) || stream.match(/^[0-9]+/)) return 'number';
    if (stream.match(WORD_RE)) {
      const word = stream.current();
      if (stream.match(/^\s*:/, false)) return 'labelName';
      if (!state.afterOperation && isInstructionName(word)) {
        state.afterOperation = true;
        return 'keyword';
      }
      if (word.toUpperCase() === 'SP') return 'atom';
      return 'variableName';
    }
    if (stream.match(/^[$@()\-:]/)) return 'operator';
    stream.next();
    return 'invalid';
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: tags.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--syn-number)' },
  { tag: tags.labelName, color: 'var(--syn-label)', fontWeight: '600' },
  { tag: tags.variableName, color: 'var(--syn-label)' },
  { tag: tags.atom, color: 'var(--syn-number)' },
  { tag: tags.operator, color: 'var(--syn-operator)' },
  { tag: tags.invalid, color: 'var(--danger)' },
]);

// ====================================================================
// Breakpoints (gutter left of the line numbers)
// ====================================================================

class BreakpointMarker extends GutterMarker {
  override toDOM(): Node {
    const dot = document.createElement('span');
    dot.className = 'cm-breakpoint-dot';
    dot.title = 'Haltepunkt – Klick zum Entfernen';
    return dot;
  }
}
const breakpointMarker = new BreakpointMarker();

const clearBreakpointsEffect = StateEffect.define<null>();

const toggleBreakpointEffect = StateEffect.define<{ pos: number; on: boolean }>({
  map: (value, mapping) => ({ pos: mapping.mapPos(value.pos), on: value.on }),
});

/** Set of line start positions that carry a breakpoint; moves along with edits. */
const breakpointField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    let result = set.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(clearBreakpointsEffect)) result = RangeSet.empty;
      if (!effect.is(toggleBreakpointEffect)) continue;
      const { pos, on } = effect.value;
      result = on
        ? result.update({ add: [breakpointMarker.range(pos)] })
        : result.update({ filter: (from) => from !== pos });
    }
    return result;
  },
});

function toggleBreakpoint(view: EditorView, linePos: number): void {
  let has = false;
  view.state.field(breakpointField).between(linePos, linePos, () => {
    has = true;
  });
  view.dispatch({ effects: toggleBreakpointEffect.of({ pos: linePos, on: !has }) });
}

const breakpointGutter: Extension = [
  breakpointField,
  gutter({
    class: 'cm-breakpoint-gutter',
    markers: (view) => view.state.field(breakpointField),
    initialSpacer: () => breakpointMarker,
    domEventHandlers: {
      mousedown(view, line) {
        toggleBreakpoint(view, line.from);
        return true;
      },
    },
  }),
];

// ====================================================================
// Highlight of the line the PC points to
// ====================================================================

export type ExecLineKind = 'normal' | 'error';
const setExecLineEffect = StateEffect.define<{ line: number; kind: ExecLineKind } | null>();

const execLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let result = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setExecLineEffect)) continue;
      const v = effect.value;
      if (!v || v.line < 1 || v.line > tr.state.doc.lines) {
        result = Decoration.none;
      } else {
        const cls = v.kind === 'error' ? 'cm-exec-line cm-exec-error' : 'cm-exec-line';
        result = Decoration.set([Decoration.line({ class: cls }).range(tr.state.doc.line(v.line).from)]);
      }
    }
    return result;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// ====================================================================
// Help tooltip for instructions
// ====================================================================

function exampleFor(def: InstructionDef, name: string): string {
  if (def.modes.includes('none')) return name;
  if (name === def.immediateMnemonic) return `${name} 5`;
  if (def.mnemonic === 'JSR') return `${name} Unterprogramm`;
  if (def.group === 'jump') return `${name} Schleife`;
  if (def.mnemonic === 'STORE') return `${name} Ergebnis`;
  return `${name} Wert`;
}

function helpTooltip(word: string): HTMLElement | null {
  const upper = word.toUpperCase();
  const box = document.createElement('div');
  box.className = 'cm-help';
  const add = (tag: string, text: string, cls?: string) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    box.append(el);
  };

  if (upper === WORD_DIRECTIVE) {
    add('strong', 'WORD');
    add('p', 'Reserviert eine Speicherzelle mit dem angegebenen Startwert (auch negativ oder eine Marke).');
    add('code', 'Zähler: WORD 0');
    return box;
  }
  const found = lookupMnemonic(word);
  if (!found) return null;
  const { def } = found;
  const names = [def.mnemonic, ...def.aliases].join(' / ');
  const isOwnShortForm = def.immediateMnemonic === def.mnemonic; // RSV, REL
  add('strong', found.forcedMode && !isOwnShortForm ? `${upper} (= ${def.mnemonic} $Zahl)` : names);
  if (def.extendedOnly) add('p', 'Nur im erweiterten Modus.', 'cm-help-flags');
  add('p', def.descriptionDe);
  add('p', `Flags: ${def.flagsDe}`, 'cm-help-flags');
  if (!found.forcedMode && def.immediateMnemonic && !isOwnShortForm) {
    add('p', `Mit fester Zahl: ${def.immediateMnemonic} 5`, 'cm-help-flags');
  }
  add('code', `Beispiel: ${exampleFor(def, upper)}`);
  return box;
}

const WORD_CHAR = new RegExp(`[${LETTER}0-9]`);

const instructionHelp = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const commentStart = text.indexOf('#');
  if (commentStart >= 0 && pos - line.from >= commentStart) return null;
  let start = pos - line.from;
  let end = start;
  while (start > 0 && WORD_CHAR.test(text[start - 1] ?? '')) start--;
  while (end < text.length && WORD_CHAR.test(text[end] ?? '')) end++;
  if (start === end) return null;
  const dom = helpTooltip(text.slice(start, end));
  if (!dom) return null;
  return { pos: line.from + start, end: line.from + end, above: true, create: () => ({ dom }) };
});

// ====================================================================
// Theme (colours come from CSS variables, so light/dark mode just works)
// ====================================================================

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '1rem', backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--text)' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--selection)' },
  '.cm-activeLine': { backgroundColor: 'var(--active-line)' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', borderRight: '1px solid var(--border)' },
  '.cm-lineNumbers .cm-gutterElement': { cursor: 'pointer', minWidth: '2.5em' },
  '.cm-breakpoint-gutter .cm-gutterElement': { cursor: 'pointer', width: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' },
});

// ====================================================================
// Public API
// ====================================================================

export interface ProgramEditor {
  getText(): string;
  setText(text: string): void;
  /** Shows assembler errors as underlines + markers (empty list = clear). */
  setErrors(errors: readonly AssembleError[]): void;
  /** Highlights the line the PC points to (null = no highlight). */
  setExecLine(line: number | null, kind?: ExecLineKind): void;
  /** Lines (1-based) that carry a breakpoint. */
  getBreakpointLines(): number[];
  /** Moves the cursor to a line and focuses the editor. */
  goToLine(line: number): void;
  focus(): void;
}

export interface EditorCallbacks {
  /** The text was changed by the user. */
  onChange(): void;
  /** Breakpoints were added/removed or moved. */
  onBreakpointsChange(lines: number[]): void;
}

export function createEditor(parent: HTMLElement, initialText: string, callbacks: EditorCallbacks): ProgramEditor {
  const breakpointLines = (view: EditorView): number[] => {
    const lines: number[] = [];
    view.state.field(breakpointField).between(0, view.state.doc.length, (from) => {
      lines.push(view.state.doc.lineAt(from).number);
    });
    return lines;
  };

  const view = new EditorView({
    parent,
    doc: initialText,
    extensions: [
      breakpointGutter,
      lineNumbers({
        domEventHandlers: {
          mousedown(v, line) {
            toggleBreakpoint(v, line.from);
            return true;
          },
        },
      }),
      lintGutter(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      minimaschineLanguage,
      syntaxHighlighting(highlightStyle),
      execLineField,
      instructionHelp,
      editorTheme,
      EditorView.contentAttributes.of({ 'aria-label': 'Assembler-Programm', spellcheck: 'false' }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.onChange();
        if (update.startState.field(breakpointField) !== update.state.field(breakpointField)) {
          callbacks.onBreakpointsChange(breakpointLines(update.view));
        }
      }),
    ],
  });

  return {
    getText: () => view.state.doc.toString(),

    setText(text) {
      // A new program: old breakpoints and the undo history no longer fit.
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        effects: clearBreakpointsEffect.of(null),
      });
    },

    setErrors(errors) {
      const doc = view.state.doc;
      const diagnostics: Diagnostic[] = errors
        .filter((e) => e.line >= 1 && e.line <= doc.lines)
        .map((e) => {
          const line = doc.line(e.line);
          const from = Math.min(line.from + e.column - 1, line.to);
          const to = Math.min(from + Math.max(e.length, 1), line.to);
          return {
            from,
            to: Math.max(to, from),
            severity: 'error',
            message: e.hint ? `${e.message} ${e.hint}` : e.message,
          };
        });
      view.dispatch(setDiagnostics(view.state, diagnostics));
    },

    setExecLine(line, kind = 'normal') {
      const effects: StateEffect<unknown>[] = [setExecLineEffect.of(line === null ? null : { line, kind })];
      if (line !== null && line >= 1 && line <= view.state.doc.lines) {
        effects.push(EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'nearest' }));
      }
      view.dispatch({ effects });
    },

    getBreakpointLines: () => breakpointLines(view),

    goToLine(line) {
      const target = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
      view.focus();
    },

    focus: () => view.focus(),
  };
}

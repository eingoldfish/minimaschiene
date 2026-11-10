/**
 * Schematic picture of the machine (SVG) with animated data flow.
 *
 * Left: arithmetic unit (accumulator, Y-shaped ALU, status register).
 * Middle: control unit (instruction register, decoder, program counter).
 * Right: data, address and control bus, then a window into memory.
 *
 * SVG is the browser's vector graphics format: shapes are elements in the
 * DOM like HTML elements, so we can change texts and CSS classes from code.
 */
import {
  disassemble,
  encodeWord1,
  lookupOpcode,
  toSigned16,
  type CpuState,
  type FlowRoute,
  type MachinePart,
  type MicroStepEvent,
} from '../core';
import { MODE_NAMES } from './texts';

const SVG_NS = 'http://www.w3.org/2000/svg';

type Point = readonly [number, number];

/** Where each flow travels in the picture (polyline through the wires). */
const ROUTES: Record<FlowRoute, readonly Point[]> = {
  'pc→mem': [[440, 245], [500, 245], [500, 210], [560, 210]],
  'addr→mem': [[440, 175], [500, 175], [500, 210], [560, 210]],
  'mem→ir': [[560, 120], [470, 120], [470, 28], [310, 28], [310, 50]],
  'mem→decoder': [[560, 120], [470, 120], [470, 145], [440, 145]],
  'mem→aluB': [[560, 120], [470, 120], [470, 28], [215, 28], [215, 120], [165, 120], [165, 140]],
  'ir→decoder': [[350, 100], [350, 130]],
  'ir→aluB': [[255, 88], [230, 88], [230, 120], [165, 120], [165, 140]],
  'ir→pc': [[255, 70], [240, 70], [240, 245], [255, 245]],
  'acc→aluA': [[75, 100], [75, 140]],
  'alu→acc': [[120, 240], [120, 262], [25, 262], [25, 75], [40, 75]],
  'alu→flags': [[120, 240], [120, 290]],
  'flags→acc': [[40, 315], [25, 315], [25, 75], [40, 75]],
  'acc→mem': [[120, 50], [120, 28], [470, 28], [470, 120], [560, 120]],
};

/** Milliseconds a value needs for one route. */
const FLOW_MS = 750;
const MEMORY_ROWS = 7;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

const pointsAttr = (pts: readonly Point[]) => pts.map((p) => p.join(',')).join(' ');

export interface DiagramContext {
  labelAt(address: number): string | undefined;
}

export class DiagramView {
  readonly element: SVGSVGElement;
  private readonly parts = new Map<MachinePart, SVGElement>();
  private readonly texts: Record<string, SVGTextElement> = {};
  private readonly flagEls: Record<'z' | 'n' | 'v' | 'c', SVGGElement>;
  private readonly busLines: Record<'data' | 'address' | 'control', SVGLineElement>;
  private readonly memRows: Array<{ group: SVGGElement; addr: SVGTextElement; value: SVGTextElement; label: SVGTextElement }> = [];
  private readonly tokenLayer: SVGGElement;
  /** Cancels a running animation (finishes it immediately). */
  private cancelAnimation: (() => void) | null = null;
  /** State and context of the last update(), used by play(). */
  private lastState: Readonly<CpuState> | null = null;
  private lastCtx: DiagramContext | null = null;

  constructor() {
    const root = svg('svg', {
      viewBox: '0 0 720 420',
      class: 'diagram',
      role: 'img',
      'aria-label': 'Schaubild der Minimaschine: Rechenwerk, Steuerwerk, Busse und Speicher',
    });
    this.element = root;

    // ----- frame -----
    root.append(svg('rect', { x: 10, y: 10, width: 440, height: 400, rx: 10, class: 'd-frame' }));
    root.append(svg('text', { x: 22, y: 400, class: 'd-caption' }, 'Prozessor (CPU)'));
    root.append(svg('text', { x: 40, y: 375, class: 'd-caption' }, 'Rechenwerk'));
    root.append(svg('text', { x: 255, y: 375, class: 'd-caption' }, 'Steuerwerk'));

    // ----- wires (all routes, drawn faintly) -----
    const wires = svg('g', { class: 'd-wires' });
    for (const pts of Object.values(ROUTES)) wires.append(svg('polyline', { points: pointsAttr(pts) }));
    root.append(wires);

    // ----- buses -----
    const bus = (x: number, cls: string) => svg('line', { x1: x, y1: 28, x2: x, y2: 400, class: `d-bus ${cls}` });
    this.busLines = { data: bus(470, 'bus-data'), address: bus(500, 'bus-address'), control: bus(530, 'bus-control') };
    root.append(this.busLines.data, this.busLines.address, this.busLines.control);
    root.append(svg('line', { x1: 440, y1: 160, x2: 530, y2: 160, class: 'd-bus bus-control thin' }));
    root.append(svg('line', { x1: 530, y1: 300, x2: 560, y2: 300, class: 'd-bus bus-control thin' }));
    for (const [key, x] of [['data', 470], ['address', 500], ['control', 530]] as const) {
      this.texts[`bus-${key}`] = svg('text', { x: x - 5, y: 395, class: 'd-bus-label', transform: `rotate(-90 ${x - 5} 395)` });
      root.append(this.texts[`bus-${key}`]!);
    }

    // ----- accumulator -----
    this.addBox('acc', 40, 50, 160, 50, 'Akkumulator');
    this.texts['acc'] = this.addValue(120, 90, 'd-value');

    // ----- ALU (Y shape) -----
    const alu = svg('polygon', {
      points: '40,140 110,140 120,165 130,140 200,140 150,240 90,240',
      class: 'd-part',
    });
    this.parts.set('alu', alu);
    root.append(alu);
    root.append(svg('text', { x: 160, y: 255, class: 'd-label' }, 'ALU'));
    this.texts['alu-op'] = this.addValue(120, 200, 'd-alu-op');
    this.texts['alu-calc'] = this.addValue(120, 225, 'd-small');

    // ----- status register -----
    this.addBox('flags', 40, 290, 160, 50, 'Statusregister');
    const flagEls = {} as Record<'z' | 'n' | 'v' | 'c', SVGGElement>;
    (['z', 'n', 'v', 'c'] as const).forEach((f, i) => {
      const g = svg('g', { class: 'd-flag' });
      g.append(svg('rect', { x: 50 + i * 37, y: 310, width: 30, height: 24, rx: 4 }));
      g.append(svg('text', { x: 65 + i * 37, y: 327 }, f.toUpperCase()));
      root.append(g);
      flagEls[f] = g;
    });
    this.flagEls = flagEls;

    // ----- instruction register -----
    this.addBox('ir', 255, 50, 185, 50, 'Befehlsregister');
    root.append(svg('line', { x1: 370, y1: 68, x2: 370, y2: 100, class: 'd-divider' }));
    this.texts['ir-op'] = this.addValue(312, 92, 'd-value small');
    this.texts['ir-addr'] = this.addValue(405, 92, 'd-value small');

    // ----- decoder -----
    this.addBox('decoder', 255, 130, 185, 60, 'Steuerwerk (Dekodierer)');
    this.texts['decoder'] = this.addValue(347, 162, 'd-small');
    this.texts['decoder2'] = this.addValue(347, 181, 'd-small muted');

    // ----- program counter -----
    this.addBox('pc', 255, 220, 185, 50, 'Befehlszähler (PC)');
    this.texts['pc'] = this.addValue(347, 260, 'd-value');

    // ----- memory -----
    const mem = svg('rect', { x: 560, y: 30, width: 150, height: 370, rx: 8, class: 'd-part' });
    this.parts.set('memory', mem);
    root.append(mem);
    root.append(svg('text', { x: 572, y: 52, class: 'd-label' }, 'Speicher'));
    for (let i = 0; i < MEMORY_ROWS; i++) {
      const y = 70 + i * 46;
      const group = svg('g', { class: 'd-mem-row' });
      group.append(svg('rect', { x: 568, y, width: 134, height: 38, rx: 4 }));
      const addr = svg('text', { x: 574, y: y + 31, class: 'd-mem-addr' });
      const value = svg('text', { x: 696, y: y + 29, class: 'd-mem-value' });
      const label = svg('text', { x: 574, y: y + 12, class: 'd-mem-label' });
      group.append(addr, value, label);
      root.append(group);
      this.memRows.push({ group, addr, value, label });
    }

    this.tokenLayer = svg('g', { class: 'd-tokens' });
    root.append(this.tokenLayer);
  }

  /** Shows the state; `event` (if any) highlights the parts of the last micro step. */
  update(state: Readonly<CpuState>, event: MicroStepEvent | null, ctx: DiagramContext): void {
    this.finishAnimation();
    const t = this.texts;
    t['acc']!.textContent = String(toSigned16(state.a));
    t['pc']!.textContent = String(state.pc);

    // Instruction register: show what has been fetched so far.
    const ir = state.ir;
    const fetchedWord1 = !state.micro || state.micro.index >= 1;
    const fetchedWord2 = !state.micro || state.micro.index >= 2;
    const def = lookupOpcode(ir.opcode);
    const noInstruction = ir.opcode === 0 && ir.mode === 'none' && ir.address === 0 && !state.micro;
    t['ir-op']!.textContent = noInstruction ? '—'
      : !fetchedWord1 ? '' : def && ir.mode ? (ir.mode === 'immediate' && def.immediateMnemonic ? def.immediateMnemonic : def.mnemonic) : '???';
    t['ir-addr']!.textContent = noInstruction || !fetchedWord2 ? '' : String(ir.address);

    // Decoder: decoded instruction (after the decode step) or phase.
    let decoded = '';
    let decoded2 = '';
    if (state.micro && state.micro.index < 3) {
      decoded = state.micro.index === 0 ? '' : 'holt den Befehl …';
    } else if (!noInstruction && def && ir.mode) {
      decoded = disassemble(encodeWord1(def, ir.mode), ir.address, ctx.labelAt).text;
      decoded2 = MODE_NAMES[ir.mode];
    }
    if (event?.phase === 'decode' && event.title.includes('unbekannt')) decoded = 'unbekannter Befehl!';
    t['decoder']!.textContent = decoded;
    t['decoder2']!.textContent = decoded2;

    // Flags
    for (const f of ['z', 'n', 'v', 'c'] as const) {
      this.flagEls[f].classList.toggle('on', state.flags[f]);
    }

    this.lastState = state;
    this.lastCtx = ctx;
    this.showActivity(event, state, ctx);
  }

  /** Buses, highlighted parts and the memory window for a micro step (or none). */
  private showActivity(event: MicroStepEvent | null, state: Readonly<CpuState>, ctx: DiagramContext): void {
    const t = this.texts;

    // ALU: operation and calculation of this micro step
    if (event?.alu) {
      t['alu-op']!.textContent = event.alu.op;
      t['alu-calc']!.textContent = event.alu.op === '→'
        ? `${toSigned16(event.alu.b)}`
        : `${toSigned16(event.alu.a)} ${event.alu.op} ${toSigned16(event.alu.b)} = ${toSigned16(event.alu.result)}`;
    } else {
      t['alu-op']!.textContent = '';
      t['alu-calc']!.textContent = '';
    }

    const b = event?.bus ?? {};
    t['bus-data']!.textContent = b.data !== undefined ? `Datenbus: ${b.data}` : 'Datenbus';
    t['bus-address']!.textContent = b.address !== undefined ? `Adressbus: ${b.address}` : 'Adressbus';
    t['bus-control']!.textContent = b.control ? `Steuerbus: ${b.control}` : 'Steuerbus';
    this.busLines.data.classList.toggle('active', b.data !== undefined);
    this.busLines.address.classList.toggle('active', b.address !== undefined);
    this.busLines.control.classList.toggle('active', b.control !== undefined);

    // Active parts
    const active = new Set(event?.active ?? []);
    for (const [part, el] of this.parts) el.classList.toggle('active', active.has(part));

    // Memory window around the accessed address (or the PC)
    const focus = b.address ?? state.pc;
    const first = Math.max(0, Math.min(0xffff - MEMORY_ROWS + 1, focus - Math.floor(MEMORY_ROWS / 2)));
    this.memRows.forEach((row, i) => {
      const address = first + i;
      row.addr.textContent = String(address);
      row.value.textContent = String(toSigned16(state.memory[address] ?? 0));
      row.label.textContent = ctx.labelAt(address) ?? '';
      row.group.classList.toggle('accessed', address === b.address);
      row.group.classList.toggle('is-pc', address === state.pc);
    });
  }

  /**
   * Animates the flows of a micro step: each value moves along its route,
   * one after the other. Resolves when done (or immediately if `animate` is false).
   */
  play(event: MicroStepEvent, animate: boolean): Promise<void> {
    this.finishAnimation();
    // Show buses, involved parts and the accessed memory cell already during the animation.
    if (this.lastState && this.lastCtx) this.showActivity(event, this.lastState, this.lastCtx);
    // No animation if switched off, nothing moves, or the page is not visible (then animation frames pause).
    if (!animate || event.flows.length === 0 || document.hidden) return Promise.resolve();

    return new Promise((resolve) => {
      let cancelled = false;
      let frame = 0;
      const token = svg('g', { class: 'd-token' });
      const box = svg('rect', { rx: 5, height: 24 });
      const label = svg('text', { y: 5 });
      token.append(box, label);
      this.tokenLayer.append(token);

      const done = () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        token.remove();
        this.cancelAnimation = null;
        resolve();
      };
      this.cancelAnimation = done;

      let flowIndex = -1;
      let start = 0;
      let points: readonly Point[] = [];
      let lengths: number[] = [];
      let total = 0;

      const nextFlow = (now: number) => {
        flowIndex++;
        const flow = event.flows[flowIndex];
        if (!flow) return false;
        points = ROUTES[flow.route];
        lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
        total = lengths.reduce((a, b) => a + b, 0);
        label.textContent = flow.label;
        const width = Math.max(30, flow.label.length * 9.5 + 14);
        box.setAttribute('width', String(width));
        box.setAttribute('x', String(-width / 2));
        box.setAttribute('y', '-12');
        start = now;
        return true;
      };

      const tick = (now: number) => {
        if (cancelled) return;
        if (flowIndex < 0 && !nextFlow(now)) return done();
        let progress = (now - start) / FLOW_MS;
        if (progress >= 1) {
          if (!nextFlow(now)) return done();
          progress = 0;
        }
        // Ease in/out, then find the position on the polyline.
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - (2 - 2 * progress) ** 2 / 2;
        let dist = eased * total;
        let i = 0;
        while (i < lengths.length - 1 && dist > lengths[i]!) dist -= lengths[i++]!;
        const p0 = points[i]!;
        const p1 = points[i + 1] ?? p0;
        const f = lengths[i] ? dist / lengths[i]! : 0;
        token.setAttribute('transform', `translate(${p0[0] + (p1[0] - p0[0]) * f} ${p0[1] + (p1[1] - p0[1]) * f})`);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
  }

  /** Stops a running animation immediately. */
  finishAnimation(): void {
    this.cancelAnimation?.();
  }

  get isAnimating(): boolean {
    return this.cancelAnimation !== null;
  }

  // ---------- helpers ----------

  private addBox(part: MachinePart, x: number, y: number, w: number, h: number, label: string): void {
    const rect = svg('rect', { x, y, width: w, height: h, rx: 6, class: 'd-part' });
    this.parts.set(part, rect);
    this.element.append(rect);
    this.element.append(svg('text', { x: x + 8, y: y + 17, class: 'd-label' }, label));
  }

  private addValue(x: number, y: number, cls: string): SVGTextElement {
    const t = svg('text', { x, y, class: cls, 'text-anchor': 'middle' });
    this.element.append(t);
    return t;
  }
}

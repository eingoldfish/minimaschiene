/**
 * Micro steps: one instruction split into the phases of the instruction cycle
 * (Befehlszyklus): Holen – Dekodieren – Ausführen (fetch – decode – execute).
 *
 * planInstruction() looks at the machine state at the START of an instruction
 * and returns the list of micro steps. Each step carries
 *   - an event for the UI (phase, explanation, bus values, data flows) and
 *   - an apply() function that changes the state a little bit.
 * After the last step the state is exactly the same as after Cpu.step()
 * (checked by tests/microcode.test.ts). The language only changes the texts.
 *
 * The split into micro steps is our own (the manual does not define it in
 * detail, see docs/kompatibilitaet.md, point 8):
 *   Holen 1/2      PC → Adressbus, Speicher → Datenbus → Befehlsregister (Befehlswort), PC + 1
 *   Holen 2/2      PC → Adressbus, Speicher → Datenbus → Befehlsregister (Adressteil), PC + 1
 *   Dekodieren     Steuerwerk erkennt Befehl und Adressierungsart
 *   Ausführen      je nach Befehl 1–3 Schritte:
 *                  [Adresse nachschlagen (indirekt)] [Operand holen] Rechnen / Schreiben / Springen
 */
import { alu, ALU_INSTRUCTIONS, ALU_SYMBOLS, JUMP_CONDITIONS, type AluOp, type Flags } from './alu';
import type { AluActivity, CpuState, CyclePhase, InstructionRegister } from './cpu';
import { disassemble } from './disassembler';
import { toSigned16, WORD_MASK } from './format';
import { decodeInstruction, SP_START, type AddressingMode } from './isa';
import type { Language } from './lang';

/** Parts of the machine that can light up in the picture. */
export type MachinePart = 'pc' | 'sp' | 'ir' | 'decoder' | 'acc' | 'alu' | 'flags' | 'memory';

/**
 * Paths along which a value travels in the picture. The UI decides how
 * they are drawn; the core only names them.
 */
export type FlowRoute =
  | 'pc→mem' // PC puts an address on the address bus
  | 'addr→mem' // control unit puts an operand address on the address bus
  | 'mem→ir' // memory → data bus → instruction register
  | 'mem→decoder' // memory → data bus → control unit (indirect: looked-up address)
  | 'mem→aluB' // memory → data bus → ALU input 2
  | 'ir→decoder' // instruction register → control unit
  | 'ir→aluB' // address part (immediate number) → ALU input 2
  | 'ir→pc' // address part → PC (jump)
  | 'acc→aluA' // accumulator → ALU input 1
  | 'alu→acc' // ALU result → accumulator
  | 'alu→flags' // ALU → status register
  | 'flags→acc' // carry flag → accumulator (LOADC)
  | 'acc→mem' // accumulator → data bus → memory (STORE)
  | 'sp→mem' // stack pointer puts an address on the address bus
  | 'sp→addr' // stack pointer → control unit (address = address part + SP)
  | 'ir→sp' // number from the address part → stack pointer (RSV/REL)
  | 'mem→pc' // memory → data bus → PC (RTS)
  | 'pc→data'; // PC → data bus → memory (JSR saves the return address)

export interface Flow {
  route: FlowRoute;
  /** Text shown on the moving token, e.g. "532" or "LOAD". */
  label: string;
}

/** Signal on the control bus: memory is read or written. */
export type BusControl = 'read' | 'write';

export interface MicroStepEvent {
  phase: CyclePhase;
  /** Short title, e.g. "Holen 1/2: Befehlswort". */
  title: string;
  /** Explanation with the concrete values. */
  explanation: string;
  /** Values on the buses during this step (undefined = bus not used). */
  bus: { address?: number; data?: number; control?: BusControl };
  /** ALU activity, if any. */
  alu?: AluActivity;
  /** Values moving through the machine, in this order. */
  flows: Flow[];
  /** Parts that are involved (highlighted). */
  active: MachinePart[];
  /** Number of this micro step within the instruction (0-based) and their count. */
  index: number;
  count: number;
  /** True if this was the last micro step of the instruction. */
  done: boolean;
}

/** Registers at the start of an instruction (everything except memory and micro state). */
export interface InstructionStart {
  a: number;
  pc: number;
  sp: number;
  ir: InstructionRegister;
  flags: Flags;
  halted: CpuState['halted'];
  lastWrite: number | null;
}

/** Progress inside an instruction that is executed micro step by micro step. */
export interface MicroContext {
  start: InstructionStart;
  /** Number of micro steps already done. */
  index: number;
}

/** Environment passed to apply(): writing memory must go through the CPU (for undo). */
export interface MicroEnv {
  write(address: number, value: number): void;
  /** Clears the whole memory (instruction RESET). */
  clearMemory(): void;
}

export interface PlannedMicroStep {
  event: Omit<MicroStepEvent, 'index' | 'count' | 'done'>;
  apply(state: CpuState, env: MicroEnv): void;
}

/**
 * Language of the planInstruction() call that is running right now
 * (synchronous, so a module variable is safe).
 */
let lang: Language = 'de';
const tr = (de: string, en: string): string => (lang === 'en' ? en : de);

const MODE_NAMES: Record<Language, Record<AddressingMode, string>> = {
  de: {
    none: 'ohne Adresse',
    direct: 'direkt',
    immediate: 'unmittelbar',
    indirect: 'indirekt',
    offset: 'relativ zum SP',
    offsetIndirect: 'indirekt relativ zum SP',
    immediateOffset: 'unmittelbar relativ zum SP',
  },
  en: {
    none: 'no address',
    direct: 'direct',
    immediate: 'immediate',
    indirect: 'indirect',
    offset: 'relative to SP',
    offsetIndirect: 'indirect relative to SP',
    immediateOffset: 'immediate relative to SP',
  },
};

const s16 = (v: number) => String(toSigned16(v));

function flagText(f: Flags): string {
  return `Z=${+f.z} N=${+f.n} V=${+f.v} C=${+f.c}`;
}

const fetchTitle = (n: 1 | 2, what: string) => `${tr('Holen', 'Fetch')} ${n}/2: ${what}`;
const execTitle = (what: string) => `${tr('Ausführen', 'Execute')}: ${what}`;

/** Description of what an ALU operation computes. */
function computeText(op: AluOp, a: number, b: number, result: number): string {
  switch (op) {
    case 'PASS':
      return tr(`Der Wert ${s16(b)} wird in den Akku übernommen.`, `The value ${s16(b)} is taken into the accumulator.`);
    case 'NOT':
      return tr(`Das Rechenwerk kehrt alle Bits von ${s16(a)} um: Ergebnis ${s16(result)}.`,
        `The ALU inverts all bits of ${s16(a)}: result ${s16(result)}.`);
    case 'DIVU':
    case 'MODU':
    case 'MULHU':
      return tr(`Das Rechenwerk rechnet ohne Vorzeichen ${a} ${ALU_SYMBOLS[op]} ${b} = ${result}.`,
        `The ALU computes (unsigned) ${a} ${ALU_SYMBOLS[op]} ${b} = ${result}.`);
    case 'SHL':
    case 'SHR':
    case 'SHRA':
      return tr(`Das Rechenwerk schiebt ${s16(a)} um ${b & 31} Stellen (${ALU_SYMBOLS[op]}): Ergebnis ${s16(result)}.`,
        `The ALU shifts ${s16(a)} by ${b & 31} places (${ALU_SYMBOLS[op]}): result ${s16(result)}.`);
    default:
      return tr(`Das Rechenwerk rechnet ${s16(a)} ${ALU_SYMBOLS[op]} ${s16(b)} = ${s16(result)}.`,
        `The ALU computes ${s16(a)} ${ALU_SYMBOLS[op]} ${s16(b)} = ${s16(result)}.`);
  }
}

/**
 * Plans all micro steps of the instruction at start.pc.
 * Memory must still be unchanged since the start of the instruction
 * (only the very last micro step of STORE, PUSH and JSR writes).
 */
export function planInstruction(start: InstructionStart, memory: Uint16Array, language: Language = 'de', extended = false): PlannedMicroStep[] {
  lang = language;
  const read = (address: number) => memory[address & WORD_MASK] ?? 0;
  const pc0 = start.pc;
  const pc1 = (pc0 + 1) & WORD_MASK;
  const pc2 = (pc0 + 2) & WORD_MASK;
  const word1 = read(pc0);
  const word2 = read(pc1);
  const decoded = decodeInstruction(word1, word2, extended);
  const steps: PlannedMicroStep[] = [];

  // ----- Holen / fetch -----
  steps.push({
    event: {
      phase: 'fetch',
      title: fetchTitle(1, tr('Befehlswort', 'instruction word')),
      explanation: tr(
        `Der Befehlszähler schickt die Adresse ${pc0} über den Adressbus zum Speicher (Steuerbus: lesen). `
          + `Der Speicher liefert den Inhalt ${word1} über den Datenbus ins Befehlsregister. Der Befehlszähler wird um 1 erhöht.`,
        `The program counter sends the address ${pc0} over the address bus to memory (control bus: read). `
          + `Memory returns the content ${word1} over the data bus into the instruction register. The program counter is increased by 1.`),
      bus: { address: pc0, data: word1, control: 'read' },
      flows: [{ route: 'pc→mem', label: String(pc0) }, { route: 'mem→ir', label: String(word1) }],
      active: ['pc', 'memory', 'ir'],
    },
    apply(s) {
      s.ir = { opcode: word1 & 0xff, mode: decoded?.mode ?? null, address: s.ir.address };
      s.pc = pc1;
    },
  });
  steps.push({
    event: {
      phase: 'fetch',
      title: fetchTitle(2, tr('Adressteil', 'address part')),
      explanation: tr(
        `Der Befehlszähler schickt die Adresse ${pc1} über den Adressbus. `
          + `Der Adressteil ${word2} kommt über den Datenbus ins Befehlsregister. `
          + `Der Befehlszähler wird wieder um 1 erhöht und zeigt jetzt auf den nächsten Befehl (${pc2}).`,
        `The program counter sends the address ${pc1} over the address bus. `
          + `The address part ${word2} comes over the data bus into the instruction register. `
          + `The program counter is increased by 1 again and now points to the next instruction (${pc2}).`),
      bus: { address: pc1, data: word2, control: 'read' },
      flows: [{ route: 'pc→mem', label: String(pc1) }, { route: 'mem→ir', label: String(word2) }],
      active: ['pc', 'memory', 'ir'],
    },
    apply(s) {
      s.ir.address = word2;
      s.pc = pc2;
    },
  });

  // ----- Dekodieren / decode -----
  if (!decoded) {
    steps.push({
      event: {
        phase: 'decode',
        title: tr('Dekodieren: unbekannter Befehl', 'Decode: unknown instruction'),
        explanation: tr(
          `Das Steuerwerk erkennt in ${word1} (Adressteil ${word2}) keinen gültigen Befehl. Die Maschine hält an; `
            + `der Befehlszähler zeigt schon auf ${pc2}, der fehlerhafte Befehl steht bei Adresse ${pc0}.`,
          `The control unit finds no valid instruction in ${word1} (address part ${word2}). The machine halts; `
            + `the program counter already points to ${pc2}, the faulty instruction is at address ${pc0}.`),
        bus: {},
        flows: [{ route: 'ir→decoder', label: String(word1) }],
        active: ['ir', 'decoder'],
      },
      apply(s) {
        s.halted = 'illegalOpcode';
      },
    });
    return steps;
  }

  const { def, mode } = decoded;
  const name = def.mnemonic;
  const text = disassemble(word1, word2).text;
  steps.push({
    event: {
      phase: 'decode',
      title: tr('Dekodieren', 'Decode'),
      explanation: tr(
        `Das Steuerwerk erkennt den Befehl ${text} (${def.description.de.replace(/\.$/, '')}). Adressierungsart: ${MODE_NAMES.de[mode]}.`,
        `The control unit recognises the instruction ${text} (${def.description.en.replace(/\.$/, '')}). Addressing mode: ${MODE_NAMES.en[mode]}.`),
      bus: {},
      flows: [{ route: 'ir→decoder', label: def.immediateMnemonic && mode === 'immediate' ? def.immediateMnemonic : name }],
      active: ['ir', 'decoder'],
    },
    apply() {},
  });

  // ----- Ausführen / execute -----

  const sp = start.sp;
  const spMinus1 = (sp - 1) & WORD_MASK;
  const spPlus1 = (sp + 1) & WORD_MASK;

  // SP-relative addressing: first compute address part + SP.
  let address = word2;
  if (mode === 'offset' || mode === 'offsetIndirect' || mode === 'immediateOffset') {
    const sum = (word2 + sp) & WORD_MASK;
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(tr('Adresse berechnen', 'compute address')),
        explanation: tr(`Adressierung relativ zum Stackpointer: Adressteil ${word2} + SP ${sp} = ${sum}.`,
          `Addressing relative to the stack pointer: address part ${word2} + SP ${sp} = ${sum}.`)
          + (mode === 'immediateOffset' ? tr(' Diese Summe ist selbst der Operand.', ' This sum itself is the operand.') : ''),
        bus: {},
        flows: [{ route: 'sp→addr', label: String(sp) }],
        active: ['sp', 'decoder'],
      },
      apply() {},
    });
    address = sum;
  }

  // Indirect addressing: first look up the real address in memory.
  if (mode === 'indirect' || mode === 'offsetIndirect') {
    const lookupAt = address;
    const target = read(lookupAt);
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(tr('Adresse nachschlagen', 'look up address')),
        explanation: tr(
          `Indirekte Adressierung: In Zelle ${lookupAt} steht erst die eigentliche Adresse. Das Steuerwerk liest sie über den Datenbus: ${target}.`,
          `Indirect addressing: cell ${lookupAt} contains the actual address. The control unit reads it over the data bus: ${target}.`),
        bus: { address: lookupAt, data: target, control: 'read' },
        flows: [{ route: 'addr→mem', label: String(lookupAt) }, { route: 'mem→decoder', label: String(target) }],
        active: ['decoder', 'memory'],
      },
      apply() {},
    });
    address = target;
  }

  // Stack instructions (extended mode). JSR (adr) has already looked up its target above.
  const stackSteps = planStackInstruction(name, { start, word2, target: address, pc0, pc2, sp, spMinus1, spPlus1, read });
  if (stackSteps) return [...steps, ...stackSteps];

  // Jumps
  const condition = JUMP_CONDITIONS[name];
  if (condition) {
    const jumps = condition(start.flags);
    const condText = def.condition ? def.condition[lang] : '';
    const target = address;
    const targetDe = mode === 'indirect' ? `die nachgeschlagene Adresse ${target}` : `der Adressteil ${target}`;
    const targetEn = mode === 'indirect' ? `the looked-up address ${target}` : `the address part ${target}`;
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(jumps ? tr('Sprung', 'jump') : tr('kein Sprung', 'no jump')),
        explanation: name === 'JMP'
          ? tr(`Unbedingter Sprung: ${targetDe} wird in den Befehlszähler geladen.`,
            `Unconditional jump: ${targetEn} is loaded into the program counter.`)
          : tr(`${name} springt, ${condText}. Flags: ${flagText(start.flags)} → `, `${name} jumps ${condText}. Flags: ${flagText(start.flags)} → `)
            + (jumps
              ? tr(`Bedingung erfüllt, ${targetDe} wird in den Befehlszähler geladen.`,
                `condition met, ${targetEn} is loaded into the program counter.`)
              : tr(`Bedingung nicht erfüllt, es geht mit Adresse ${pc2} weiter.`,
                `condition not met, execution continues at address ${pc2}.`)),
        bus: {},
        flows: jumps ? [{ route: 'ir→pc', label: String(target) }] : [],
        active: jumps ? ['flags', 'decoder', 'pc'] : ['flags', 'decoder'],
      },
      apply(s) {
        if (jumps) s.pc = target;
      },
    });
    return steps;
  }

  // STORE
  if (name === 'STORE') {
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(tr('Schreiben', 'write')),
        explanation: tr(
          `Die Adresse ${address} kommt auf den Adressbus, der Steuerbus meldet „schreiben“. `
            + `Der Akku legt seinen Wert ${s16(start.a)} auf den Datenbus, der Speicher legt ihn in Zelle ${address} ab.`,
          `The address ${address} goes onto the address bus, the control bus signals “write”. `
            + `The accumulator puts its value ${s16(start.a)} on the data bus, memory stores it in cell ${address}.`),
        bus: { address, data: start.a, control: 'write' },
        flows: [{ route: 'addr→mem', label: String(address) }, { route: 'acc→mem', label: s16(start.a) }],
        active: ['decoder', 'acc', 'memory'],
      },
      apply(_s, env) {
        env.write(address, start.a);
      },
    });
    return steps;
  }

  // Simple control instructions
  if (name === 'NOOP' || name === 'HALT' || name === 'RESET') {
    const info = {
      NOOP: [execTitle(tr('nichts tun', 'do nothing')),
        tr('NOOP tut nichts. Es geht mit dem nächsten Befehl weiter.', 'NOOP does nothing. Execution continues with the next instruction.')],
      HALT: [execTitle(tr('anhalten', 'halt')),
        tr('HALT: Die Maschine hält an. Das Programm ist zu Ende.', 'HALT: the machine halts. The program is finished.')],
      RESET: [execTitle(tr('zurücksetzen', 'reset')),
        tr('RESET: Akku, Befehlszähler, Befehlsregister und Flags werden 0, der Stackpointer wird auf seinen Startwert gesetzt und der ganze Speicher wird gelöscht – auch das Programm. Die Maschine hält an.',
          'RESET: accumulator, program counter, instruction register and flags become 0, the stack pointer is set to its start value and the whole memory is cleared – the program, too. The machine halts.')],
    }[name];
    steps.push({
      event: { phase: 'execute', title: info[0]!, explanation: info[1]!, bus: {}, flows: [], active: ['decoder'] },
      apply(s, env) {
        if (name === 'HALT') {
          s.halted = 'halt';
        } else if (name === 'RESET') {
          s.a = 0;
          s.pc = 0;
          s.flags = { z: false, n: false, v: false, c: false };
          s.ir = { opcode: 0, mode: 'none', address: 0 };
          s.sp = SP_START;
          env.clearMemory(); // as in the original
          s.halted = 'reset';
        }
      },
    });
    return steps;
  }

  // LOADC: carry flag → accumulator
  if (name === 'LOADC') {
    const c = start.flags.c ? 1 : 0;
    const res = alu('PASS', start.a, c)!;
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(tr('Carry laden', 'load carry')),
        explanation: tr(`Das Carry-Flag (${c}) wird in den Akku geladen. Neue Flags: ${flagText(res.flags)}.`,
          `The carry flag (${c}) is loaded into the accumulator. New flags: ${flagText(res.flags)}.`),
        bus: {},
        alu: { a: start.a, b: c, op: ALU_SYMBOLS.PASS, result: res.result },
        flows: [{ route: 'flags→acc', label: String(c) }],
        active: ['flags', 'acc'],
      },
      apply(s) {
        s.a = res.result;
        s.flags = res.flags;
        s.lastAlu = { a: start.a, b: c, op: ALU_SYMBOLS.PASS, result: res.result };
      },
    });
    return steps;
  }

  // Everything else goes through the ALU: LOAD, arithmetic, logic, shifts, CMP.
  const isCompare = name === 'CMP';
  const op: AluOp | undefined = isCompare ? 'SUB' : ALU_INSTRUCTIONS[name];
  if (!op) throw new Error(`no micro steps for ${name}`);

  // Operand
  let b = 0;
  if (mode === 'immediateOffset') {
    b = address; // address part + SP, computed above
  } else if (mode === 'immediate') {
    b = word2;
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(tr('Operand aus dem Adressteil', 'operand from the address part')),
        explanation: tr(
          `Unmittelbare Adressierung: Der Adressteil ${s16(word2)} ist selbst der Operand und geht direkt an das Rechenwerk – ein Speicherzugriff ist nicht nötig.`,
          `Immediate addressing: the address part ${s16(word2)} itself is the operand and goes directly to the ALU – no memory access is needed.`),
        bus: {},
        flows: [{ route: 'ir→aluB', label: s16(word2) }],
        active: ['ir', 'alu'],
      },
      apply() {},
    });
  } else if (mode !== 'none') {
    b = read(address);
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(tr('Operand holen', 'fetch operand')),
        explanation: tr(
          `Die Adresse ${address} kommt auf den Adressbus (Steuerbus: lesen). Der Speicher liefert den Wert ${s16(b)} über den Datenbus an das Rechenwerk.`,
          `The address ${address} goes onto the address bus (control bus: read). Memory returns the value ${s16(b)} over the data bus to the ALU.`),
        bus: { address, data: b, control: 'read' },
        flows: [{ route: 'addr→mem', label: String(address) }, { route: 'mem→aluB', label: s16(b) }],
        active: ['decoder', 'memory', 'alu'],
      },
      apply() {},
    });
  }

  // Compute
  const res = alu(op, start.a, b);
  if (!res) {
    steps.push({
      event: {
        phase: 'execute',
        title: execTitle(tr('Division durch 0!', 'division by 0!')),
        explanation: tr(
          `Das Rechenwerk soll durch 0 teilen – das geht nicht. Die Maschine hält an. Akku und Flags bleiben unverändert, der Befehlszähler zeigt wieder auf den Befehl (${pc0}).`,
          `The ALU is asked to divide by 0 – that is impossible. The machine halts. Accumulator and flags stay unchanged, the program counter points to the instruction again (${pc0}).`),
        bus: {},
        alu: { a: start.a, b, op: ALU_SYMBOLS[op], result: start.a },
        flows: [{ route: 'acc→aluA', label: s16(start.a) }],
        active: ['acc', 'alu'],
      },
      apply(s) {
        s.pc = pc0;
        s.halted = 'divisionByZero';
        s.lastAlu = { a: start.a, b, op: ALU_SYMBOLS[op], result: start.a };
      },
    });
    return steps;
  }

  const usesAcc = op !== 'PASS';
  const flows: Flow[] = [];
  if (usesAcc) flows.push({ route: 'acc→aluA', label: s16(start.a) });
  if (!isCompare) flows.push({ route: 'alu→acc', label: s16(res.result) });
  flows.push({ route: 'alu→flags', label: flagText(res.flags) });

  steps.push({
    event: {
      phase: 'execute',
      title: execTitle(isCompare ? tr('Vergleichen', 'compare') : op === 'PASS' ? tr('Laden', 'load') : tr('Rechnen', 'compute')),
      explanation: isCompare
        ? tr(`Vergleich: Das Rechenwerk rechnet ${s16(start.a)} − ${s16(b)} = ${s16(res.result)}. Das Ergebnis wird nicht gespeichert, nur die Flags: ${flagText(res.flags)}.`,
          `Comparison: the ALU computes ${s16(start.a)} − ${s16(b)} = ${s16(res.result)}. The result is not stored, only the flags: ${flagText(res.flags)}.`)
        : `${computeText(op, start.a, b, res.result)} `
          + tr(`Das Ergebnis kommt in den Akku. Neue Flags: ${flagText(res.flags)}.`,
            `The result goes into the accumulator. New flags: ${flagText(res.flags)}.`),
      bus: {},
      alu: { a: start.a, b, op: isCompare ? 'cmp' : ALU_SYMBOLS[op], result: res.result },
      flows,
      active: ['acc', 'alu', 'flags'],
    },
    apply(s) {
      if (!isCompare) s.a = res.result;
      s.flags = res.flags;
      s.lastAlu = { a: start.a, b, op: isCompare ? 'cmp' : ALU_SYMBOLS[op], result: res.result };
    },
  });
  return steps;
}

interface StackContext {
  start: InstructionStart;
  word2: number;
  /** Jump target of JSR (address part, or the looked-up address for JSR (adr)). */
  target: number;
  pc0: number;
  pc2: number;
  sp: number;
  spMinus1: number;
  spPlus1: number;
  read(address: number): number;
}

/** Micro steps of the execute phase of stack instructions, or null for other instructions. */
function planStackInstruction(name: string, c: StackContext): PlannedMicroStep[] | null {
  const decSp = (why: string): PlannedMicroStep => ({
    event: {
      phase: 'execute',
      title: execTitle(tr('SP verringern', 'decrease SP')),
      explanation: `${why} `
        + tr(`Der Stackpointer wird um 1 verringert: ${c.sp} − 1 = ${c.spMinus1}. Der Stack wächst also nach unten.`,
          `The stack pointer is decreased by 1: ${c.sp} − 1 = ${c.spMinus1}. So the stack grows downwards.`),
      bus: {},
      flows: [],
      active: ['sp'],
    },
    apply(s) {
      s.sp = c.spMinus1;
    },
  });
  const incSp: PlannedMicroStep = {
    event: {
      phase: 'execute',
      title: execTitle(tr('SP erhöhen', 'increase SP')),
      explanation: tr(`Der Stackpointer wird um 1 erhöht: ${c.sp} + 1 = ${c.spPlus1}. Der oberste Platz auf dem Stack ist wieder frei.`,
        `The stack pointer is increased by 1: ${c.sp} + 1 = ${c.spPlus1}. The top place on the stack is free again.`),
      bus: {},
      flows: [],
      active: ['sp'],
    },
    apply(s) {
      s.sp = c.spPlus1;
    },
  };

  switch (name) {
    case 'PUSH':
      return [
        decSp(tr('PUSH legt den Akku auf den Stack.', 'PUSH puts the accumulator on the stack.')),
        {
          event: {
            phase: 'execute',
            title: execTitle(tr('auf den Stack schreiben', 'write to the stack')),
            explanation: tr(
              `Der Stackpointer (${c.spMinus1}) kommt auf den Adressbus, der Steuerbus meldet „schreiben“. `
                + `Der Akku legt ${s16(c.start.a)} auf den Datenbus, der Speicher legt den Wert in Zelle ${c.spMinus1} ab.`,
              `The stack pointer (${c.spMinus1}) goes onto the address bus, the control bus signals “write”. `
                + `The accumulator puts ${s16(c.start.a)} on the data bus, memory stores the value in cell ${c.spMinus1}.`),
            bus: { address: c.spMinus1, data: c.start.a, control: 'write' },
            flows: [{ route: 'sp→mem', label: String(c.spMinus1) }, { route: 'acc→mem', label: s16(c.start.a) }],
            active: ['sp', 'acc', 'memory'],
          },
          apply(_s, env) {
            env.write(c.spMinus1, c.start.a);
          },
        },
      ];

    case 'POP': {
      const value = c.read(c.sp);
      const res = alu('PASS', c.start.a, value)!;
      return [
        {
          event: {
            phase: 'execute',
            title: execTitle(tr('vom Stack lesen', 'read from the stack')),
            explanation: tr(
              `Der Stackpointer (${c.sp}) kommt auf den Adressbus (Steuerbus: lesen). Der Speicher liefert den obersten Stackwert ${s16(value)} über den Datenbus.`,
              `The stack pointer (${c.sp}) goes onto the address bus (control bus: read). Memory returns the top stack value ${s16(value)} over the data bus.`),
            bus: { address: c.sp, data: value, control: 'read' },
            flows: [{ route: 'sp→mem', label: String(c.sp) }, { route: 'mem→aluB', label: s16(value) }],
            active: ['sp', 'memory', 'alu'],
          },
          apply() {},
        },
        {
          event: {
            phase: 'execute',
            title: execTitle(tr('Laden', 'load')),
            explanation: tr(`Der Wert ${s16(value)} wird in den Akku übernommen. Neue Flags: ${flagText(res.flags)}.`,
              `The value ${s16(value)} is taken into the accumulator. New flags: ${flagText(res.flags)}.`),
            bus: {},
            alu: { a: c.start.a, b: value, op: ALU_SYMBOLS.PASS, result: res.result },
            flows: [{ route: 'alu→acc', label: s16(res.result) }, { route: 'alu→flags', label: flagText(res.flags) }],
            active: ['alu', 'acc', 'flags'],
          },
          apply(s) {
            s.a = res.result;
            s.flags = res.flags;
            s.lastAlu = { a: c.start.a, b: value, op: ALU_SYMBOLS.PASS, result: res.result };
          },
        },
        incSp,
      ];
    }

    case 'JSR':
      return [
        decSp(tr('JSR ruft ein Unterprogramm auf und merkt sich vorher, wohin es danach zurückgehen soll.',
          'JSR calls a subroutine and first remembers where to return to afterwards.')),
        {
          event: {
            phase: 'execute',
            title: execTitle(tr('Rücksprungadresse sichern', 'save return address')),
            explanation: tr(
              `Die Adresse des nächsten Befehls (${c.pc2}) wird auf den Stack geschrieben: Adressbus ${c.spMinus1}, Datenbus ${c.pc2}, Steuerbus „schreiben“.`,
              `The address of the next instruction (${c.pc2}) is written to the stack: address bus ${c.spMinus1}, data bus ${c.pc2}, control bus “write”.`),
            bus: { address: c.spMinus1, data: c.pc2, control: 'write' },
            flows: [{ route: 'sp→mem', label: String(c.spMinus1) }, { route: 'pc→data', label: String(c.pc2) }],
            active: ['sp', 'pc', 'memory'],
          },
          apply(_s, env) {
            env.write(c.spMinus1, c.pc2);
          },
        },
        {
          event: {
            phase: 'execute',
            title: execTitle(tr('Sprung ins Unterprogramm', 'jump into the subroutine')),
            explanation: c.target === c.word2
              ? tr(`Der Adressteil ${c.word2} wird in den Befehlszähler geladen – weiter geht es im Unterprogramm.`,
                `The address part ${c.word2} is loaded into the program counter – execution continues in the subroutine.`)
              : tr(`Die nachgeschlagene Adresse ${c.target} wird in den Befehlszähler geladen – weiter geht es im Unterprogramm.`,
                `The looked-up address ${c.target} is loaded into the program counter – execution continues in the subroutine.`),
            bus: {},
            flows: [{ route: 'ir→pc', label: String(c.target) }],
            active: ['decoder', 'pc'],
          },
          apply(s) {
            s.pc = c.target;
          },
        },
      ];

    case 'RTS': {
      const target = c.read(c.sp);
      return [
        {
          event: {
            phase: 'execute',
            title: execTitle(tr('Rücksprungadresse holen', 'fetch return address')),
            explanation: tr(
              `Der Stackpointer (${c.sp}) kommt auf den Adressbus (Steuerbus: lesen). Der Speicher liefert die gemerkte Rücksprungadresse ${target}, sie kommt in den Befehlszähler.`,
              `The stack pointer (${c.sp}) goes onto the address bus (control bus: read). Memory returns the saved return address ${target}; it goes into the program counter.`),
            bus: { address: c.sp, data: target, control: 'read' },
            flows: [{ route: 'sp→mem', label: String(c.sp) }, { route: 'mem→pc', label: String(target) }],
            active: ['sp', 'memory', 'pc'],
          },
          apply(s) {
            s.pc = target;
          },
        },
        incSp,
      ];
    }

    case 'RSV':
    case 'REL': {
      const next = name === 'RSV' ? (c.sp - c.word2) & WORD_MASK : (c.sp + c.word2) & WORD_MASK;
      return [{
        event: {
          phase: 'execute',
          title: execTitle(name === 'RSV' ? tr('Platz reservieren', 'reserve space') : tr('Platz freigeben', 'release space')),
          explanation: name === 'RSV'
            ? tr(`RSV reserviert ${c.word2} Zellen auf dem Stack: SP ${c.sp} − ${c.word2} = ${next}.`,
              `RSV reserves ${c.word2} cells on the stack: SP ${c.sp} − ${c.word2} = ${next}.`)
            : tr(`REL gibt ${c.word2} Zellen auf dem Stack frei: SP ${c.sp} + ${c.word2} = ${next}.`,
              `REL releases ${c.word2} cells on the stack: SP ${c.sp} + ${c.word2} = ${next}.`),
          bus: {},
          flows: [{ route: 'ir→sp', label: String(c.word2) }],
          active: ['ir', 'sp'],
        },
        apply(s) {
          s.sp = next;
        },
      }];
    }

    default:
      return null;
  }
}

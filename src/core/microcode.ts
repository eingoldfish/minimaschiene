/**
 * Micro steps: one instruction split into the phases of the instruction cycle
 * (Befehlszyklus): Holen – Dekodieren – Ausführen.
 *
 * planInstruction() looks at the machine state at the START of an instruction
 * and returns the list of micro steps. Each step carries
 *   - an event for the UI (phase, explanation, bus values, data flows) and
 *   - an apply() function that changes the state a little bit.
 * After the last step the state is exactly the same as after Cpu.step()
 * (checked by tests/microcode.test.ts).
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
import type { CpuState, CyclePhase, InstructionRegister } from './cpu';
import { disassemble } from './disassembler';
import { toSigned16, WORD_MASK } from './format';
import { decodeWord1, type AddressingMode } from './isa';

/** Parts of the machine that can light up in the picture. */
export type MachinePart = 'pc' | 'ir' | 'decoder' | 'acc' | 'alu' | 'flags' | 'memory';

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
  | 'acc→mem'; // accumulator → data bus → memory (STORE)

export interface Flow {
  route: FlowRoute;
  /** Text shown on the moving token, e.g. "532" or "LOAD". */
  label: string;
}

export interface MicroStepEvent {
  phase: CyclePhase;
  /** Short title, e.g. "Holen 1/2: Befehlswort". */
  title: string;
  /** Explanation in German with the concrete values. */
  explanation: string;
  /** Values on the buses during this step (undefined = bus not used). */
  bus: { address?: number; data?: number; control?: 'lesen' | 'schreiben' };
  /** ALU activity, if any. */
  alu?: { a: number; b: number; op: string; result: number };
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
}

export interface PlannedMicroStep {
  event: Omit<MicroStepEvent, 'index' | 'count' | 'done'>;
  apply(state: CpuState, env: MicroEnv): void;
}

const MODE_DE: Record<AddressingMode, string> = {
  none: 'ohne Adresse',
  direct: 'direkt',
  immediate: 'unmittelbar',
  indirect: 'indirekt',
  offset: 'relativ zum SP',
  offsetIndirect: 'indirekt relativ zum SP',
  immediateOffset: 'unmittelbar relativ zum SP',
};

const s16 = (v: number) => String(toSigned16(v));

function flagText(f: Flags): string {
  return `Z=${+f.z} N=${+f.n} V=${+f.v} C=${+f.c}`;
}

/** German description of what an ALU operation computes. */
function computeText(op: AluOp, a: number, b: number, result: number): string {
  switch (op) {
    case 'PASS':
      return `Der Wert ${s16(b)} wird in den Akku übernommen.`;
    case 'NOT':
      return `Das Rechenwerk kehrt alle Bits von ${s16(a)} um: Ergebnis ${s16(result)}.`;
    case 'DIVU':
    case 'MODU':
    case 'MULHU':
      return `Das Rechenwerk rechnet ohne Vorzeichen ${a} ${ALU_SYMBOLS[op]} ${b} = ${result}.`;
    case 'SHL':
    case 'SHR':
    case 'SHRA':
      return `Das Rechenwerk schiebt ${s16(a)} um ${b & 31} Stellen (${ALU_SYMBOLS[op]}): Ergebnis ${s16(result)}.`;
    default:
      return `Das Rechenwerk rechnet ${s16(a)} ${ALU_SYMBOLS[op]} ${s16(b)} = ${s16(result)}.`;
  }
}

/**
 * Plans all micro steps of the instruction at start.pc.
 * Memory must still be unchanged since the start of the instruction
 * (only the very last micro step of STORE writes).
 */
export function planInstruction(start: InstructionStart, memory: Uint16Array): PlannedMicroStep[] {
  const read = (address: number) => memory[address & WORD_MASK] ?? 0;
  const pc0 = start.pc;
  const pc1 = (pc0 + 1) & WORD_MASK;
  const pc2 = (pc0 + 2) & WORD_MASK;
  const word1 = read(pc0);
  const word2 = read(pc1);
  const decoded = decodeWord1(word1);
  const steps: PlannedMicroStep[] = [];

  // ----- Holen -----
  steps.push({
    event: {
      phase: 'fetch',
      title: 'Holen 1/2: Befehlswort',
      explanation: `Der Befehlszähler schickt die Adresse ${pc0} über den Adressbus zum Speicher (Steuerbus: lesen). `
        + `Der Speicher liefert den Inhalt ${word1} über den Datenbus ins Befehlsregister. Der Befehlszähler wird um 1 erhöht.`,
      bus: { address: pc0, data: word1, control: 'lesen' },
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
      title: 'Holen 2/2: Adressteil',
      explanation: `Der Befehlszähler schickt die Adresse ${pc1} über den Adressbus. `
        + `Der Adressteil ${word2} kommt über den Datenbus ins Befehlsregister. `
        + `Der Befehlszähler wird wieder um 1 erhöht und zeigt jetzt auf den nächsten Befehl (${pc2}).`,
      bus: { address: pc1, data: word2, control: 'lesen' },
      flows: [{ route: 'pc→mem', label: String(pc1) }, { route: 'mem→ir', label: String(word2) }],
      active: ['pc', 'memory', 'ir'],
    },
    apply(s) {
      s.ir.address = word2;
      s.pc = pc2;
    },
  });

  // ----- Dekodieren -----
  if (!decoded) {
    steps.push({
      event: {
        phase: 'decode',
        title: 'Dekodieren: unbekannter Befehl',
        explanation: `Das Steuerwerk kennt den Befehlscode ${word1} nicht. Die Maschine hält an; `
          + `der Befehlszähler wird wieder auf ${pc0} gestellt, damit man sieht, wo der Fehler liegt.`,
        bus: {},
        flows: [{ route: 'ir→decoder', label: String(word1) }],
        active: ['ir', 'decoder'],
      },
      apply(s) {
        s.pc = pc0;
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
      title: 'Dekodieren',
      explanation: `Das Steuerwerk erkennt den Befehl ${text} (${def.descriptionDe.replace(/\.$/, '')}). `
        + `Adressierungsart: ${MODE_DE[mode]}.`,
      bus: {},
      flows: [{ route: 'ir→decoder', label: def.immediateMnemonic && mode === 'immediate' ? def.immediateMnemonic : name }],
      active: ['ir', 'decoder'],
    },
    apply() {},
  });

  // ----- Ausführen -----

  // Indirect addressing: first look up the real address in memory.
  let address = word2;
  if (mode === 'indirect') {
    const target = read(word2);
    steps.push({
      event: {
        phase: 'execute',
        title: 'Ausführen: Adresse nachschlagen',
        explanation: `Indirekte Adressierung: In Zelle ${word2} steht erst die eigentliche Adresse. `
          + `Das Steuerwerk liest sie über den Datenbus: ${target}.`,
        bus: { address: word2, data: target, control: 'lesen' },
        flows: [{ route: 'addr→mem', label: String(word2) }, { route: 'mem→decoder', label: String(target) }],
        active: ['decoder', 'memory'],
      },
      apply() {},
    });
    address = target;
  }

  // Jumps
  const condition = JUMP_CONDITIONS[name];
  if (condition) {
    const jumps = condition(start.flags);
    const condText = def.descriptionDe.replace('Springt zur angegebenen Adresse, ', '').replace(/\.$/, '');
    steps.push({
      event: {
        phase: 'execute',
        title: jumps ? 'Ausführen: Sprung' : 'Ausführen: kein Sprung',
        explanation: name === 'JMP'
          ? `Unbedingter Sprung: Der Adressteil ${word2} wird in den Befehlszähler geladen.`
          : `${name} springt, ${condText}. Flags: ${flagText(start.flags)} → `
            + (jumps
              ? `Bedingung erfüllt, der Adressteil ${word2} wird in den Befehlszähler geladen.`
              : `Bedingung nicht erfüllt, es geht mit Adresse ${pc2} weiter.`),
        bus: {},
        flows: jumps ? [{ route: 'ir→pc', label: String(word2) }] : [],
        active: jumps ? ['flags', 'decoder', 'pc'] : ['flags', 'decoder'],
      },
      apply(s) {
        if (jumps) s.pc = word2;
      },
    });
    return steps;
  }

  // STORE
  if (name === 'STORE') {
    steps.push({
      event: {
        phase: 'execute',
        title: 'Ausführen: Schreiben',
        explanation: `Die Adresse ${address} kommt auf den Adressbus, der Steuerbus meldet „schreiben“. `
          + `Der Akku legt seinen Wert ${s16(start.a)} auf den Datenbus, der Speicher legt ihn in Zelle ${address} ab.`,
        bus: { address, data: start.a, control: 'schreiben' },
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
      NOOP: ['Ausführen: nichts tun', 'NOOP tut nichts. Es geht mit dem nächsten Befehl weiter.'],
      HALT: ['Ausführen: anhalten', 'HALT: Die Maschine hält an. Das Programm ist zu Ende.'],
      RESET: ['Ausführen: zurücksetzen', 'RESET: Akku, Befehlszähler, Befehlsregister und Flags werden 0, die Maschine hält an. Der Speicher bleibt erhalten.'],
    }[name];
    steps.push({
      event: { phase: 'execute', title: info[0]!, explanation: info[1]!, bus: {}, flows: [], active: ['decoder'] },
      apply(s) {
        if (name === 'HALT') {
          s.halted = 'halt';
        } else if (name === 'RESET') {
          s.a = 0;
          s.pc = 0;
          s.flags = { z: false, n: false, v: false, c: false };
          s.ir = { opcode: 0, mode: 'none', address: 0 };
          s.lastWrite = null;
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
        title: 'Ausführen: Carry laden',
        explanation: `Das Carry-Flag (${c}) wird in den Akku geladen. Neue Flags: ${flagText(res.flags)}.`,
        bus: {},
        flows: [{ route: 'flags→acc', label: String(c) }],
        active: ['flags', 'acc'],
      },
      apply(s) {
        s.a = res.result;
        s.flags = res.flags;
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
  if (mode === 'immediate') {
    b = word2;
    steps.push({
      event: {
        phase: 'execute',
        title: 'Ausführen: Operand aus dem Adressteil',
        explanation: `Unmittelbare Adressierung: Der Adressteil ${s16(word2)} ist selbst der Operand `
          + 'und geht direkt an das Rechenwerk – ein Speicherzugriff ist nicht nötig.',
        bus: {},
        flows: [{ route: 'ir→aluB', label: s16(word2) }],
        active: ['ir', 'alu'],
      },
      apply() {},
    });
  } else if (mode === 'direct' || mode === 'indirect') {
    b = read(address);
    steps.push({
      event: {
        phase: 'execute',
        title: 'Ausführen: Operand holen',
        explanation: `Die Adresse ${address} kommt auf den Adressbus (Steuerbus: lesen). `
          + `Der Speicher liefert den Wert ${s16(b)} über den Datenbus an das Rechenwerk.`,
        bus: { address, data: b, control: 'lesen' },
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
        title: 'Ausführen: Division durch 0!',
        explanation: `Das Rechenwerk soll durch 0 teilen – das geht nicht. Die Maschine hält an. `
          + `Akku und Flags bleiben unverändert, der Befehlszähler zeigt wieder auf den Befehl (${pc0}).`,
        bus: {},
        alu: { a: start.a, b, op: ALU_SYMBOLS[op], result: start.a },
        flows: [{ route: 'acc→aluA', label: s16(start.a) }],
        active: ['acc', 'alu'],
      },
      apply(s) {
        s.pc = pc0;
        s.halted = 'divisionByZero';
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
      title: isCompare ? 'Ausführen: Vergleichen' : op === 'PASS' ? 'Ausführen: Laden' : 'Ausführen: Rechnen',
      explanation: isCompare
        ? `Vergleich: Das Rechenwerk rechnet ${s16(start.a)} − ${s16(b)} = ${s16(res.result)}. `
          + `Das Ergebnis wird nicht gespeichert, nur die Flags: ${flagText(res.flags)}.`
        : `${computeText(op, start.a, b, res.result)} Das Ergebnis kommt in den Akku. Neue Flags: ${flagText(res.flags)}.`,
      bus: {},
      alu: { a: start.a, b, op: isCompare ? 'cmp' : ALU_SYMBOLS[op], result: res.result },
      flows,
      active: isCompare ? ['acc', 'alu', 'flags'] : usesAcc ? ['acc', 'alu', 'flags'] : ['alu', 'acc', 'flags'],
    },
    apply(s) {
      if (!isCompare) s.a = res.result;
      s.flags = res.flags;
    },
  });
  return steps;
}

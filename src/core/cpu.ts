/**
 * The CPU: registers, memory and instruction execution.
 *
 * Design rules:
 * - Deterministic state machine: same state + same call = same result.
 * - The complete state is a plain, serialisable data object (`CpuState`),
 *   so the UI can implement "step back" via snapshot()/restore().
 * - No DOM access here (enforced by src/core/tsconfig.json).
 *
 * Status (M1): standard instruction set via step(). Micro steps follow in M4,
 * stack instructions in M5.
 */

import { alu, type AluOp, type Flags } from './alu';
import { MEMORY_SIZE, toUnsigned16, WORD_MASK } from './format';
import { decodeWord1, type AddressingMode, type InstructionDef } from './isa';

export type { Flags } from './alu';

/** Instruction register: the instruction currently being executed. */
export interface InstructionRegister {
  /** Opcode (low byte of word 1). */
  opcode: number;
  /** Addressing mode, or null if word 1 is not a valid instruction. */
  mode: AddressingMode | null;
  /** Address part (word 2 of the instruction). */
  address: number;
}

/**
 * Why the CPU is not running (anymore).
 * - none: ready to execute the next instruction
 * - halt: HALT/HOLD was executed
 * - reset: the RESET instruction was executed
 * - illegalOpcode: word 1 at PC is not a valid instruction (PC stays there)
 * - divisionByZero: division by 0 (PC stays on the instruction, nothing changed)
 */
export type HaltReason = 'none' | 'halt' | 'reset' | 'illegalOpcode' | 'divisionByZero';

/** Complete machine state. All numbers are unsigned 16-bit values. */
export interface CpuState {
  /** Accumulator. */
  a: number;
  /** Program counter. */
  pc: number;
  /** Stack pointer (only meaningful in extended mode). */
  sp: number;
  ir: InstructionRegister;
  flags: Flags;
  memory: Uint16Array;
  halted: HaltReason;
  /** Address of the memory cell written most recently (by STORE or the user), or null. */
  lastWrite: number | null;
}

/** Phase of the instruction cycle (Befehlszyklus). */
export type CyclePhase = 'fetch' | 'decode' | 'execute';

/** One value travelling over a bus during a micro step. */
export interface BusTransfer {
  bus: 'data' | 'address' | 'control';
  value: number | 'read' | 'write';
}

/**
 * Result of a single micro step. The UI uses this to animate the data flow
 * and to show an explanation; the core knows nothing about SVG.
 */
export interface MicroStepEvent {
  phase: CyclePhase;
  transfers: BusTransfer[];
  /** Key of a German explanation text (texts live in the UI). */
  explanationKey: string;
}

/** Everything in CpuState except the memory. */
export type CpuRegisters = Omit<CpuState, 'memory'>;

/**
 * Information to undo one step ("Schritt zurück"): the registers before the
 * step plus the old values of all memory cells the step wrote.
 * Much smaller than a full snapshot (128 KB), so we can keep many of them.
 */
export interface UndoRecord {
  registers: CpuRegisters;
  /** [address, old value] in the order they were written. */
  writes: Array<[number, number]>;
}

/** Result of run(). 'limit' means the step limit was reached (endless loop?). */
export interface RunResult {
  reason: HaltReason | 'limit';
  steps: number;
}

const CLEARED_FLAGS: Readonly<Flags> = { z: false, n: false, v: false, c: false };

/** Creates the state of a freshly powered-on machine (all zero). */
export function createInitialState(): CpuState {
  return {
    a: 0,
    pc: 0,
    sp: 0, // TODO(M5): start value of SP is still open, see docs/kompatibilitaet.md
    ir: { opcode: 0, mode: 'none', address: 0 },
    flags: { ...CLEARED_FLAGS },
    memory: new Uint16Array(MEMORY_SIZE),
    halted: 'none',
    lastWrite: null,
  };
}

/** Jump conditions, evaluated on the current flags. */
const JUMP_CONDITIONS: Readonly<Record<string, (f: Flags) => boolean>> = {
  JMPP: (f) => !f.n && !f.z,
  JMPNN: (f) => !f.n,
  JMPN: (f) => f.n,
  JMPNP: (f) => f.n || f.z,
  JMPZ: (f) => f.z,
  JMPNZ: (f) => !f.z,
  JMP: () => true,
  JMPV: (f) => f.v,
  JMPC: (f) => f.c,
  JHI: (f) => !f.c && !f.z,
  JHS: (f) => !f.c,
  JLO: (f) => f.c,
  JLS: (f) => f.c || f.z,
};

/** Instructions that simply feed accumulator and operand into the ALU. */
const ALU_INSTRUCTIONS: Readonly<Record<string, AluOp>> = {
  ADD: 'ADD',
  SUB: 'SUB',
  MUL: 'MUL',
  DIV: 'DIV',
  MOD: 'MOD',
  DIVU: 'DIVU',
  MODU: 'MODU',
  MULH: 'MULH',
  MULHU: 'MULHU',
  AND: 'AND',
  OR: 'OR',
  XOR: 'XOR',
  NOT: 'NOT',
  SHL: 'SHL',
  SHR: 'SHR',
  SHRA: 'SHRA',
  LOAD: 'PASS',
};

export class Cpu {
  private state: CpuState = createInitialState();
  /** While a step is recorded for undo, memory writes are logged here. */
  private writeLog: Array<[number, number]> | null = null;

  /** Read-only view of the current state (UI must not mutate it). */
  getState(): Readonly<CpuState> {
    return this.state;
  }

  /**
   * "CPU zurücksetzen" (manual): PC = 0, A = 0, all flags cleared.
   * The memory is NOT changed.
   */
  reset(): void {
    const s = this.state;
    s.a = 0;
    s.pc = 0;
    s.flags = { ...CLEARED_FLAGS };
    s.ir = { opcode: 0, mode: 'none', address: 0 };
    s.halted = 'none';
    s.lastWrite = null;
  }

  /** Replaces the whole memory (used after assembling). */
  loadMemory(memory: Uint16Array): void {
    if (memory.length !== MEMORY_SIZE) {
      throw new RangeError(`memory must have ${MEMORY_SIZE} cells`);
    }
    this.state.memory = memory.slice();
  }

  /** Writes a single memory cell (used when the user edits memory). */
  writeMemory(address: number, value: number): void {
    const addr = toUnsigned16(address);
    this.state.memory[addr] = toUnsigned16(value);
    this.state.lastWrite = addr;
  }

  /**
   * Executes one complete instruction (fetch, decode, execute).
   * Does nothing if the CPU is halted.
   * @returns the halt reason after this step ('none' = can continue)
   */
  step(): HaltReason {
    const s = this.state;
    if (s.halted !== 'none') return s.halted;

    // ----- fetch -----
    const instructionAddress = s.pc;
    const word1 = this.read(instructionAddress);
    const word2 = this.read(instructionAddress + 1);

    // ----- decode -----
    const decoded = decodeWord1(word1);
    s.ir = { opcode: word1 & 0xff, mode: decoded?.mode ?? null, address: word2 };
    if (!decoded) {
      // TODO(compat): behaviour of the original on illegal codes not yet verified.
      s.halted = 'illegalOpcode';
      return s.halted;
    }
    s.pc = toUnsigned16(instructionAddress + 2);

    // ----- execute -----
    this.execute(decoded.def, decoded.mode, word2);
    // (read via this.state: TypeScript still thinks s.halted is 'none' from the check above)
    if (this.state.halted === 'divisionByZero') {
      // Leave PC on the faulty instruction so the student can inspect it.
      s.pc = instructionAddress;
    }
    return s.halted;
  }

  /**
   * Like step(), but also returns the information needed to undo it.
   */
  stepUndoable(): { reason: HaltReason; undo: UndoRecord } {
    const s = this.state;
    const undo: UndoRecord = {
      registers: {
        a: s.a,
        pc: s.pc,
        sp: s.sp,
        ir: { ...s.ir },
        flags: { ...s.flags },
        halted: s.halted,
        lastWrite: s.lastWrite,
      },
      writes: [],
    };
    this.writeLog = undo.writes;
    try {
      return { reason: this.step(), undo };
    } finally {
      this.writeLog = null;
    }
  }

  /** Reverts a step recorded with stepUndoable(). Undo records must be applied newest first. */
  undo(record: UndoRecord): void {
    for (let i = record.writes.length - 1; i >= 0; i--) {
      const [address, oldValue] = record.writes[i]!;
      this.state.memory[address] = oldValue;
    }
    const r = record.registers;
    this.state = {
      ...r,
      ir: { ...r.ir },
      flags: { ...r.flags },
      memory: this.state.memory,
    };
  }

  /**
   * Executes instructions until the CPU halts or `maxSteps` is reached.
   * (The UI's time-based "Abbruchschranke" will be built on top of step().)
   */
  run(maxSteps: number): RunResult {
    let steps = 0;
    while (this.state.halted === 'none') {
      if (steps >= maxSteps) return { reason: 'limit', steps };
      this.step();
      steps++;
    }
    return { reason: this.state.halted, steps };
  }

  /** Executes a single phase of the instruction cycle. TODO(M4). */
  microStep(): MicroStepEvent {
    throw new Error('Cpu.microStep() is not implemented yet (M4)');
  }

  /** Deep copy of the state, e.g. for "step back". */
  snapshot(): CpuState {
    return Cpu.copyState(this.state);
  }

  /** Restores a state previously obtained by snapshot(). */
  restore(snapshot: CpuState): void {
    this.state = Cpu.copyState(snapshot);
  }

  // ---------- internals ----------

  private static copyState(s: CpuState): CpuState {
    return {
      ...s,
      ir: { ...s.ir },
      flags: { ...s.flags },
      memory: s.memory.slice(),
    };
  }

  private read(address: number): number {
    // Index is always in range because of the 16-bit mask.
    return this.state.memory[address & WORD_MASK] ?? 0;
  }

  /** Value of the operand for the given addressing mode. */
  private operand(mode: AddressingMode, address: number): number {
    switch (mode) {
      case 'immediate':
        return address;
      case 'direct':
        return this.read(address);
      case 'indirect':
        return this.read(this.read(address));
      default:
        // 'none' and the SP modes (M5) never reach this point in M1.
        throw new Error(`addressing mode '${mode}' not supported yet`);
    }
  }

  /** Memory address an instruction writes to (STORE). */
  private effectiveAddress(mode: AddressingMode, address: number): number {
    switch (mode) {
      case 'direct':
        return address;
      case 'indirect':
        return this.read(address);
      default:
        throw new Error(`addressing mode '${mode}' not supported for writing`);
    }
  }

  private execute(def: InstructionDef, mode: AddressingMode, address: number): void {
    const s = this.state;
    const name = def.mnemonic;

    // Jumps: only change PC, flags stay as they are.
    const condition = JUMP_CONDITIONS[name];
    if (condition) {
      if (condition(s.flags)) s.pc = address;
      return;
    }

    // Instructions that go through the ALU and write the accumulator.
    const aluOp = ALU_INSTRUCTIONS[name];
    if (aluOp) {
      const b = mode === 'none' ? 0 : this.operand(mode, address);
      const res = alu(aluOp, s.a, b);
      if (!res) {
        s.halted = 'divisionByZero';
        return;
      }
      s.a = res.result;
      s.flags = res.flags;
      return;
    }

    switch (name) {
      case 'CMP': {
        // Like SUB, but the accumulator is not changed.
        const res = alu('SUB', s.a, this.operand(mode, address));
        if (res) s.flags = res.flags;
        return;
      }
      case 'LOADC': {
        const res = alu('PASS', s.a, s.flags.c ? 1 : 0);
        if (res) {
          s.a = res.result;
          s.flags = res.flags;
        }
        return;
      }
      case 'STORE': {
        const target = this.effectiveAddress(mode, address);
        this.writeLog?.push([target, s.memory[target] ?? 0]);
        s.memory[target] = s.a;
        s.lastWrite = target;
        return;
      }
      case 'NOOP':
        return;
      case 'HALT':
        s.halted = 'halt';
        return;
      case 'RESET':
        // Own decision (docs/kompatibilitaet.md, point 7): like the reset
        // button, but the machine halts. Memory is kept.
        this.reset();
        s.halted = 'reset';
        return;
      default:
        throw new Error(`instruction ${name} not implemented`);
    }
  }
}

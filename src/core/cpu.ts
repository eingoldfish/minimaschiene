/**
 * The CPU: registers, memory and instruction execution.
 *
 * Design rules:
 * - Deterministic state machine: same state + same call = same result.
 * - The complete state is a plain, serialisable data object (`CpuState`),
 *   so the UI can implement "step back" via snapshot()/restore() or undo records.
 * - No DOM access here (enforced by src/core/tsconfig.json).
 *
 * Two ways to execute:
 * - step():      one whole instruction at once (fast, used by "Ausführen").
 * - microStep(): one phase of the instruction cycle (see microcode.ts).
 * Both lead to exactly the same state after an instruction.
 */

import { alu, ALU_INSTRUCTIONS, JUMP_CONDITIONS, type Flags } from './alu';
import { MEMORY_SIZE, toUnsigned16, WORD_MASK } from './format';
import { decodeWord1, SP_START, type AddressingMode, type InstructionDef } from './isa';
import { planInstruction, type MicroContext, type MicroEnv, type MicroStepEvent } from './microcode';

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
  /** Set while an instruction is executed micro step by micro step, otherwise null. */
  micro: MicroContext | null;
}

/** Phase of the instruction cycle (Befehlszyklus). */
export type CyclePhase = 'fetch' | 'decode' | 'execute';

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
    sp: SP_START,
    ir: { opcode: 0, mode: 'none', address: 0 },
    flags: { ...CLEARED_FLAGS },
    memory: new Uint16Array(MEMORY_SIZE),
    halted: 'none',
    lastWrite: null,
    micro: null,
  };
}

/** Deep copy of all registers (without memory). */
function copyRegisters(s: CpuRegisters): CpuRegisters {
  return {
    a: s.a,
    pc: s.pc,
    sp: s.sp,
    ir: { ...s.ir },
    flags: { ...s.flags },
    halted: s.halted,
    lastWrite: s.lastWrite,
    micro: s.micro
      ? { index: s.micro.index, start: { ...s.micro.start, ir: { ...s.micro.start.ir }, flags: { ...s.micro.start.flags } } }
      : null,
  };
}

export class Cpu {
  private state: CpuState = createInitialState();
  /** While a step is recorded for undo, memory writes are logged here. */
  private writeLog: Array<[number, number]> | null = null;
  /** Memory access for micro steps (logs writes for undo). */
  private readonly env: MicroEnv = { write: (address, value) => this.write(address, value) };

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
    s.sp = SP_START;
    s.lastWrite = null;
    s.micro = null;
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
   * If an instruction was started with microStep(), it is finished.
   * Does nothing if the CPU is halted.
   * @returns the halt reason after this step ('none' = can continue)
   */
  step(): HaltReason {
    const s = this.state;
    if (s.halted !== 'none') return s.halted;
    if (s.micro) {
      while (this.state.micro) this.microStep();
      return this.state.halted;
    }

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
   * Executes ONE micro step (one part of Holen – Dekodieren – Ausführen).
   * @returns what happened, or null if the CPU is halted
   */
  microStep(): MicroStepEvent | null {
    const s = this.state;
    if (s.halted !== 'none') return null;
    if (!s.micro) {
      // Remember the registers at the start of the instruction; the plan is derived from them.
      const r = copyRegisters(s);
      s.micro = {
        start: { a: r.a, pc: r.pc, sp: r.sp, ir: r.ir, flags: r.flags, halted: r.halted, lastWrite: r.lastWrite },
        index: 0,
      };
    }
    const context = s.micro;
    const plan = planInstruction(context.start, s.memory);
    const index = context.index;
    const planned = plan[index];
    if (!planned) throw new Error('micro step index out of range');
    planned.apply(s, this.env);
    const done = index + 1 >= plan.length;
    if (done) s.micro = null;
    else context.index = index + 1;
    return { ...planned.event, index, count: plan.length, done };
  }

  /** Like step(), but also returns the information needed to undo it. */
  stepUndoable(): { reason: HaltReason; undo: UndoRecord } {
    const { result, undo } = this.recordUndo(() => this.step());
    return { reason: result, undo };
  }

  /** Like microStep(), but also returns the information needed to undo it. */
  microStepUndoable(): { event: MicroStepEvent | null; undo: UndoRecord } {
    const { result, undo } = this.recordUndo(() => this.microStep());
    return { event: result, undo };
  }

  /** Reverts a step recorded with stepUndoable()/microStepUndoable(). Apply newest first. */
  undo(record: UndoRecord): void {
    for (let i = record.writes.length - 1; i >= 0; i--) {
      const [address, oldValue] = record.writes[i]!;
      this.state.memory[address] = oldValue;
    }
    this.state = { ...copyRegisters(record.registers), memory: this.state.memory };
  }

  /**
   * Executes instructions until the CPU halts or `maxSteps` is reached.
   * (The UI's time-based "Abbruchschranke" is built on top of step().)
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
    return { ...copyRegisters(s), memory: s.memory.slice() };
  }

  private recordUndo<T>(action: () => T): { result: T; undo: UndoRecord } {
    const undo: UndoRecord = { registers: copyRegisters(this.state), writes: [] };
    this.writeLog = undo.writes;
    try {
      return { result: action(), undo };
    } finally {
      this.writeLog = null;
    }
  }

  private read(address: number): number {
    // Index is always in range because of the 16-bit mask.
    return this.state.memory[address & WORD_MASK] ?? 0;
  }

  /** Writes memory as part of an instruction (logged for undo). */
  private write(address: number, value: number): void {
    const addr = address & WORD_MASK;
    this.writeLog?.push([addr, this.state.memory[addr] ?? 0]);
    this.state.memory[addr] = value;
    this.state.lastWrite = addr;
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
      case 'offset':
        return this.read(address + this.state.sp);
      case 'offsetIndirect':
        return this.read(this.read(address + this.state.sp));
      case 'immediateOffset':
        return (address + this.state.sp) & WORD_MASK;
      case 'none':
        throw new Error('instruction without address has no operand');
    }
  }

  /** Memory address an instruction writes to (STORE). */
  private effectiveAddress(mode: AddressingMode, address: number): number {
    switch (mode) {
      case 'direct':
        return address;
      case 'indirect':
        return this.read(address);
      case 'offset':
        return (address + this.state.sp) & WORD_MASK;
      case 'offsetIndirect':
        return this.read(address + this.state.sp);
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
      case 'STORE':
        this.write(this.effectiveAddress(mode, address), s.a);
        return;
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

      // ----- extended mode: stack (grows downwards, SP points to the top element) -----
      case 'JSR':
        s.sp = (s.sp - 1) & WORD_MASK;
        this.write(s.sp, s.pc); // PC already points to the next instruction
        s.pc = address;
        return;
      case 'RTS':
        s.pc = this.read(s.sp);
        s.sp = (s.sp + 1) & WORD_MASK;
        return;
      case 'PUSH':
        s.sp = (s.sp - 1) & WORD_MASK;
        this.write(s.sp, s.a);
        return;
      case 'POP': {
        const res = alu('PASS', s.a, this.read(s.sp))!;
        s.a = res.result;
        s.flags = res.flags;
        s.sp = (s.sp + 1) & WORD_MASK;
        return;
      }
      case 'RSV':
        s.sp = (s.sp - address) & WORD_MASK;
        return;
      case 'REL':
        s.sp = (s.sp + address) & WORD_MASK;
        return;
      default:
        throw new Error(`instruction ${name} not implemented`);
    }
  }
}

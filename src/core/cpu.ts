/**
 * The CPU: registers, memory and instruction execution.
 *
 * Design rules:
 * - Deterministic state machine: same state + same call = same result.
 * - The complete state is a plain, serialisable data object (`CpuState`),
 *   so the UI can implement "step back" via snapshot()/restore().
 * - No DOM access here (enforced by src/core/tsconfig.json).
 *
 * Status (M0): state + reset() are implemented; execution follows in M1/M4.
 */

import type { AddressingMode } from './isa';
import { MEMORY_SIZE } from './format';

/** Status flags (manual: Z = zero, N = negative, V = signed overflow, C = unsigned overflow). */
export interface Flags {
  z: boolean;
  n: boolean;
  v: boolean;
  c: boolean;
}

/** Instruction register: the decoded instruction currently being executed. */
export interface InstructionRegister {
  opcode: number;
  mode: AddressingMode;
  /** Address part (word 2 of the instruction). */
  address: number;
}

/** Why the CPU is not running (anymore). */
export type HaltReason = 'none' | 'halt' | 'illegalOpcode';

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

/** Creates the state of a freshly powered-on machine (all zero). */
export function createInitialState(): CpuState {
  return {
    a: 0,
    pc: 0,
    sp: 0, // TODO(M5): start value of SP is still open, see docs/kompatibilitaet.md
    ir: { opcode: 0, mode: 'direct', address: 0 },
    flags: { z: false, n: false, v: false, c: false },
    memory: new Uint16Array(MEMORY_SIZE),
    halted: 'none',
  };
}

export class Cpu {
  private state: CpuState = createInitialState();

  /** Read-only view of the current state (UI must not mutate it). */
  getState(): Readonly<CpuState> {
    return this.state;
  }

  /**
   * "CPU zurücksetzen" (manual): PC = 0, A = 0, all flags cleared.
   * The memory is NOT changed.
   */
  reset(): void {
    this.state.a = 0;
    this.state.pc = 0;
    this.state.flags = { z: false, n: false, v: false, c: false };
    this.state.ir = { opcode: 0, mode: 'direct', address: 0 };
    this.state.halted = 'none';
  }

  /** Replaces the whole memory (used after assembling). */
  loadMemory(memory: Uint16Array): void {
    if (memory.length !== MEMORY_SIZE) {
      throw new RangeError(`memory must have ${MEMORY_SIZE} cells`);
    }
    this.state.memory = memory.slice();
  }

  /** Executes one complete instruction (fetch, decode, execute). TODO(M1). */
  step(): void {
    throw new Error('Cpu.step() is not implemented yet (M1)');
  }

  /** Executes a single phase of the instruction cycle. TODO(M4). */
  microStep(): MicroStepEvent {
    throw new Error('Cpu.microStep() is not implemented yet (M4)');
  }

  /** Deep copy of the state, e.g. for "step back". */
  snapshot(): CpuState {
    return {
      ...this.state,
      ir: { ...this.state.ir },
      flags: { ...this.state.flags },
      memory: this.state.memory.slice(),
    };
  }

  /** Restores a state previously obtained by snapshot(). */
  restore(snapshot: CpuState): void {
    this.state = {
      ...snapshot,
      ir: { ...snapshot.ir },
      flags: { ...snapshot.flags },
      memory: snapshot.memory.slice(),
    };
  }
}

/**
 * Session: the app logic between the user interface and the core.
 *
 * Holds the CPU, the last assembled program, the undo history and the
 * breakpoints, and decides when a program run has to stop.
 *
 * Deliberately WITHOUT any DOM access, so it can be tested with Vitest
 * like the core. The views only call methods here and redraw afterwards.
 */
import {
  assemble,
  type Language,
  Cpu,
  type AssembleResult,
  type CpuState,
  type HaltReason,
  type MicroStepEvent,
  type UndoRecord,
} from '../core';

/** Why a run slice ended. */
export type StopReason =
  | HaltReason // 'none' = slice budget used up, the run may continue
  | 'breakpoint';

/** How many steps "Schritt zurück" can go back at most. */
export const MAX_HISTORY = 100_000;

export class Session {
  readonly cpu = new Cpu();
  /** Language of assembler messages and micro step explanations. */
  language: Language = 'de';
  /** Last successfully assembled program (null before the first one). */
  program: AssembleResult | null = null;
  private history: UndoRecord[] = [];
  /** Source lines with a breakpoint (1-based). */
  private breakpointLines = new Set<number>();
  /** Addresses derived from breakpointLines and the current program. */
  private breakpointAddresses = new Set<number>();

  setLanguage(lang: Language): void {
    this.language = lang;
    this.cpu.language = lang;
  }

  get state(): Readonly<CpuState> {
    return this.cpu.getState();
  }

  /**
   * Assembles the source. On success the result is loaded into the CPU,
   * the CPU is reset and the history is cleared. On errors nothing changes.
   */
  assemble(source: string, options: { keepMemory?: boolean; extended?: boolean } = {}): AssembleResult {
    const result = assemble(source, {
      extended: options.extended,
      lang: this.language,
      keepMemory: options.keepMemory ? this.state.memory : undefined,
    });
    if (result.ok) {
      this.program = result;
      this.cpu.loadMemory(result.memory);
      this.cpu.reset();
      this.history = [];
      this.updateBreakpointAddresses();
    }
    return result;
  }

  /** Executes one instruction (undoable). */
  step(): HaltReason {
    if (this.state.halted !== 'none') return this.state.halted;
    const { reason, undo } = this.cpu.stepUndoable();
    this.pushHistory(undo);
    return reason;
  }

  private pushHistory(undo: UndoRecord): void {
    this.history.push(undo);
    if (this.history.length > MAX_HISTORY) {
      // Drop the oldest quarter at once (cheaper than shifting every step).
      this.history.splice(0, MAX_HISTORY / 4);
    }
  }

  /** Executes one micro step (undoable). Returns null if the machine is halted. */
  microStep(): MicroStepEvent | null {
    if (this.state.halted !== 'none') return null;
    const { event, undo } = this.cpu.microStepUndoable();
    this.pushHistory(undo);
    return event;
  }

  /** Goes back one instruction or micro step. Returns false if there is nothing to undo. */
  stepBack(): boolean {
    const record = this.history.pop();
    if (!record) return false;
    this.cpu.undo(record);
    return true;
  }

  get canStepBack(): boolean {
    return this.history.length > 0;
  }

  /** "Zurücksetzen": PC = 0, A = 0, flags cleared, memory kept. */
  reset(): void {
    this.cpu.reset();
    this.history = [];
  }

  /** The user edits a memory cell. Clears the history (it would no longer fit). */
  writeMemory(address: number, value: number): void {
    this.cpu.writeMemory(address, value);
    this.history = [];
  }

  /**
   * Executes up to `maxSteps` instructions as one part of a program run.
   * Stops early on HALT, errors and breakpoints.
   * @param isFirstSlice true for the first slice of a run: a breakpoint on
   *        the very first instruction is ignored, otherwise "Ausführen"
   *        could never leave a breakpoint.
   */
  runSlice(maxSteps: number, isFirstSlice: boolean): { reason: StopReason; steps: number } {
    let steps = 0;
    while (steps < maxSteps) {
      const atStart = isFirstSlice && steps === 0;
      if (!atStart && this.breakpointAddresses.has(this.state.pc)) {
        return { reason: 'breakpoint', steps };
      }
      const reason = this.step();
      steps++;
      if (reason !== 'none') return { reason, steps };
    }
    return { reason: 'none', steps };
  }

  /** Sets the lines that carry a breakpoint marker in the editor. */
  setBreakpointLines(lines: Iterable<number>): void {
    this.breakpointLines = new Set(lines);
    this.updateBreakpointAddresses();
  }

  /**
   * Source line of the instruction the PC points to, if the program is
   * known and the PC is inside it.
   */
  get currentLine(): number | undefined {
    return this.program?.addressToLine.get(this.instructionAddress);
  }

  /**
   * Address of the instruction that is being executed: during micro steps
   * the PC already moves on while fetching, so use the start address.
   */
  get instructionAddress(): number {
    return this.state.micro ? this.state.micro.start.pc : this.state.pc;
  }

  /** Label name for an address (first match), for the memory view. */
  labelAt(address: number): string | undefined {
    if (!this.program) return undefined;
    for (const [name, addr] of this.program.labels) {
      if (addr === address) return name;
    }
    return undefined;
  }

  /**
   * A breakpoint on a line without an instruction (empty line, comment,
   * label only) applies to the next instruction below it.
   */
  private updateBreakpointAddresses(): void {
    this.breakpointAddresses.clear();
    const program = this.program;
    if (!program) return;
    const instructionLines = [...program.lineToAddress.keys()].sort((a, b) => a - b);
    for (const line of this.breakpointLines) {
      const target = instructionLines.find((l) => l >= line);
      if (target !== undefined) this.breakpointAddresses.add(program.lineToAddress.get(target)!);
    }
  }
}

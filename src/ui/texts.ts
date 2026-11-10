/**
 * German texts of the user interface that depend on machine state.
 */
import type { AddressingMode, HaltReason } from '../core';

export const MODE_NAMES: Record<AddressingMode, string> = {
  none: 'ohne Adresse',
  direct: 'direkt',
  immediate: 'unmittelbar (immediate)',
  indirect: 'indirekt',
  offset: 'relativ zum SP',
  offsetIndirect: 'indirekt relativ zum SP',
  immediateOffset: 'unmittelbar relativ zum SP',
};

/** Short status of the machine, shown next to the registers. */
export const HALT_STATUS: Record<HaltReason, string> = {
  none: 'bereit',
  halt: 'angehalten (HALT)',
  reset: 'angehalten (RESET)',
  illegalOpcode: 'angehalten (ungültiger Befehl)',
  divisionByZero: 'angehalten (Division durch 0)',
};

export const FLAG_HELP: Record<'z' | 'n' | 'v' | 'c', string> = {
  z: 'Z (Zero): Das letzte Ergebnis war 0.',
  n: 'N (Negativ): Das letzte Ergebnis war negativ (Bit 15 gesetzt).',
  v: 'V (Overflow): Überlauf beim Rechnen mit Vorzeichen.',
  c: 'C (Carry): Überlauf beim Rechnen ohne Vorzeichen bzw. „Borgen“ beim Subtrahieren.',
};

export const KEYS = {
  assemble: 'F9',
  assembleKeep: 'Umschalt+F9',
  step: 'F10',
  stepBack: 'Umschalt+F10',
  microStep: 'F11',
  run: 'F5',
} as const;

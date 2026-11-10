/**
 * Arithmetic logic unit (ALU): pure functions, no state.
 *
 * Every operation takes the accumulator value `a` and the operand `b`
 * (both unsigned 16-bit) and returns the new accumulator value plus the
 * new flags. All flag rules were determined on the original; see
 * docs/kompatibilitaet.md, section "Flags der Rechen-, Logik- und Schiebebefehle".
 *
 * Keeping the ALU separate from the CPU makes it easy to test and lets the
 * micro-step animation (M4) show "operand 1, operation, operand 2, result".
 */
import { toSigned16, toUnsigned16, WORD_MASK } from './format';

/** Status flags: Z = zero, N = negative, V = signed overflow, C = unsigned overflow. */
export interface Flags {
  z: boolean;
  n: boolean;
  v: boolean;
  c: boolean;
}

/** Operations the ALU can perform. PASS just passes `b` through (used by LOAD). */
export type AluOp =
  | 'PASS'
  | 'ADD'
  | 'SUB'
  | 'MUL'
  | 'DIV'
  | 'MOD'
  | 'DIVU'
  | 'MODU'
  | 'MULH'
  | 'MULHU'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'NOT'
  | 'SHL'
  | 'SHR'
  | 'SHRA';

export interface AluResult {
  /** New accumulator value (unsigned 16-bit). */
  result: number;
  flags: Flags;
}

/** Result of an operation that only sets Z and N; V and C are cleared. */
function zn(value: number): AluResult {
  const result = toUnsigned16(value);
  return {
    result,
    flags: { z: result === 0, n: (result & 0x8000) !== 0, v: false, c: false },
  };
}

/** Result of an unsigned operation: Z by result, N, V and C cleared. */
function unsignedResult(value: number): AluResult {
  const result = toUnsigned16(value);
  return { result, flags: { z: result === 0, n: false, v: false, c: false } };
}

/**
 * Executes one ALU operation.
 * @param a accumulator (unsigned 16-bit)
 * @param b operand (unsigned 16-bit); ignored by NOT
 * @returns the result, or `null` for a division by zero
 */
export function alu(op: AluOp, a: number, b: number): AluResult | null {
  switch (op) {
    case 'PASS':
      return zn(b);

    case 'ADD': {
      const sum = a + b;
      const result = sum & WORD_MASK;
      return {
        result,
        flags: {
          z: result === 0,
          n: (result & 0x8000) !== 0,
          // Signed overflow: both operands have the same sign, the result a different one.
          v: ((a ^ result) & (b ^ result) & 0x8000) !== 0,
          c: sum > WORD_MASK,
        },
      };
    }

    case 'SUB': {
      const result = (a - b) & WORD_MASK;
      return {
        result,
        flags: {
          z: result === 0,
          n: (result & 0x8000) !== 0,
          // Signed overflow: operands have different signs and the result's sign differs from a.
          v: ((a ^ b) & (a ^ result) & 0x8000) !== 0,
          // Borrow: C = 1 exactly when a < b (unsigned).
          c: a < b,
        },
      };
    }

    case 'MUL': {
      const signedProduct = toSigned16(a) * toSigned16(b);
      const result = toUnsigned16(signedProduct);
      return {
        result,
        flags: {
          z: result === 0,
          n: (result & 0x8000) !== 0,
          v: signedProduct < -0x8000 || signedProduct > 0x7fff,
          c: a * b > WORD_MASK,
        },
      };
    }

    case 'MULH':
      // Signed product / 65536, rounded towards 0 (NOT the true high word).
      return zn(Math.trunc((toSigned16(a) * toSigned16(b)) / 0x10000));

    case 'MULHU':
      return unsignedResult(Math.floor((a * b) / 0x10000));

    case 'DIV':
      if (b === 0) return null;
      // Like Java: quotient rounded towards 0. -32768 / -1 wraps to -32768.
      return zn(Math.trunc(toSigned16(a) / toSigned16(b)));

    case 'MOD':
      if (b === 0) return null;
      // Like Java: the remainder has the sign of the dividend.
      return zn(toSigned16(a) % toSigned16(b));

    case 'DIVU':
      if (b === 0) return null;
      return unsignedResult(Math.floor(a / b));

    case 'MODU':
      if (b === 0) return null;
      return unsignedResult(a % b);

    case 'AND':
      return zn(a & b);
    case 'OR':
      return zn(a | b);
    case 'XOR':
      return zn(a ^ b);
    case 'NOT':
      return zn(~a);

    case 'SHL': {
      // Shift count modulo 32, computed on 32 bits (like the original).
      const shifted32 = a << (b & 31);
      const res = zn(shifted32);
      // C = bit 16 of the 32-bit result = the last bit shifted out of the word.
      res.flags.c = ((shifted32 >>> 16) & 1) === 1;
      return res;
    }

    case 'SHR':
      return zn(a >>> (b & 31));

    case 'SHRA':
      return zn(toSigned16(a) >> (b & 31));
  }
}

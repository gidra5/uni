export type UInt16 = number;
export type Address = UInt16;

export const INITIAL_ADDR = 0x3000 as const;
export const SIGN_BIT = 1 << 15;
export const STATUS_BIT = 1 << 15;
export const MEMORY_SIZE = 1 << 16;
export const R_COUNT = 10 as const;

export enum Flag {
  POS = 1 << 0,
  ZERO = 1 << 1,
  NEG = 1 << 2,
}

export enum Register {
  R_R0,
  R_R1,
  R_R2,
  R_R3,
  R_R4,
  R_R5,
  R_R6,
  R_R7,
  R_PC /* program counter */,
  R_COND,
}

export function signExtend(x: number, bitCount: number) {
  const sign = 1 << (bitCount - 1);
  x &= (1 << bitCount) - 1;
  return (x ^ sign) - sign;
}

export function putBuf(data: number[]) {
  process.stdout.write(Buffer.from(data).toString("utf8"));
}

export function swap16(val: number): number {
  return (val << 8) | (val >> 8);
}

export function signFlag(val: UInt16): Flag {
  /* a 1 in the left-most bit indicates negative */
  if (val === 0) return Flag.ZERO;
  else if (val & SIGN_BIT) return Flag.NEG;
  else return Flag.POS;
}

export function toHex(val: number) {
  return "0x" + val.toString(16).padStart(4, "0");
}

export function toBin(val: number, size = 16) {
  return "0b" + val.toString(2).padStart(size, "0");
}

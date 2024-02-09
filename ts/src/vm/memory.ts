export const MEMORY_SIZE = 1 << 16;
export const R_COUNT = 10;

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

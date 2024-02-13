import { OpCode, TrapCode } from "./handlers";
import { Address, Register } from "./utils";

/* expect all numbers to be properly trimmed */

export const opCode = (op: OpCode, params: number) => (op << 12) | params;

export const addParamsReg = (destReg: Register, srcReg1: Register, srcReg2: Register) =>
  (destReg << 9) | (srcReg1 << 6) | srcReg2;
export const addParamsImm = (destReg: Register, srcReg: Register, value: number) =>
  (destReg << 9) | (srcReg << 6) | (1 << 5) | value;

export const andParamsReg = (destReg: Register, srcReg1: Register, srcReg2: Register) =>
  (destReg << 9) | (srcReg1 << 6) | srcReg2;
export const andParamsImm = (destReg: Register, srcReg: Register, value: number) =>
  (destReg << 9) | (srcReg << 6) | (1 << 5) | value;

export const notParams = (destReg: Register, srcReg: Register) => (destReg << 9) | (srcReg << 6);

export const branchParams = (condMask: number, offset: Address) => (condMask << 9) | offset;
export const jmpParams = (addrReg: Register) => addrReg << 6;
export const jsrParamsLong = (addr: Address) => (1 << 11) | addr;
export const jsrParamsReg = (addrReg: Register) => addrReg << 6;

export const leaParams = (destReg: Register, offset: Address) => (destReg << 9) | offset;
export const loadParams = (destReg: Register, offset: Address) => (destReg << 9) | offset;
export const loadIndirectParams = (destReg: Register, offset: Address) => (destReg << 9) | offset;
export const loadRegParams = (destReg: Register, srcReg: Register, offset: Address) =>
  (destReg << 9) | (srcReg << 6) | offset;

export const storeParams = (srcReg: Register, offset: Address) => (srcReg << 9) | offset;
export const storeIndirectParams = (srcReg: Register, offset: Address) => (srcReg << 9) | offset;
export const storeRegParams = (srcReg: Register, destReg: Register, offset: Address) =>
  (srcReg << 9) | (destReg << 6) | offset;

export const trapParams = (trapVector: TrapCode) => trapVector;

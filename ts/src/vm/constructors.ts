import { OpCode, TrapCode } from "./handlers";
import { Address, Register } from "./utils";

export const opCode = (op: OpCode, params: number) => (op << 12) | (params & 0x0fff);

export const addOpReg = (destReg: Register, srcReg1: Register, srcReg2: Register) =>
  opCode(OpCode.OP_ADD, (destReg << 9) | (srcReg1 << 6) | srcReg2);
export const addOpImm = (destReg: Register, srcReg: Register, value: number) =>
  opCode(OpCode.OP_ADD, (destReg << 9) | (srcReg << 6) | (1 << 5) | (value & 0b11111));

export const andOpReg = (destReg: Register, srcReg1: Register, srcReg2: Register) =>
  opCode(OpCode.OP_AND, (destReg << 9) | (srcReg1 << 6) | srcReg2);
export const andOpImm = (destReg: Register, srcReg: Register, value: number) =>
  opCode(OpCode.OP_AND, (destReg << 9) | (srcReg << 6) | (1 << 5) | (value & 0b11111));

export const notOp = (destReg: Register, srcReg: Register) => opCode(OpCode.OP_NOT, (destReg << 9) | (srcReg << 6));

export const branchOp = (condMask: number, offset: Address) => opCode(OpCode.OP_BR, (condMask << 9) | (offset & 0x1ff));
export const jmpOp = (addrReg: Register) => opCode(OpCode.OP_JMP, addrReg << 6);
export const jsrOpLong = (addr: Address) => opCode(OpCode.OP_JSR, (1 << 11) | (addr & 0x7ff));
export const jsrOpReg = (addrReg: Register) => opCode(OpCode.OP_JSR, addrReg << 6);

export const leaOp = (destReg: Register, offset: Address) => opCode(OpCode.OP_LEA, (destReg << 9) | (offset & 0x1ff));
export const loadOp = (destReg: Register, offset: Address) => opCode(OpCode.OP_LD, (destReg << 9) | (offset & 0x1ff));
export const loadIndirectOp = (destReg: Register, offset: Address) =>
  opCode(OpCode.OP_LDI, (destReg << 9) | (offset & 0x1ff));
export const loadRegOp = (destReg: Register, srcReg: Register, offset: Address) =>
  opCode(OpCode.OP_LDR, (destReg << 9) | (srcReg << 6) | (offset & 0x3f));

export const storeOp = (srcReg: Register, offset: Address) => opCode(OpCode.OP_ST, (srcReg << 9) | (offset & 0x1ff));
export const storeIndirectOp = (srcReg: Register, offset: Address) =>
  opCode(OpCode.OP_STI, (srcReg << 9) | (offset & 0x1ff));
export const storeRegOp = (srcReg: Register, destReg: Register, offset: Address) =>
  opCode(OpCode.OP_STR, (srcReg << 9) | (destReg << 6) | (offset & 0x3f));

export const trapOp = (trapVector: TrapCode) => opCode(OpCode.OP_TRAP, trapVector);

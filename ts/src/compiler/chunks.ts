import { OpCode } from "../vm/handlers.js";
import { Address, Register } from "../vm/utils.js";
import {
  addParamsImm,
  addParamsReg,
  andParamsImm,
  andParamsReg,
  branchParams,
  jmpParams,
  jsrParamsLong,
  jsrParamsReg,
  leaParams,
  loadIndirectParams,
  loadParams,
  loadRegParams,
  notParams,
  opCode,
  storeIndirectParams,
  storeParams,
  storeRegParams,
} from "../vm/constructors.js";

export type CodeChunk = {
  opcode: OpCode;
  dataOffset?: Address;
  stackOffset?: Address;
  addressOffset?: Address;
  value: number;
  reg1: Register;
  reg2: Register;
  reg3: Register;
};

export const chunk = (opcode: OpCode, chunk: Partial<Omit<CodeChunk, "opcode">> = {}): CodeChunk => ({
  value: 0,
  reg1: 0,
  reg2: 0,
  reg3: 0,
  ...chunk,
  opcode,
});

export const chunkToByteCode =
  (dataStart: Address, stackStart: Address) =>
  (chunk: CodeChunk, pc: number): number => {
    pc = pc + 1;
    const { opcode, dataOffset, stackOffset, addressOffset, value: _value } = chunk;
    const dataAddr = dataOffset !== undefined ? dataStart - pc + dataOffset : undefined;
    const stackAddr = stackOffset !== undefined ? stackStart - pc + stackOffset : undefined;
    const offset = addressOffset !== undefined ? addressOffset - pc : 0;
    const value = dataAddr ?? stackAddr ?? _value;

    switch (opcode) {
      case OpCode.OP_ADD: {
        const { reg1, reg2, reg3 } = chunk;
        const absValue = Math.abs(value);
        const trimmedValue = absValue & 0x1f;
        const imm = trimmedValue === absValue;
        const params = imm ? addParamsImm(reg1, reg2, value) : addParamsReg(reg1, reg2, reg3);
        return opCode(opcode, params);
      }
      case OpCode.OP_AND: {
        const { reg1, reg2, reg3 } = chunk;
        const absValue = Math.abs(value);
        const trimmedValue = absValue & 0x1f;
        const imm = trimmedValue === absValue;
        const params = imm ? andParamsImm(reg1, reg2, value) : andParamsReg(reg1, reg2, reg3);
        return opCode(opcode, params);
      }
      case OpCode.OP_NOT: {
        const { reg1, reg2 } = chunk;
        return opCode(opcode, notParams(reg1, reg2));
      }
      case OpCode.OP_LD: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = loadParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.OP_LDI: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = loadIndirectParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.OP_LDR: {
        const { reg1, reg2 } = chunk;
        const trimmedValue = value & 0x3f;
        const params = loadRegParams(reg1, reg2, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.OP_ST: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = storeParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.OP_STI: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = storeIndirectParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.OP_STR: {
        const { reg1, reg2 } = chunk;
        const trimmedValue = value & 0x3f;
        const params = storeRegParams(reg1, reg2, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.OP_JSR: {
        const { reg1 } = chunk;
        if (value !== undefined) {
          const trimmedValue = value & 0x7ff;
          const params = jsrParamsLong(trimmedValue);
          return opCode(opcode, params);
        }
        const params = jsrParamsReg(reg1);
        return opCode(opcode, params);
      }
      case OpCode.OP_JMP: {
        const { reg1 } = chunk;
        const params = jmpParams(reg1);
        return opCode(opcode, params);
      }
      case OpCode.OP_LEA: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = leaParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.OP_TRAP: {
        const trimmedValue = value & 0xff;
        return opCode(opcode, trimmedValue);
      }
      case OpCode.OP_BR: {
        const mask = value & 0b111;
        const params = branchParams(mask, offset);
        return opCode(opcode, params);
      }
      default: {
        return opCode(opcode, 0);
      }
    }
  };

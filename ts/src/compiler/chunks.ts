import { OpCode } from "../vm/handlers.js";
import { Address, Register, signExtend } from "../vm/utils.js";
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
  functionOffset?: Address;
  addressOffset?: Address;
  value: number;
  reg1: Register;
  reg2: Register;
  reg3: Register;
};

export const chunk = (opcode: OpCode, chunk: Partial<Omit<CodeChunk, "opcode">> = {}): CodeChunk => ({
  value: 1 << 16,
  reg1: 0,
  reg2: 0,
  reg3: 0,
  ...chunk,
  opcode,
});

export const chunkToByteCode =
  (functionOffsets: Address[], dataOffsets: Address[]) =>
  (chunk: CodeChunk, pc: number): number => {
    pc = pc + 1;
    const { opcode, functionOffset, dataOffset, stackOffset, addressOffset, value: _value } = chunk;
    const functionAddr = functionOffset !== undefined ? functionOffsets[functionOffset] - pc : undefined;
    const dataAddr = dataOffset !== undefined ? dataOffsets[dataOffset] - pc : undefined;
    const offset = addressOffset !== undefined ? addressOffset - pc : 0;
    const value = functionAddr ?? dataAddr ?? _value;

    switch (opcode) {
      case OpCode.ADD: {
        const { reg1, reg2, reg3 } = chunk;
        const trimmedValue = value & 0x1f;

        const imm = value !== undefined && signExtend(trimmedValue, 5) === value;
        const params = imm ? addParamsImm(reg1, reg2, trimmedValue) : addParamsReg(reg1, reg2, reg3);
        return opCode(opcode, params);
      }
      case OpCode.AND: {
        const { reg1, reg2, reg3 } = chunk;
        const trimmedValue = value & 0x1f;
        const imm = value !== undefined && signExtend(trimmedValue, 5) === value;
        const params = imm ? andParamsImm(reg1, reg2, trimmedValue) : andParamsReg(reg1, reg2, reg3);
        return opCode(opcode, params);
      }
      case OpCode.NOT: {
        const { reg1, reg2 } = chunk;
        return opCode(opcode, notParams(reg1, reg2));
      }
      case OpCode.LD: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = loadParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.LOAD_INDIRECT: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = loadIndirectParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.LOAD_REG: {
        const { reg1, reg2 } = chunk;
        const trimmedValue = value & 0x3f;
        const params = loadRegParams(reg1, reg2, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.STORE: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = storeParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.STORE_INDIRECT: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = storeIndirectParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.STORE_REG: {
        const { reg1, reg2 } = chunk;
        const trimmedValue = value & 0x3f;
        const params = storeRegParams(reg1, reg2, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.JUMP_REG: {
        const { reg1 } = chunk;
        if (value !== undefined) {
          const trimmedValue = value & 0x7ff;
          const params = jsrParamsLong(trimmedValue);
          return opCode(opcode, params);
        }
        const params = jsrParamsReg(reg1);
        return opCode(opcode, params);
      }
      case OpCode.JUMP: {
        const { reg1 } = chunk;
        const params = jmpParams(reg1);
        return opCode(opcode, params);
      }
      case OpCode.LOAD_EFFECTIVE_ADDRESS: {
        const { reg1 } = chunk;
        const trimmedValue = value & 0x1ff;
        const params = leaParams(reg1, trimmedValue);
        return opCode(opcode, params);
      }
      case OpCode.TRAP: {
        const trimmedValue = value & 0xff;
        return opCode(opcode, trimmedValue);
      }
      case OpCode.BRANCH: {
        const mask = value & 0b111;
        const params = branchParams(mask, offset);
        return opCode(opcode, params);
      }
      default: {
        return opCode(opcode, 0);
      }
    }
  };

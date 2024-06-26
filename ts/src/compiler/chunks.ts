import { OpCode } from "../vm/handlers.js";
import { Register, signExtend, type Address } from "../vm/utils.js";
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
import { assert } from "../utils/index.js";

export type CodeChunk =
  | { opcode: OpCode.ADD; reg1: Register; reg2: Register; value: number }
  | { opcode: OpCode.ADD; reg1: Register; reg2: Register; reg3: Register }
  | { opcode: OpCode.AND; reg1: Register; reg2: Register; reg3: Register }
  | { opcode: OpCode.AND; reg1: Register; reg2: Register; value: number }
  | { opcode: OpCode.NOT; reg1: Register; reg2: Register }
  | { opcode: OpCode.LOAD; reg1: Register; value: number }
  | { opcode: OpCode.LOAD; reg1: Register; address: Address }
  | { opcode: OpCode.LOAD_INDIRECT; reg1: Register; value: number }
  | { opcode: OpCode.LOAD_INDIRECT; reg1: Register; address: Address }
  | { opcode: OpCode.LOAD_REG; reg1: Register; reg2: Register; value: number }
  | { opcode: OpCode.STORE; reg1: Register; value: number }
  | { opcode: OpCode.STORE; reg1: Register; address: Address }
  | { opcode: OpCode.STORE_INDIRECT; reg1: Register; value: number }
  | { opcode: OpCode.STORE_INDIRECT; reg1: Register; address: Address }
  | { opcode: OpCode.STORE_REG; reg1: Register; reg2: Register; value: number }
  | { opcode: OpCode.JUMP_REG; reg1: Register }
  | { opcode: OpCode.JUMP_REG; value: number }
  | { opcode: OpCode.JUMP; reg1: Register }
  | { opcode: OpCode.LOAD_EFFECTIVE_ADDRESS; reg1: Register; value: number }
  | { opcode: OpCode.LOAD_EFFECTIVE_ADDRESS; reg1: Register; address: Address}
  | { opcode: OpCode.TRAP; value: number }
  | { opcode: OpCode.BRANCH; value: number; address: Address };

export const chunk = <T extends OpCode>(opcode: T, chunk: Partial<Omit<Extract<CodeChunk, { opcode: T }>, "opcode">>) =>
  ({
    value: 1 << 16,
    reg1: 0,
    reg2: 0,
    reg3: 0,
    ...chunk,
    opcode,
  } as CodeChunk);

export const chunkToByteCode = (chunk: CodeChunk, pc: number): number => {
  pc = pc + 1;
  const { opcode } = chunk;

  switch (chunk.opcode) {
    case OpCode.ADD: {
      const { reg1, reg2 } = chunk;
      if ("reg3" in chunk) {
        const { reg3 } = chunk;
        const params = addParamsReg(reg1, reg2, reg3);
        return opCode(opcode, params);
      } else {
        const { value } = chunk;
        const trimmedValue = value & 0x1f;

        assert(signExtend(trimmedValue, 5) === value, `Invalid value for ADD instruction: ${value}`);
        const params = addParamsImm(reg1, reg2, trimmedValue);
        return opCode(opcode, params);
      }
    }
    case OpCode.AND: {
      const { reg1, reg2 } = chunk;
      if ("reg3" in chunk) {
        const { reg3 } = chunk;
        const params = andParamsReg(reg1, reg2, reg3);
        return opCode(opcode, params);
      } else {
        const { value } = chunk;
        const trimmedValue = value & 0x1f;

        assert(signExtend(trimmedValue, 5) === value, `Invalid value for AND instruction: ${value}`);
        const params = andParamsImm(reg1, reg2, trimmedValue);
        return opCode(opcode, params);
      }
    }
    case OpCode.NOT: {
      const { reg1, reg2 } = chunk;
      return opCode(opcode, notParams(reg1, reg2));
    }
    case OpCode.LOAD: {
      const { reg1 } = chunk;
      const value = "address" in chunk ? chunk.address - pc : chunk.value;
      const trimmedValue = value & 0x1ff;
      assert(signExtend(trimmedValue, 9) === value, `Invalid value for LOAD instruction: ${value}`);
      const params = loadParams(reg1, trimmedValue);
      return opCode(opcode, params);
    }
    case OpCode.LOAD_INDIRECT: {
      const { reg1 } = chunk;
      const value = "address" in chunk ? chunk.address - pc : chunk.value;
      const trimmedValue = value & 0x1ff;
      assert(signExtend(trimmedValue, 9) === value, `Invalid value for LOAD_INDIRECT instruction: ${value}`);
      const params = loadIndirectParams(reg1, trimmedValue);
      return opCode(opcode, params);
    }
    case OpCode.LOAD_REG: {
      const { reg1, reg2, value } = chunk;
      const trimmedValue = value & 0x3f;
      assert(signExtend(trimmedValue, 6) === value, `Invalid value for LOAD_REG instruction: ${value}`);
      const params = loadRegParams(reg1, reg2, trimmedValue);
      return opCode(opcode, params);
    }
    case OpCode.STORE: {
      const { reg1 } = chunk;
      const value = "address" in chunk ? chunk.address - pc : chunk.value;
      const trimmedValue = value & 0x1ff;
      assert(signExtend(trimmedValue, 9) === value, `Invalid value for STORE instruction: ${value}`);
      const params = storeParams(reg1, trimmedValue);
      return opCode(opcode, params);
    }
    case OpCode.STORE_INDIRECT: {
      const { reg1, } = chunk;
      const value = "address" in chunk ? chunk.address - pc : chunk.value;
      const trimmedValue = value & 0x1ff;
      assert(signExtend(trimmedValue, 9) === value, `Invalid value for STORE_INDIRECT instruction: ${value}`);
      const params = storeIndirectParams(reg1, trimmedValue);
      return opCode(opcode, params);
    }
    case OpCode.STORE_REG: {
      const { reg1, reg2, value } = chunk;
      const trimmedValue = value & 0x3f;
      assert(signExtend(trimmedValue, 6) === value, `Invalid value for STORE_REG instruction: ${value}`);
      const params = storeRegParams(reg1, reg2, trimmedValue);
      return opCode(opcode, params);
    }
    case OpCode.JUMP_REG: {
      if ("value" in chunk) {
        const { value } = chunk;
        const trimmedValue = value & 0x7ff;
        assert(signExtend(trimmedValue, 11) === value, `Invalid value for JUMP_REG instruction: ${value}`);
        const params = jsrParamsLong(trimmedValue);
        return opCode(opcode, params);
      }
      const { reg1 } = chunk;
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
      const value = "address" in chunk ? chunk.address - pc : chunk.value;
      const trimmedValue = value & 0x1ff;
      assert(signExtend(trimmedValue, 9) === value, `Invalid value for LEA instruction: ${value}`);
      const params = leaParams(reg1, trimmedValue);
      return opCode(opcode, params);
    }
    case OpCode.TRAP: {
      const { value } = chunk;
      const trimmedValue = value & 0xff;
      assert(signExtend(trimmedValue, 8) === value, `Invalid value for TRAP instruction: ${value}`);
      return opCode(opcode, trimmedValue);
    }
    case OpCode.BRANCH: {
      const { value, address } = chunk;
      const offset = (address - pc) & 0x1ff;
      const mask = value & 0b111;
      assert(signExtend(offset, 9) === offset, `Invalid value for BRANCH instruction: ${offset}`);
      assert(signExtend(mask, 3) === mask, `Invalid mask for BRANCH instruction: ${mask}`);
      const params = branchParams(mask, offset);
      return opCode(chunk.opcode, params);
    }
    default: {
      return opCode(opcode, 0);
    }
  }
};

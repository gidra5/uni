import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
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
import { OpCode, TrapCode } from "../vm/handlers.js";
import { Address, Register } from "../vm/utils.js";

type CodeChunk = {
  opcode: OpCode;
  dataOffset?: Address;
  stackOffset?: Address;
  value: number;
  address: Address;
  reg1: Register;
  reg2: Register;
  reg3: Register;
};

const chunk = (
  opcode: OpCode,
  {
    dataOffset,
    stackOffset,
    value = 0,
    address = 0,
    reg1 = 0,
    reg2 = 0,
    reg3 = 0,
  }: {
    dataOffset?: Address;
    stackOffset?: Address;
    value?: number;
    address?: number;
    reg1?: number;
    reg2?: number;
    reg3?: number;
  } = {}
): CodeChunk => ({
  opcode,
  value,
  address,
  reg1,
  reg2,
  reg3,
  dataOffset,
  stackOffset,
});

type Context = {
  scope: Scope;
  pc: number;
  chunks: CodeChunk[];
  data: number[][];
};

export class Compiler {
  private context: Context = { scope: new Scope(), pc: 0x3000, chunks: [], data: [] };
  constructor(context?: Context) {
    if (context) this.context = context;
  }

  copy() {
    const context: Context = {
      ...this.context,
      scope: this.context.scope.copy(),
      chunks: [...this.context.chunks],
      data: [...this.context.data],
    };
    return new Compiler(context);
  }

  pushData(data: number[]) {
    const copy = this.copy();
    copy.context.data.push(data);
    return copy;
  }

  pushCode(...code: CodeChunk[]) {
    const copy = this.copy();
    copy.context.chunks.push(...code);
    return copy;
  }

  scopeAdd(name: string, value: any) {
    const copy = this.copy();
    copy.context.scope = copy.context.scope.add(name, value);
    return copy;
  }

  private compileToChunks(ast: AbstractSyntaxTree): Compiler {
    if (ast.name === "operator") {
      if (ast.value === "->" || ast.value === "fn") {
        const name: string = ast.children[0].value;
        const expr = ast.children[1];
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const args = ast.children[1];
      } else if (ast.value === "true") {
        return this.pushData([1]);
      } else if (ast.value === "false") {
        return this.pushData([0]);
      } else if (ast.value === "print") {
        const expr = ast.children[0];
        const dataOffset = this.context.data.length;
        let compiled = this.compileToChunks(expr);
        compiled = compiled.pushCode(chunk(OpCode.OP_LEA, { dataOffset, reg1: Register.R_R0 }));
        compiled = compiled.pushCode(chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_PUTS }));

        return compiled;
      }
    } else if (ast.name === "float") {
      // TODO: encode float? because we are using 16-bit words, js uses 64-bit floats
      return this.pushData([ast.value]);
    } else if (ast.name === "int") {
      return this.pushData([ast.value]);
    } else if (ast.name === "string") {
      const string: string = ast.value;
      const data: number[] = [];

      // null-terminated string
      for (const char of string) {
        const charCode = char.charCodeAt(0);
        data.push(charCode);
      }
      data.push(0);

      return this.pushData(data);
    } else if (ast.name === "name") {
      const name = ast.value;
      const value = this.context.scope.get(name);
      if (value === undefined) {
      }
    }

    return this;
  }

  static chunkToByteCode(chunk: CodeChunk, pc: number, dataStart: Address, stackStart: Address): number {
    const { opcode, dataOffset, stackOffset, value: _value } = chunk;
    const dataStartAddr = dataStart - (pc + 1);
    const dataAddr = dataOffset !== undefined ? dataStartAddr + dataOffset : undefined;
    const stackStartAddr = stackStart - (pc + 1);
    const stackAddr = stackOffset !== undefined ? stackStartAddr + stackOffset : undefined;
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
        const { address } = chunk;
        const mask = value & 0b111;
        const offset = address - (pc + 1);
        const params = branchParams(mask, offset);
        return opCode(opcode, params);
      }
      default: {
        return opCode(opcode, 0);
      }
    }
  }

  static compile(ast: AbstractSyntaxTree, offset: number): Uint16Array {
    const { context } = new Compiler().compileToChunks(ast);
    context.chunks.push(chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_HALT }));

    const dataStart = context.chunks.length;
    const data = context.data.flat();
    const stackStart = dataStart + data.length;
    const code = context.chunks.map((chunk, pc) => this.chunkToByteCode(chunk, pc, dataStart, stackStart));
    const _chunk = code.concat(data);
    _chunk.unshift(offset);
    return new Uint16Array(_chunk);
  }
}

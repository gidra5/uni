import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { Register, signExtend, toHex } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";
import { CopySymbol, copy } from "../utils/copy.js";
import { omit } from "../utils/index.js";

type StackEntryValue = {};
type RegisterReference = {
  dataOffset?: number;
  stackOffset?: number;
  stale: boolean; // needs to be written to memory before value is accessed
  weak: boolean; // can be overwritten to store another value
};

type Context = {
  stack: Scope<StackEntryValue>;
  stackFrames: Scope[];
  chunks: CodeChunk[];
  functionChunks: CodeChunk[][];
  data: number[][];
  registers: Record<number, RegisterReference>;
  maxRegisters: number;
};

export class Compiler {
  private context: Context = {
    stack: new Scope(),
    stackFrames: [],
    chunks: [],
    data: [[0]],
    functionChunks: [],
    registers: {},
    maxRegisters: 8,
  };
  constructor(context?: Partial<Context>) {
    if (context) this.context = { ...this.context, ...context };
  }

  [CopySymbol]() {
    return new Compiler(copy(omit(this.context, ["maxRegisters"])));
  }

  copy() {
    return copy(this);
  }

  update(mapper: (c: Compiler) => Compiler) {
    return mapper(this.copy());
  }

  pushData(...data: number[][]) {
    return this.update((c) => {
      c.context.data.push(...data);
      return c;
    });
  }

  pushChunk(...code: CodeChunk[]) {
    return this.update((c) => {
      c.context.chunks.push(...code);
      return c;
    });
  }

  pushFunctionChunk(...code: CodeChunk[][]) {
    return this.update((c) => {
      c.context.functionChunks.push(...code);
      return c;
    });
  }

  stackAdd(name: string, value: StackEntryValue = {}) {
    return this.update((c) => {
      c.context.stack = c.context.stack.add(name, value);
      return c;
    });
  }

  stackPush(value: StackEntryValue = {}) {
    return this.update((c) => {
      c.context.stack = c.context.stack.push(value);
      return c;
    });
  }

  stackPop() {
    return this.update((c) => {
      c.context.stack = c.context.stack.removeByRelativeIndex(0);
      return c;
    });
  }

  resetStack() {
    return this.update((c) => {
      c.context.stack = new Scope();
      c.context.registers = {};
      return c;
    });
  }

  findFreeRegister() {
    return (
      Iterator.natural()
        .map((i) => ({ reg: i, ...(this.context.registers[i] ?? {}) }))
        .find(({ weak }) => weak === undefined || weak)?.reg ?? Register.R_R0
    );
  }

  allocateRegisters(...regs: Register[]) {
    return this.update((c) => {
      for (const reg of regs) {
        if (!c.context.registers[reg]) c.context.registers[reg] = { stale: false, weak: false };
        else c.context.registers[reg].weak = false;
      }
      return c;
    });
  }

  freeRegisters(...regs: Register[]) {
    return this.update((c) => {
      for (const reg of regs) {
        if (c.context.registers[reg]) c.context.registers[reg].weak = true;
      }
      return c;
    });
  }

  getDataInstruction(reg: Register, dataOffset: number) {
    // if (this.context.registers[reg]?.dataOffset === dataOffset) return this;
    return this.pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset })).getRegister(reg, { dataOffset });
  }

  setDataInstruction(reg: Register, dataOffset: number) {
    // if (this.context.registers[reg]?.dataOffset === dataOffset) return this.setRegister(reg);

    return this.pushChunk(chunk(OpCode.OP_ST, { reg1: reg, dataOffset })).setRegister(reg);
  }

  loadStackBaseInstruction(reg: Register) {
    return this.getDataInstruction(reg, 0);
  }

  stackSetInstruction(reg: Register, index: number) {
    const _reg = this.allocateRegisters(reg).findFreeRegister();

    return this.loadStackBaseInstruction(_reg).pushChunk(chunk(OpCode.OP_STR, { value: index, reg1: reg, reg2: _reg }));
  }

  stackGetInstruction(reg: Register, index: number) {
    return this.loadStackBaseInstruction(reg).pushChunk(chunk(OpCode.OP_LDR, { value: index, reg1: reg, reg2: reg }));
  }

  stackPushInstruction(reg: Register) {
    return this.allocateRegisters(reg)
      .stackSetInstruction(reg, this.context.stack.size())
      .stackPush()
      .freeRegisters(reg);
  }

  stackPopInstruction(reg: Register) {
    return this.stackPop().stackGetInstruction(reg, this.context.stack.size() - 1);
  }

  setStackBaseInstruction(stackSize: number) {
    if (stackSize === 0) return this;
    const reg1 = this.findFreeRegister();
    const reg2 = this.allocateRegisters(reg1).findFreeRegister();
    const trimmedSize = stackSize & 0x1f;
    const imm = signExtend(trimmedSize, 5) === stackSize;

    if (imm) {
      return this.pushChunk(
        chunk(OpCode.OP_LD, { dataOffset: 0, reg1 }),
        chunk(OpCode.OP_ADD, { reg1, reg2: reg1, value: stackSize }),
        chunk(OpCode.OP_ST, { dataOffset: 0, reg1 })
      );
    } else {
      return this.pushData([stackSize]).pushChunk(
        chunk(OpCode.OP_LD, { dataOffset: 0, reg1 }),
        chunk(OpCode.OP_LD, { dataOffset: this.context.data.length, reg1: reg2 }),
        chunk(OpCode.OP_ADD, { reg1, reg2, reg3: reg1 }),
        chunk(OpCode.OP_ST, { dataOffset: 0, reg1 })
      );
    }
  }

  pushStackFrameInstruction() {
    return this.update((c) => {
      const stackSize = c.context.stack.size();
      c.context.stackFrames.push(c.context.stack);
      return c.resetStack().setStackBaseInstruction(stackSize);
    });
  }

  popStackFrameInstruction() {
    return this.update((c) => {
      c.context.stack = c.context.stackFrames.pop()!;
      const stackSize = -c.context.stack.size();
      return c.setStackBaseInstruction(stackSize);
    });
  }

  private compileToChunks(ast: AbstractSyntaxTree): Compiler {
    // console.log(ast, this);
    if (ast.name === "group") {
      if (ast.value === "true") {
        return this.pushData([-1]);
      } else if (ast.value === "false") {
        return this.pushData([0]);
      } else if (ast.value === "parens") {
        return this.compileToChunks(ast.children[0]);
      } else if (ast.value === "brackets") {
        return this.compileToChunks(ast.children[0]);
      }
    } else if (ast.name === "operator") {
      if (ast.value === "->" || ast.value === "fn") {
        const body = ast.children[1];
        const codeIndex = this.context.chunks.length;
        const dataIndex = this.context.data.length;
        const compiled = this.resetStack()
          .stackPush()
          .update((c) => {
            const name = ast.children[0];
            if (name.name === "placeholder") return c.stackPush();
            return c.stackAdd(name.value);
          })
          .compileToChunks(body)
          .stackPopInstruction(Register.R_R0) // pop return value
          .allocateRegisters(Register.R_R0)
          .stackPop() // drop argument, it was consumed by body
          .stackPopInstruction(Register.R_R1) // pop return address
          .allocateRegisters(Register.R_R1)
          .stackPushInstruction(Register.R_R0) // push return value
          .pushChunk(chunk(OpCode.OP_JMP, { reg1: Register.R_R1 }))
          .freeRegisters(Register.R_R0, Register.R_R1);
        const functionOffset = this.context.functionChunks.length;
        const reg = this.findFreeRegister();
        return this.pushFunctionChunk(compiled.context.chunks.slice(codeIndex))
          .pushData(...compiled.context.data.slice(dataIndex))
          .pushChunk(chunk(OpCode.OP_LEA, { reg1: reg, functionOffset }))
          .stackPushInstruction(reg);
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];
        const reg = this.findFreeRegister();
        const leaChunkIndex = this.context.chunks.length;
        const y = this.pushChunk(chunk(OpCode.OP_LEA, { reg1: reg, value: 0 }))
          .stackPushInstruction(reg)
          .compileToChunks(arg)
          .compileToChunks(fn)
          .stackPop() // pop fn address, is consumed by operator
          .stackPop() // pop argument, so it will be in next stack frame
          .stackPop() // pop return address, so it will be in next stack frame
          .pushStackFrameInstruction()
          .pushChunk(chunk(OpCode.OP_JMP, { reg1: reg }));
        y.context.chunks[leaChunkIndex].value = y.context.chunks.length - 1 - this.context.chunks.length;
        return y.popStackFrameInstruction();
      } else if (ast.value === "print") {
        const expr = ast.children[0];
        const dataOffset = this.context.data.length;
        let compiled = this.compileToChunks(expr);
        compiled = compiled.pushChunk(
          chunk(OpCode.OP_LEA, { dataOffset, reg1: Register.R_R0 }),
          chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_PUTS })
        );

        return compiled;
      } else if (ast.value === ";") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      } else if (ast.value === "+") {
        const left = ast.children[0];
        const right = ast.children[1];
        const reg1 = this.findFreeRegister();
        const reg2 = this.allocateRegisters(reg1).findFreeRegister();
        return this.compileToChunks(left)
          .compileToChunks(right)
          .allocateRegisters(reg1, reg2)
          .stackPopInstruction(reg1)
          .stackPopInstruction(reg2)
          .pushChunk(chunk(OpCode.OP_ADD, { reg1, reg2, reg3: reg1 }))
          .freeRegisters(reg2)
          .stackPushInstruction(reg1)
          .freeRegisters(reg1);
      } else if (ast.value === "*") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left)
          .compileToChunks(right)
          .pushChunk(
            chunk(OpCode.OP_LD, { stackOffset: this.context.stack.size(), reg1: Register.R_R0 }),
            chunk(OpCode.OP_LD, { stackOffset: this.context.stack.size() + 1, reg1: Register.R_R1 }),

            chunk(OpCode.OP_ST, { stackOffset: this.context.stack.size(), reg1: Register.R_R2 })
          );
      }
    } else if (ast.name === "float") {
      // TODO: encode float? because we are using 16-bit words, js uses 64-bit floats
      const reg = this.findFreeRegister();
      return this.pushData([ast.value])
        .pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset: this.context.data.length }))
        .stackPushInstruction(reg);
    } else if (ast.name === "int") {
      const reg = this.findFreeRegister();
      return this.pushData([ast.value])
        .pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset: this.context.data.length }))
        .stackPushInstruction(reg);
    } else if (ast.name === "string") {
      const string: string = ast.value;
      const data: number[] = [];

      // null-terminated string
      for (const char of string) {
        const charCode = char.charCodeAt(0);
        data.push(charCode);
      }
      data.push(0);

      const reg = this.findFreeRegister();
      return this.pushData(data)
        .pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset: this.context.data.length }))
        .stackPushInstruction(reg);
    } else if (ast.name === "name") {
      const name: string = ast.value;
      const value = this.context.stack.get({ name });
      if (value === undefined) {
        return this;
      }
      const reg = this.findFreeRegister();
      return this.stackGetInstruction(reg, value.index).stackPushInstruction(reg);
    }

    return this;
  }

  static compile(ast: AbstractSyntaxTree, offset: number): Uint16Array {
    const { context } = new Compiler().compileToChunks(ast);
    context.chunks.push(chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_HALT }));

    const functionOffsets = Iterator.iter(context.functionChunks)
      .map((chunk) => chunk.length)
      .prepend(context.chunks.length)
      .sum(true)
      .toArray();
    context.chunks.push(...context.functionChunks.flat());
    const dataStart = context.chunks.length;
    const dataOffsets = Iterator.iter(context.data)
      .map((data) => data.length)
      .prepend(dataStart)
      .sum(true)
      .toArray();
    const data = context.data.flat();
    const stackStart = dataStart + data.length;
    data[0] = offset + stackStart;

    const code = context.chunks.map(chunkToByteCode(functionOffsets, dataOffsets, stackStart));
    console.log(code.map((instruction, i) => `${toHex(i)}   ${disassemble(instruction)}`).join("\n"));
    const dataToString = (x: number, i: number) =>
      `${toHex(i + dataStart)}   ${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`;
    console.log(data.map(dataToString).join("\n"));
    const _chunk = code.concat(data);
    _chunk.unshift(offset);
    return new Uint16Array(_chunk);
  }
}

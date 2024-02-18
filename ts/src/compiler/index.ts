import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { Register, signExtend, toHex } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";
import { CopySymbol, copy } from "../utils/copy.js";
import { omit } from "../utils/index.js";

type StackEntryValue = { reg?: number };
type Context = {
  scope: Scope;
  stack: Scope<StackEntryValue>;
  stackFrames: Scope[];
  chunks: CodeChunk[];
  functionChunks: CodeChunk[][];
  data: number[][];
  occupiedRegisters: number[];
  registerToStack: Record<number, number>;
  maxRegisters: number;
};

export class Compiler {
  private context: Context = {
    scope: new Scope(),
    stack: new Scope(),
    stackFrames: [],
    chunks: [],
    data: [[0]],
    occupiedRegisters: [],
    functionChunks: [],
    registerToStack: {},
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

  scopeAdd(name: string, value: any = {}) {
    return this.update((c) => {
      c.context.scope = c.context.scope.add(name, value);
      return c;
    });
  }

  scopePush(value: any = {}) {
    return this.update((c) => {
      c.context.scope = c.context.scope.push(value);
      return c;
    });
  }

  scopePop() {
    return this.update((c) => {
      c.context.scope = c.context.scope.removeByRelativeIndex(0);
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

  findFreeRegister() {
    const index = this.context.occupiedRegisters.findIndex((x, i) => x !== i);
    // console.log(this.context.occupiedRegisters, index, this.context.occupiedRegisters.length);

    return index === -1 ? this.context.occupiedRegisters.length : index;
  }

  allocateRegisters(...regs: Register[]) {
    return this.update((c) => {
      for (const reg of regs.filter((reg) => c.context.occupiedRegisters[reg] !== reg))
        c.context.occupiedRegisters.splice(reg, 0, reg);
      return c;
    });
  }

  freeRegisters(...regs: Register[]) {
    return this.update((c) => {
      c.context.occupiedRegisters = c.context.occupiedRegisters.filter((x) => !regs.includes(x));
      return c;
    });
  }

  loadStackBaseInstruction(reg: Register) {
    return this.pushChunk(chunk(OpCode.OP_LD, { dataOffset: 0, reg1: reg }));
  }

  stackSetInstruction(reg: Register, offset: number) {
    const _reg = this.allocateRegisters(reg).findFreeRegister();

    return this.loadStackBaseInstruction(_reg).pushChunk(
      chunk(OpCode.OP_STR, { value: offset, reg1: reg, reg2: _reg })
    );
  }

  stackGetInstruction(reg: Register, offset: number) {
    if (this.context.stack.getByIndex(offset)?.value?.reg !== undefined) {
      return this;
    }

    return this.loadStackBaseInstruction(reg).pushChunk(chunk(OpCode.OP_LDR, { value: offset, reg1: reg, reg2: reg }));
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

  resetStack() {
    return this.update((c) => {
      c.context.stack = new Scope();
      return c;
    });
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
      c.context.stack = new Scope();
      return c.setStackBaseInstruction(stackSize);
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
      } else {
      }
    } else if (ast.name === "operator") {
      if (ast.value === "->" || ast.value === "fn") {
        const name: string = ast.children[0].value;
        const expr = ast.children[1];
        const codeIndex = this.context.chunks.length;
        const dataIndex = this.context.data.length;
        const withName = this.resetStack().stackPush().stackAdd(name);
        const compiled = withName
          .compileToChunks(expr)
          .stackPopInstruction(Register.R_R0) // pop return value
          .allocateRegisters(Register.R_R0)
          .stackPop() // drop argument
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
        const x = this.stackPush().compileToChunks(arg).compileToChunks(fn);
        const leaChunk = chunk(OpCode.OP_LEA, { reg1: reg, value: 0 });
        const y = x
          .pushChunk(leaChunk)
          .stackSetInstruction(reg, this.context.stack.size())
          .stackPopInstruction(reg)
          .allocateRegisters(reg)
          .stackPop() // pop argument, so it will be in next stack frame
          .stackPop() // pop return address, so it will be in next stack frame
          .pushStackFrameInstruction()
          .pushChunk(chunk(OpCode.OP_JMP, { reg1: reg }))
          .freeRegisters(reg);
        leaChunk.value = y.context.chunks.length - 1 - x.context.chunks.length;
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
            chunk(OpCode.OP_LD, { stackOffset: this.context.scope.size(), reg1: Register.R_R0 }),
            chunk(OpCode.OP_LD, { stackOffset: this.context.scope.size() + 1, reg1: Register.R_R1 }),

            chunk(OpCode.OP_ST, { stackOffset: this.context.scope.size(), reg1: Register.R_R2 })
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
    const { context } = new Compiler()
      .pushChunk(
        chunk(OpCode.OP_LEA, { stackOffset: 0, reg1: Register.R_R0 }),
        chunk(OpCode.OP_ST, { dataOffset: 0, reg1: Register.R_R0 })
      )
      .compileToChunks(ast);
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
    const code = context.chunks.map(chunkToByteCode(functionOffsets, dataOffsets, stackStart));
    console.log(code.map((instruction, i) => `${toHex(i)}   ${disassemble(instruction)}`).join("\n"));
    console.log(data.map((x, i) => `${toHex(i + dataStart)}   ${x}`).join("\n"));
    const _chunk = code.concat(data);
    _chunk.unshift(offset);
    return new Uint16Array(_chunk);
  }
}

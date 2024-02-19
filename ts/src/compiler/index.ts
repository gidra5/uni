import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { Register, signExtend, toHex } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";
import { CopySymbol, copy } from "../utils/copy.js";
import { omit } from "../utils/index.js";

type StackEntryValue = { offset: number; size: number };
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

  stackAdd(name: string, value: Partial<StackEntryValue> = {}) {
    const top = this.context.stack.getByRelativeIndex(0)?.value ?? { offset: 0, size: 0 };
    const offset = top.offset + top.size;
    return this.update((c) => {
      c.context.stack = c.context.stack.add(name, { offset, size: 1, ...value });
      return c;
    });
  }

  stackPush(value: Partial<StackEntryValue> = {}) {
    const top = this.context.stack.getByRelativeIndex(0)?.value ?? { offset: 0, size: 0 };
    const offset = top.offset + top.size;
    return this.update((c) => {
      c.context.stack = c.context.stack.push({ offset, size: 1, ...value });
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

  stackDrop(n: number) {
    return this.update((c) => {
      c.context.stack = c.context.stack.drop(n);
      return c;
    });
  }

  findFreeRegister(usecase: "data" | "stack" | "stackPop" | "free" = "free", value?: number): Register {
    if (usecase === "stackPop") {
      usecase = "stack";
      value = this.context.stack.size() - 1;
    }
    const maxRegisters = this.context.maxRegisters;
    const regs = Iterator.natural(maxRegisters).map((i) => ({ reg: i, ...(this.context.registers[i] ?? {}) }));

    const dataReg = regs.find(({ dataOffset }) => usecase === "data" && dataOffset === value)?.reg;
    const stackReg = regs.find(({ stackOffset }) => usecase === "stack" && stackOffset === value)?.reg;
    const freeReg = regs.find(({ weak }) => weak === undefined || weak)?.reg;

    return dataReg ?? stackReg ?? freeReg ?? Register.R_R0;
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

  freeRegister(reg: Register) {
    return this.update((c) => {
      c.context.registers[reg].weak = true;
      return c;
    });
  }

  setRegister(reg: Register, ref: Partial<RegisterReference> = {}) {
    return this.update((c) => {
      const register = c.context.registers[reg] ?? { ...ref, stale: true, weak: true };
      const dataOffset = register?.dataOffset;
      const stackOffset = register?.stackOffset;
      c.context.registers = Iterator.iterEntries(c.context.registers)
        .filterValues((x) => x.dataOffset !== dataOffset && x.stackOffset !== stackOffset)
        .toObject();
      register.stale = true;
      c.context.registers[reg] = register;
      return c;
    });
  }

  getRegister(reg: Register, ref: Partial<RegisterReference> = {}) {
    return this.update((c) => {
      c.context.registers[reg] = { ...ref, stale: false, weak: true };
      return c;
    });
  }

  syncedRegister(reg: Register) {
    const register = this.context.registers[reg];
    if (!register) return this;
    return this.update((c) => {
      c.context.registers[reg].stale = false;
      return c;
    });
  }

  writeBackRegister(reg: Register) {
    const register = this.context.registers[reg];
    if (!register) return this;
    const { dataOffset, stackOffset } = register;
    return this.pushChunk(chunk(OpCode.OP_ST, { reg1: reg, dataOffset, stackOffset })).syncedRegister(reg);
  }

  dataGetInstruction(reg: Register, dataOffset: number) {
    // if (this.context.registers[reg]?.dataOffset === dataOffset) return this;
    return this.pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset })).getRegister(reg, { dataOffset });
  }

  dataSetInstruction(reg: Register, dataOffset: number) {
    // if (this.context.registers[reg]?.dataOffset === dataOffset) return this.setRegister(reg);

    return this.pushChunk(chunk(OpCode.OP_ST, { reg1: reg, dataOffset })).setRegister(reg, { dataOffset });
  }

  loadStackBaseInstruction(reg: Register) {
    return this.dataGetInstruction(reg, 0);
  }

  stackSetInstruction(reg: Register, index: number) {
    const _reg = this.allocateRegisters(reg).findFreeRegister("data", 0);

    return this.loadStackBaseInstruction(_reg)
      .pushChunk(chunk(OpCode.OP_STR, { value: index, reg1: reg, reg2: _reg }))
      .setRegister(reg, { stackOffset: index });
  }

  stackGetInstruction(reg: Register, index: number) {
    return this.loadStackBaseInstruction(reg)
      .pushChunk(chunk(OpCode.OP_LDR, { value: index, reg1: reg, reg2: reg }))
      .getRegister(reg, { stackOffset: index });
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
    const reg1 = this.findFreeRegister("data", 0);
    const trimmedSize = stackSize & 0x1f;
    const imm = signExtend(trimmedSize, 5) === stackSize;

    return this.dataGetInstruction(reg1, 0)
      .update((c) => {
        if (imm) {
          return c.pushChunk(chunk(OpCode.OP_ADD, { reg1, reg2: reg1, value: stackSize }));
        }
        const dataOffset = this.context.data.length;
        const reg2 = this.allocateRegisters(reg1).findFreeRegister("data", dataOffset);
        return c
          .pushData([stackSize])
          .dataGetInstruction(reg2, dataOffset)
          .pushChunk(chunk(OpCode.OP_ADD, { reg1, reg2, reg3: reg1 }));
      })
      .dataSetInstruction(reg1, 0);
  }

  pushStackFrameInstruction() {
    return this.update((c) => {
      const stackSize = c.context.stack.size();
      c.context.stackFrames.push(c.context.stack);
      return c.setStackBaseInstruction(stackSize).resetStack();
    });
  }

  popStackFrameInstruction() {
    return this.update((c) => {
      c.context.stack = c.context.stackFrames.pop()!;
      const stackSize = -c.context.stack.size();
      return c.setStackBaseInstruction(stackSize);
    });
  }

  /**
   * in `[..., retAddr, arg, fnAddr]`
   *
   * out `[..., retValue]`
   */
  callInstruction(returnAddrChunkIndex: number) {
    const _reg = this.findFreeRegister("stackPop");
    const compiled = this.stackPopInstruction(_reg) // pop fn address, is consumed by operator
      .stackPop() // pop argument, so it will be consumed by function
      .stackPop() // pop return address, so it will be consumed by function
      .pushStackFrameInstruction()
      .pushChunk(chunk(OpCode.OP_JMP, { reg1: _reg }));
    compiled.context.chunks[returnAddrChunkIndex].value =
      compiled.context.chunks.length - 1 - this.context.chunks.length;
    return compiled.popStackFrameInstruction();
  }

  /**
   * in `[..., arg1, arg2]`
   *
   * out `[..., arg1 + arg2]`
   */
  addInstruction() {
    const reg1 = this.findFreeRegister("stackPop");
    const reg2 = this.allocateRegisters(reg1).stackPop().findFreeRegister("stackPop");
    return this.allocateRegisters(reg1, reg2)
      .stackPopInstruction(reg1)
      .stackPopInstruction(reg2)
      .pushChunk(chunk(OpCode.OP_ADD, { reg1, reg2, reg3: reg1 }))
      .freeRegisters(reg2)
      .stackPushInstruction(reg1)
      .freeRegisters(reg1);
  }

  /**
   * in `[...]`
   *
   * out `[..., value]`
   */
  pushConstantInstruction(value: number) {
    const dataOffset = this.context.data.length;
    const reg = this.findFreeRegister("data", dataOffset);
    return this.pushData([value])
      .pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset }))
      .stackPushInstruction(reg);
  }

  pushDataPointerInstruction(dataOffset: number) {
    const reg = this.findFreeRegister("data", dataOffset);
    return this.pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset })).stackPushInstruction(reg);
  }

  pushFunctionPointerInstruction(functionOffset: number) {
    const reg = this.findFreeRegister();
    return this.pushChunk(chunk(OpCode.OP_LEA, { reg1: reg, functionOffset })).stackPushInstruction(reg);
  }

  /**
   * Copy value from reg1 to reg2
   */
  copyInstruction(fromReg: Register, toReg: Register) {
    return this.pushChunk(chunk(OpCode.OP_ADD, { reg1: fromReg, reg2: toReg, value: 0 }));
  }

  stackSwapInstruction(index1: number, index2: number) {
    const reg1 = this.findFreeRegister("stack", index1);
    const reg2 = this.allocateRegisters(reg1).findFreeRegister("stack", index2);
    return this.stackGetInstruction(reg1, index1)
      .allocateRegisters(reg1)
      .stackGetInstruction(reg2, index2)
      .allocateRegisters(reg2)
      .stackSetInstruction(reg1, index2)
      .stackSetInstruction(reg2, index1)
      .freeRegisters(reg1, reg2);
  }

  /**
   * in `[..., value, returnAddr]`
   *
   * out `[..., value]`
   */
  returnInstruction() {
    const reg = this.findFreeRegister("stackPop");
    return this.stackPopInstruction(reg) // pop return address
      .pushChunk(chunk(OpCode.OP_JMP, { reg1: reg }));
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
        const stackSize = this.context.stack.size();
        return this.compileToChunks(ast.children[0]).update((c) => {
          const newSize = c.context.stack.size();
          const toDrop = newSize - (stackSize + 1);
          return c.stackSwapInstruction(stackSize, newSize - 1).stackDrop(toDrop);
        });
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
          .update((c) => {
            const size = c.context.stack.size();
            return c
              .stackSwapInstruction(size - 1, size - 3) // swap return value and address
              .stackSwapInstruction(size - 1, size - 2); // swap argument and address
          })
          .stackPop() // pop argument
          .returnInstruction();

        return this.pushFunctionChunk(compiled.context.chunks.slice(codeIndex))
          .pushData(...compiled.context.data.slice(dataIndex))
          .pushFunctionPointerInstruction(this.context.functionChunks.length);
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];
        const reg = this.findFreeRegister();
        const leaChunkIndex = this.context.chunks.length;
        return this.pushChunk(chunk(OpCode.OP_LEA, { reg1: reg }))
          .stackPushInstruction(reg)
          .compileToChunks(arg)
          .compileToChunks(fn)
          .callInstruction(leaChunkIndex);
      } else if (ast.value === "print") {
        const expr = ast.children[0];
        return this.compileToChunks(expr)
          .stackPopInstruction(Register.R_R0)
          .pushChunk(chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_PUTS }));
      } else if (ast.value === ";") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      } else if (ast.value === "+") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right).addInstruction();
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
      return this.pushConstantInstruction(ast.value);
    } else if (ast.name === "int") {
      return this.pushConstantInstruction(ast.value);
    } else if (ast.name === "string") {
      const string: string = ast.value;
      const data: number[] = [];

      // null-terminated string
      for (const char of string) {
        const charCode = char.charCodeAt(0);
        data.push(charCode);
      }
      data.push(0);

      return this.pushData(data).pushDataPointerInstruction(this.context.data.length);
    } else if (ast.name === "name") {
      const name: string = ast.value;
      const value = this.context.stack.get({ name });
      if (value === undefined) {
        return this;
      }
      const reg = this.findFreeRegister("stack", value.index);
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

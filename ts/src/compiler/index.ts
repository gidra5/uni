import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { Register, signExtend, toHex } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";
import { CopySymbol, copy } from "../utils/copy.js";
import { omit } from "../utils/index.js";

type StackEntryValue = { offset: number; size: number };
type RegisterValue<T> = {
  value: T;
  stale: boolean; // needs to be written to memory before value is accessed
  weak: boolean; // can be overwritten to store another value
};
type RegisterReference = {
  dataOffset?: number;
  stackOffset?: number;
};

class RegisterState<T> {
  state: (RegisterValue<T> | null)[];
  constructor(size: number) {
    this.state = Array(size).fill(null);
  }

  [CopySymbol]() {
    return this.copy();
  }

  copy() {
    const copied = new RegisterState<T>(0);
    copied.state = copy(this.state);
    return copied;
  }

  clear(f?: (x: RegisterValue<T> | null) => boolean) {
    if (f) this.state = this.state.map((x) => (f(x) ? null : x));
    else this.state = this.state.map(() => null);
  }

  find(f: (x: RegisterValue<T> | null) => boolean): Register | null {
    const index = this.state.findIndex(f);
    return index === -1 ? null : index;
  }

  get(register: Register): RegisterValue<T> | null {
    return this.state[register];
  }

  set(register: Register, value: T) {
    this.state[register] = { value, stale: true, weak: true };
  }

  unset(register: Register) {
    this.state[register] = null;
  }

  update(register: Register, value: T) {
    const _register = this.state[register];
    if (!_register) {
      this.set(register, value);
      return;
    }
    _register.value = value;
  }

  stale(register: Register) {
    const _register = this.state[register];
    if (_register) _register.stale = true;
  }

  synced(register: Register) {
    const _register = this.state[register];
    if (_register) _register.stale = false;
  }

  free(register: Register) {
    const _register = this.state[register];
    if (_register) _register.weak = true;
  }

  allocate(register: Register) {
    const _register = this.state[register];
    if (_register) _register.weak = false;
  }
}

class StackToRegisterAdapter {
  registers = new RegisterState<RegisterReference>(8);
  stack: Scope<StackEntryValue> = new Scope();
  stackFrames: Scope[] = [];

  [CopySymbol]() {
    return this.copyAdapter();
  }

  copyAdapter() {
    const copied = new StackToRegisterAdapter();
    copied.registers = this.registers.copy();
    copied.stack = this.stack.copy();
    copied.stackFrames = copy(this.stackFrames);
    return copied;
  }

  /**
   * We are guaranteed to find a register, since at most 3 registers can be used at the same time, and we more
   */
  findRegister(): Register;
  findRegister(usecase: "data" | "stack", value: number): Register | null;
  findRegister(usecase?: "data" | "stack", value?: number): Register | null {
    const freeReg = this.registers.find((x) => x === null);
    const weakReg = this.registers.find((x) => !!x?.weak);
    if (usecase === "data") {
      const dataReg = this.registers.find((x) => x?.value.dataOffset === value);
      return dataReg ?? freeReg;
    }
    if (usecase === "stack") {
      const stackReg = this.registers.find((x) => x?.value.stackOffset === value);
      return stackReg ?? freeReg;
    }

    return freeReg ?? weakReg;
  }

  /**
   * Joins `count` stack entries starting from `index` into a single entry
   */
  join(index: number, count: number) {
    const stack = this.stack.copy();
    const entries = stack.scope.slice(index, count);
    const size = entries.reduce((acc, x) => acc + x.value.size, 0);
    const offset = entries[0].value.offset;
    stack.scope.splice(index, count, { value: { offset, size } });
    stack.updateNames();
    this.stack = stack;
  }

  split(index: number, splitSize: number) {
    const stack = this.stack.copy();
    const entry = stack.scope[index];
    const size1 = splitSize;
    const size2 = entry.value.size - splitSize;
    entry.value.size = size1;
    stack.scope.splice(index + 1, 0, { value: { offset: entry.value.offset + size1, size: size2 } });
    stack.updateNames();
    this.stack = stack;
  }

  push<T>(chunks: (reg: Register, chunks: CodeChunk[]) => T): T {
    const index = this.stack.size();
    this.stack = this.stack.push({ offset: 0, size: 1 });
    return this.set(index, chunks);
  }

  pop<T>(chunks: (reg: Register, chunks: CodeChunk[]) => T): T {
    const index = this.stack.size() - 1;
    const res = this.get(index, chunks);
    this.stack = this.stack.removeByIndex(index);
    return res;
  }

  get<T>(index: number, chunks: (reg: Register, chunks: CodeChunk[]) => T): T {
    let reg = this.findRegister("stack", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }
    if (!this.registers.get(reg)) {
      _chunks.push(
        ...this.dataGet(0, (reg2, rest) => [...rest, chunk(OpCode.OP_LDR, { value: index, reg1: reg!, reg2 })])
      );
      this.registers.set(reg, { stackOffset: index });
      this.registers.synced(reg);
    }

    this.registers.allocate(reg);
    const res = chunks(reg, _chunks);
    this.registers.free(reg);

    return res;
  }

  set<T>(index: number, chunks: (reg: Register, chunks: CodeChunk[]) => T): T {
    let reg = this.findRegister("stack", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }
    this.registers.set(reg, { stackOffset: index });

    this.registers.allocate(reg);
    const res = chunks(reg, _chunks);
    this.registers.free(reg);

    return res;
  }

  swap(index1: number, index2: number) {
    const chunks: CodeChunk[] = [];

    chunks.push(
      ...this.get(index1, (reg1, rest) => [
        ...rest,
        ...this.get(index2, (reg2, rest) => {
          this.registers.update(reg1, { stackOffset: index2 });
          this.registers.update(reg2, { stackOffset: index1 });
          this.registers.stale(reg1);
          this.registers.stale(reg2);
          return rest;
        }),
      ])
    );
  }

  copy(index: number) {
    return this.get(index, (reg2, rest) => [
      ...rest,
      ...this.push((reg1, rest) => [...rest, chunk(OpCode.OP_ADD, { reg1, reg2, value: 0 })]),
    ]);
  }

  dataGet<T>(index: number, chunks: (reg: Register, chunks: CodeChunk[]) => T): T {
    let reg = this.findRegister("data", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }
    // console.log("data get", index, reg, transformRegisterState(this.registers.state));

    if (!this.registers.get(reg)) {
      _chunks.push(chunk(OpCode.OP_LD, { reg1: reg, dataOffset: index }));
      this.registers.set(reg, { dataOffset: index });
      this.registers.synced(reg);
    }

    this.registers.allocate(reg);
    const res = chunks(reg, _chunks);
    this.registers.free(reg);

    // console.log("data get end", index, reg, transformRegisterState(this.registers.state));
    return res;
  }

  dataSet<T>(index: number, chunks: (reg: Register, chunks: CodeChunk[]) => T): T {
    let reg = this.findRegister("data", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }
    this.registers.set(reg, { dataOffset: index });

    this.registers.allocate(reg);
    const res = chunks(reg, _chunks);
    this.registers.free(reg);

    return res;
  }

  writeBack(register?: Register): CodeChunk[] {
    return this.registers.state.flatMap((x, reg) => {
      if (!x) return [];
      if (!x.stale) return [];
      if (register !== undefined && register !== reg) return [];

      const { dataOffset, stackOffset } = x.value;
      this.registers.synced(reg);
      if (dataOffset !== undefined) return [chunk(OpCode.OP_ST, { reg1: reg, dataOffset })];
      if (stackOffset !== undefined)
        return this.dataGet(0, (reg2, rest) => [
          ...rest,
          chunk(OpCode.OP_STR, { value: stackOffset, reg1: reg, reg2 }),
        ]);
      return [];
    });
  }

  pushStackFrame(pushData: (x: number) => number): CodeChunk[] {
    const stackSize = this.stack.size();
    this.stackFrames.push(this.stack);
    this.stack = new Scope();
    this.registers.clear();
    return this.updateStackBase(stackSize, pushData);
  }

  popStackFrame(pushData: (x: number) => number): CodeChunk[] {
    this.stack = this.stackFrames.pop()!;
    return this.updateStackBase(-this.stack.size(), pushData);
  }

  updateStackBase(stackSize: number, pushData: (x: number) => number): CodeChunk[] {
    if (stackSize === 0) return [];
    const trimmedSize = stackSize & 0x1f;
    const imm = signExtend(trimmedSize, 5) === stackSize;

    if (imm) {
      return this.dataSet(0, (reg1, rest) => [...rest, chunk(OpCode.OP_ADD, { reg1, reg2: reg1, value: stackSize })]);
    }
    return this.dataGet(pushData(stackSize), (reg1, rest) => [
      ...rest,
      ...this.dataSet(0, (reg2, rest) => [...rest, chunk(OpCode.OP_ADD, { reg1, reg2, reg3: reg1 })]),
    ]);
  }
}

type Context = {
  chunks: CodeChunk[];
  functionChunks: CodeChunk[][];
  data: number[][];
  // registers: any[];
};

const chunkToString = (chunk: CodeChunk): string => {
  return disassemble(chunkToByteCode([], [], 0)(chunk, 0));
};
const transformRegisterState = <T>(state: RegisterState<T>["state"]) => {
  return Iterator.iter(state)
    .enumerate()
    .flatMap(([x, i]) => (x ? [{ reg: i, ...x }] : []))
    .map<[number, any]>(({ reg, ...rest }) => [reg, rest])
    .toObject();
};

export class Compiler {
  adapter = new StackToRegisterAdapter();
  private context: Context = {
    chunks: [],
    data: [[0]],
    functionChunks: [],
    // get registers() {
    //   return this.registerState.state.flatMap((x, i) => (x ? { reg: i, ...x } : []));
    // },
  };

  constructor(context?: Partial<Context>) {
    if (context)
      this.context = {
        ...this.context,
        ...context,
        // get registers() {
        //   return this.registerState.state.flatMap((x, i) => (x ? { ...x, reg: i } : []));
        // },
      };
  }

  [CopySymbol]() {
    return this.copy();
  }

  copy() {
    const copied = new Compiler(copy(this.context));
    copied.adapter = copy(this.adapter);
    return copied;
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
      // console.log(c.context.registers);
      // console.log(code.map(chunkToString).join("\n"));
      // console.log("");

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

  private stackAdd(name: string, value: Partial<StackEntryValue> = {}) {
    const top = this.adapter.stack.getByRelativeIndex(0)?.value ?? { offset: 0, size: 0 };
    const offset = top.offset + top.size;
    return this.update((c) => {
      c.adapter.stack = c.adapter.stack.add(name, { offset, size: 1, ...value });
      return c;
    });
  }

  private stackPush(value: Partial<StackEntryValue> = {}) {
    const top = this.adapter.stack.getByRelativeIndex(0)?.value ?? { offset: 0, size: 0 };
    const offset = top.offset + top.size;
    return this.update((c) => {
      c.adapter.stack = c.adapter.stack.push({ offset, size: 1, ...value });
      return c;
    });
  }

  private stackPop() {
    return this.update((c) => {
      const index = c.adapter.stack.size() - 1;
      c.adapter.stack = c.adapter.stack.removeByIndex(index);
      c.adapter.registers.clear((x) => x?.value.stackOffset === index);
      return c;
    });
  }

  private resetStack() {
    return this.update((c) => {
      c.adapter.stack = new Scope();
      c.adapter.registers.clear();
      return c;
    });
  }

  private stackDrop(n: number) {
    return this.update((c) => {
      c.adapter.stack = c.adapter.stack.drop(n);
      return c;
    });
  }

  private findRegister(usecase?: "data" | "stack" | "stackPop" | "stackPush", value?: number): Register {
    if (usecase === "stackPop") {
      usecase = "stack";
      value = this.adapter.stack.size() - 1;
    }

    if (usecase === "stackPush") {
      usecase = "stack";
      value = this.adapter.stack.size();
    }

    return this.adapter.findRegister(usecase!, value!) ?? Register.R_R0;
  }

  private allocateRegisters(...regs: Register[]) {
    return this.update((c) => {
      for (const reg of regs) {
        const register = c.adapter.registers.get(reg);
        if (!register) c.adapter.registers.set(reg, {});
        c.adapter.registers.allocate(reg);
      }
      return c;
    });
  }

  private freeRegisters(...regs: Register[]) {
    return this.update((c) => {
      for (const reg of regs) {
        c.adapter.registers.free(reg);
      }
      return c;
    });
  }

  private setRegister(reg: Register, value: RegisterReference) {
    return this.update((c) => {
      const register = c.adapter.registers.get(reg) ?? { value, stale: true, weak: true };
      const dataOffset = register.value.dataOffset;
      const stackOffset = register.value.stackOffset;

      if (dataOffset !== undefined) c.adapter.registers.clear((x) => x?.value.dataOffset === dataOffset);
      if (stackOffset !== undefined) c.adapter.registers.clear((x) => x?.value.stackOffset === stackOffset);

      c.adapter.registers.update(reg, { ...register.value, ...value });
      c.adapter.registers.stale(reg);
      return c;
    });
  }

  private getRegister(reg: Register, value: RegisterReference) {
    return this.update((c) => {
      c.adapter.registers.update(reg, value);
      c.adapter.registers.synced(reg);
      return c;
    });
  }

  private writeBackAllRegisters() {
    // console.log("write back all registers", this.context.registers);

    return this.update((c) => {
      return c.pushChunk(...c.adapter.writeBack());
    });
  }

  private stackGetDirectInstruction(reg: Register, index: number) {
    return this.dataGetInstruction(0, (_reg) => [chunk(OpCode.OP_LDR, { value: index, reg1: reg, reg2: _reg })]);
  }

  private dataGetInstruction(dataOffset: number, y: (reg: Register) => CodeChunk[]) {
    // const register = this.adapter.registers.get(reg);
    // // console.log("data get", register, reg, dataOffset);
    // if (!register)
    //   return this.getRegister(reg, { dataOffset, stackOffset: undefined }).dataGetDirectInstruction(reg, dataOffset);

    // return this.getRegister(reg, { dataOffset, stackOffset: undefined });
    return this.update((c) => {
      const x = c.adapter.dataGet(dataOffset, (reg, rest) => [...rest, ...y(reg)]);
      return c.pushChunk(...x);
    });
  }

  private stackSetInstruction(reg: Register, index: number) {
    // const register = this.adapter.registers.get(reg);
    // console.log("stack set", reg, index, this.context.registers, register);
    return this.setRegister(reg, { stackOffset: index, dataOffset: undefined });
    // .update(
    //   (c) => (console.log("stack set 2", c.context.registers), c)
    // );
  }

  private stackGetInstruction(reg: Register, index: number) {
    const register = this.adapter.registers.get(reg);
    // console.log("stack get", this.context.registers, register, reg, index);
    if (!register)
      return this.getRegister(reg, { stackOffset: index, dataOffset: undefined }).stackGetDirectInstruction(reg, index);

    return this.getRegister(reg, { stackOffset: index, dataOffset: undefined });
  }

  private stackPushInstruction(reg: Register) {
    return this.stackPush().stackSetInstruction(reg, this.adapter.stack.size());
  }

  private stackPopInstruction(reg: Register) {
    // console.log("stack pop", reg);

    return this.stackGetInstruction(reg, this.adapter.stack.size() - 1).stackPop();
  }

  private setStackBaseInstruction(stackSize: number) {
    if (stackSize === 0) return this;
    // const reg1 = this.findRegister("data", 0);
    const trimmedSize = stackSize & 0x1f;
    const imm = signExtend(trimmedSize, 5) === stackSize;

    return this.dataGetInstruction(0, (reg1) => {
      if (imm) {
        return [chunk(OpCode.OP_ADD, { reg1, reg2: reg1, value: stackSize })];
      }
      const dataOffset = this.context.data.length;
      return this.adapter.dataGet(dataOffset, (reg2, rest) => [
        ...rest,
        chunk(OpCode.OP_ADD, { reg1, reg2, reg3: reg1 }),
      ]);
    }).update((c) => {
      if (imm) {
        return c;
      }
      return c.pushData([stackSize]);
    });
  }

  private pushStackFrameInstruction() {
    return this.update((c) => {
      return c.pushChunk(
        ...c.adapter.pushStackFrame((x) => {
          const dataOffset = c.context.data.length;
          c = c.pushData([x]);
          return dataOffset;
        })
      );
    });
  }

  private popStackFrameInstruction() {
    return this.update((c) => {
      return c.pushChunk(
        ...c.adapter.popStackFrame((x) => {
          const dataOffset = c.context.data.length;
          c = c.pushData([x]);
          return dataOffset;
        })
      );
    });
  }

  /**
   * in `[..., retAddr, arg, fnAddr]`
   *
   * out `[..., retValue]`
   */
  private callInstruction(returnAddrChunkIndex: number) {
    const reg = this.findRegister("stackPop");
    // console.log("call", reg);

    const compiled = this.stackPopInstruction(reg) // pop fn address, is consumed by operator
      .allocateRegisters(reg)
      .writeBackAllRegisters() // write back fn address
      .stackPop() // pop argument, so it will be consumed by function
      .stackPop() // pop return address, so it will be consumed by function
      .pushStackFrameInstruction()
      .pushChunk(chunk(OpCode.OP_JMP, { reg1: reg }));
    compiled.context.chunks[returnAddrChunkIndex].value = compiled.context.chunks.length - 1 - returnAddrChunkIndex;

    return compiled.popStackFrameInstruction();
  }

  /**
   * in `[..., arg1, arg2]`
   *
   * out `[..., arg1 + arg2]`
   */
  private addInstruction() {
    const reg1 = this.findRegister("stackPop");
    const reg2 = this.allocateRegisters(reg1).stackPop().findRegister("stackPop");
    // console.log("add", reg1, reg2);

    return this.allocateRegisters(reg1, reg2)
      .stackPopInstruction(reg1)
      .stackPopInstruction(reg2)
      .pushChunk(chunk(OpCode.OP_ADD, { reg1, reg2, reg3: reg2 }))
      .freeRegisters(reg1)
      .stackPushInstruction(reg2)
      .freeRegisters(reg2);
    // .update((c) => {
    //   console.log("add 2", c.context.registers);
    //   return c;
    // });
  }

  /**
   * in `[...]`
   *
   * out `[..., value]`
   */
  private pushConstantInstruction(value: number) {
    const dataOffset = this.context.data.length;
    const reg = this.findRegister("data", dataOffset);
    return this.pushData([value])
      .pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset }))
      .stackPushInstruction(reg);
  }

  private pushDataPointerInstruction(dataOffset: number) {
    const reg = this.findRegister("data", dataOffset);
    return this.pushChunk(chunk(OpCode.OP_LD, { reg1: reg, dataOffset })).stackPushInstruction(reg);
  }

  private pushFunctionPointerInstruction(functionOffset: number) {
    const reg = this.findRegister();
    return this.pushChunk(chunk(OpCode.OP_LEA, { reg1: reg, functionOffset })).stackPushInstruction(reg);
  }

  /**
   * Copy value from reg1 to reg2
   */
  private copyInstruction(fromReg: Register, toReg: Register) {
    return this.pushChunk(chunk(OpCode.OP_ADD, { reg1: fromReg, reg2: toReg, value: 0 }));
  }

  /**
   * Copy stack value from index and push onto stack
   */
  private copyStackInstruction(index: number) {
    const reg = this.findRegister("stack", index);
    return this.stackGetInstruction(reg, index).allocateRegisters(reg).stackPushInstruction(reg).freeRegisters(reg);
  }

  private stackSwapInstruction(index1: number, index2: number) {
    const reg1 = this.findRegister("stack", index1);
    const reg2 = this.allocateRegisters(reg1).findRegister("stack", index2);
    // console.log("swap", index1, index2);

    return (
      this.stackGetInstruction(reg1, index1)
        .allocateRegisters(reg1)
        .stackGetInstruction(reg2, index2)
        .allocateRegisters(reg2)
        .update((c) => {
          c.adapter.registers.update(reg1, { stackOffset: index2 });
          c.adapter.registers.update(reg2, { stackOffset: index1 });
          c.adapter.registers.stale(reg1);
          c.adapter.registers.stale(reg2);

          // console.log("swap 2", c.context.registers);

          return c;
        })
        // .stackSetInstruction(reg2, index1)
        // .stackSetInstruction(reg1, index2)
        .freeRegisters(reg1, reg2)
    );
  }

  /**
   * in `[..., value, returnAddr]`
   *
   * out `[..., value]`
   */
  private returnInstruction() {
    const reg = this.findRegister("stackPop");
    // console.log("return", reg, this.context.registers, this.adapter.stack.size());

    return this.stackPopInstruction(reg) // pop return address
      .allocateRegisters(reg)
      .writeBackAllRegisters() // write back rest of stack
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
        const stackSize = this.adapter.stack.size();
        return this.compileToChunks(ast.children[0]).update((c) => {
          const newSize = c.adapter.stack.size();
          const toDrop = newSize - (stackSize + 1);
          return c.stackSwapInstruction(stackSize, newSize - 1).stackDrop(toDrop);
        });
      }
    } else if (ast.name === "operator") {
      if (ast.value === "->" || ast.value === "fn") {
        const body = ast.children[1];
        const codeIndex = this.context.chunks.length;
        const dataIndex = this.context.data.length;
        // console.log("fn", this.context.registers);

        const compiledBody = this.resetStack()
          .stackPush() // return address stack slot
          .update((c) => {
            // argument stack slot
            const name = ast.children[0];
            if (name.name === "placeholder") return c.stackPush();
            return c.stackAdd(name.value);
          })
          .compileToChunks(body)
          .update((c) => {
            const size = c.adapter.stack.size();
            return c
              .stackSwapInstruction(size - 1, size - 3) // swap return value and address
              .stackSwapInstruction(size - 1, size - 2); // swap argument and address
          })
          .stackPop() // pop argument
          .returnInstruction();
        // console.log("fn 2", this.context.registers);

        return this.pushFunctionChunk(compiledBody.context.chunks.slice(codeIndex))
          .pushData(...compiledBody.context.data.slice(dataIndex))
          .pushFunctionPointerInstruction(this.context.functionChunks.length);
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];
        const reg = this.findRegister();
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
            chunk(OpCode.OP_LD, { stackOffset: this.adapter.stack.size(), reg1: Register.R_R0 }),
            chunk(OpCode.OP_LD, { stackOffset: this.adapter.stack.size() + 1, reg1: Register.R_R1 }),
            chunk(OpCode.OP_ST, { stackOffset: this.adapter.stack.size(), reg1: Register.R_R2 })
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
      const value = this.adapter.stack.get({ name });
      if (value === undefined) {
        return this;
      }
      // console.log("name", name, value, reg);

      return this.copyStackInstruction(value.index);
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

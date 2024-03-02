import { Scope } from "../scope";
import { CopySymbol, copy } from "../utils/copy";
import { OpCode } from "../vm/handlers";
import { Register, signExtend } from "../vm/utils";
import { CodeChunk, chunk } from "./chunks";
import { RegisterState } from "./registers";

type StackEntryValue = { offset: number; size: number };

type RegisterReference = {
  dataOffset?: number;
  stackOffset?: number;
};

export class InstructionFactory {
  registers = new RegisterState<RegisterReference>(8);
  stack: Scope<StackEntryValue> = new Scope();
  stackFrames: Scope[] = [];

  constructor(public pushData: (x: number[]) => number, public pushChunks: (...chunks: CodeChunk[]) => void) {}

  [CopySymbol]() {
    return this.copyAdapter();
  }

  copyAdapter() {
    const copied = new InstructionFactory(this.pushData, this.pushChunks);
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

  push(chunks: Register | ((reg: Register) => CodeChunk[])): CodeChunk[] {
    const index = this.stack.size();
    this.stack = this.stack.push({ offset: 0, size: 1 });
    return this.set(index, chunks);
  }

  pop(chunks: Register | ((reg: Register) => CodeChunk[])): CodeChunk[] {
    const index = this.stack.size() - 1;
    const res = this.get(index, chunks);
    this.stack = this.stack.removeByIndex(index);
    return res;
  }

  get(index: number, chunks: Register | ((reg: Register) => CodeChunk[])): CodeChunk[] {
    if (typeof chunks === "number") {
      const reg = chunks;
      const _chunks = this.writeBack(reg);

      if (!this.registers.get(reg) || this.registers.get(reg)?.value.stackOffset !== index) {
        _chunks.push(...this.dataGet(0, (reg2) => [chunk(OpCode.LOAD_REG, { value: index, reg1: reg!, reg2 })]));
        this.registers.set(reg, { stackOffset: index });
        this.registers.synced(reg);
      }

      return _chunks;
    }

    let reg = this.findRegister("stack", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }

    if (!this.registers.get(reg) || this.registers.get(reg)?.value.stackOffset !== index) {
      _chunks.push(...this.dataGet(0, (reg2) => [chunk(OpCode.LOAD_REG, { value: index, reg1: reg!, reg2 })]));
      this.registers.set(reg, { stackOffset: index });
      this.registers.synced(reg);
    }

    this.registers.allocate(reg);
    _chunks.push(...chunks(reg));
    this.registers.free(reg);

    return _chunks;
  }

  set(index: number, chunks: Register | ((reg: Register) => CodeChunk[])): CodeChunk[] {
    if (typeof chunks === "number") {
      const reg = chunks;
      const _chunks = this.writeBack(reg);

      this.registers.set(reg, { stackOffset: index });

      return _chunks;
    }

    let reg = this.findRegister("stack", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }
    this.registers.set(reg, { stackOffset: index });

    this.registers.allocate(reg);
    _chunks.push(...chunks(reg));
    this.registers.free(reg);

    return _chunks;
  }

  insert(index: number, chunks: Register | ((reg: Register) => CodeChunk[])): CodeChunk[] {
    const _chunks = this.push(chunks);

    for (let i = this.stack.size() - 1; i > index; i--) {
      _chunks.push(...this.swap(i, i - 1));
    }

    return _chunks;
  }

  swap(index1: number, index2: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    chunks.push(
      ...this.get(index1, (reg1) =>
        this.get(index2, (reg2) => {
          this.registers.update(reg1, { stackOffset: index2 });
          this.registers.update(reg2, { stackOffset: index1 });
          this.registers.stale(reg1);
          this.registers.stale(reg2);
          return [];
        })
      )
    );
    return chunks;
  }

  copy(index: number) {
    return this.get(index, (reg2) => this.push((reg1) => [chunk(OpCode.ADD, { reg1, reg2, value: 0 })]));
  }

  replace(index: number) {
    return this.set(index, (reg1) => this.pop((reg2) => [chunk(OpCode.ADD, { reg1, reg2, value: 0 })]));
  }

  add(): CodeChunk[] {
    return this.pop((reg1) => this.pop((reg2) => this.push((reg3) => [chunk(OpCode.ADD, { reg1, reg2, reg3 })])));
  }

  call(): CodeChunk[] {
    const chunks = [
      ...this.insert(this.stack.size() - 3, Register.R_R0),
      chunk(OpCode.LOAD_EFFECTIVE_ADDRESS, { reg1: Register.R_R0, value: 0 }),
    ];
    this.registers.allocate(Register.R_R0);

    chunks.push(...this.get(this.stack.size() - 3, Register.R_R1));
    this.registers.allocate(Register.R_R1);

    chunks.push(
      ...this.pop((reg1) => [
        ...this.writeBack(),
        ...this.pushStackFrame(),
        chunk(OpCode.JUMP, { reg1 }),
        ...this.popStackFrame(),
      ])
    );

    chunks[0].value = chunks.length;

    this.registers.free(Register.R_R1);

    chunks.push(...this.push(Register.R_R0));
    this.registers.free(Register.R_R0);

    return chunks;
  }

  yield(): CodeChunk[] {
    return this.call();
  }

  return(): CodeChunk[] {
    // move the return value to R_R0
    // and jump to the return address
    return [...this.get(0, Register.R_R0), ...this.pop((reg1) => [chunk(OpCode.JUMP, { reg1 })])];
  }

  entry(closureSize: number): CodeChunk[] {
    const chunks = [];

    this.stack.push({ offset: 0, size: 1 }); // return address
    this.stack.push({ offset: 0, size: 1 }); // argument
    this.stack.push({ offset: 0, size: closureSize }); // closure

    // expect R0 and R1 to be already occupied by the return address and the argument
    this.registers.set(Register.R_R0, { stackOffset: 0 });
    this.registers.set(Register.R_R1, { stackOffset: 1 });

    return chunks;
  }

  dataGet(index: number, chunks: Register | ((reg: Register) => CodeChunk[])): CodeChunk[] {
    if (typeof chunks === "number") {
      const reg = chunks;
      const _chunks = this.writeBack(reg);

      if (!this.registers.get(reg) || this.registers.get(reg)?.value.dataOffset !== index) {
        _chunks.push(chunk(OpCode.LOAD, { reg1: reg, dataOffset: index }));
        this.registers.set(reg, { dataOffset: index });
        this.registers.synced(reg);
      }

      return _chunks;
    }

    let reg = this.findRegister("data", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }
    // console.log("data get", index, reg, transformRegisterState(this.registers.state));

    if (!this.registers.get(reg) || this.registers.get(reg)?.value.dataOffset !== index) {
      _chunks.push(chunk(OpCode.LOAD, { reg1: reg, dataOffset: index }));
      this.registers.set(reg, { dataOffset: index });
      this.registers.synced(reg);
    }

    this.registers.allocate(reg);
    _chunks.push(...chunks(reg));
    this.registers.free(reg);

    // console.log("data get end", index, reg, transformRegisterState(this.registers.state));
    return _chunks;
  }

  dataSet(index: number, chunks: Register | ((reg: Register) => CodeChunk[])): CodeChunk[] {
    if (typeof chunks === "number") {
      const reg = chunks;
      const _chunks = this.writeBack(reg);

      this.registers.set(reg, { dataOffset: index });

      return _chunks;
    }

    let reg = this.findRegister("data", index);
    const _chunks: CodeChunk[] = [];
    if (!reg) {
      reg = this.findRegister();

      _chunks.push(...this.writeBack(reg));
    }
    this.registers.set(reg, { dataOffset: index });

    this.registers.allocate(reg);
    _chunks.push(...chunks(reg));
    this.registers.free(reg);

    return _chunks;
  }

  writeBack(register?: Register): CodeChunk[] {
    return this.registers.state.flatMap((x, reg) => {
      if (!x) return [];
      if (!x.stale) return [];
      if (register !== undefined && register !== reg) return [];

      const { dataOffset, stackOffset } = x.value;
      this.registers.synced(reg);
      if (dataOffset !== undefined) return [chunk(OpCode.STORE, { reg1: reg, dataOffset })];
      if (stackOffset !== undefined)
        return this.dataGet(0, (reg2) => [chunk(OpCode.STORE_REG, { value: stackOffset, reg1: reg, reg2 })]);
      return [];
    });
  }

  pushStackFrame(): CodeChunk[] {
    const stackSize = this.stack.size();
    this.stackFrames.push(this.stack);
    this.stack = new Scope();
    this.registers.clear();
    return this.updateStackBase(stackSize);
  }

  popStackFrame(): CodeChunk[] {
    this.stack = this.stackFrames.pop()!;
    return this.updateStackBase(-this.stack.size());
  }

  updateStackBase(stackSize: number): CodeChunk[] {
    if (stackSize === 0) return [];
    const trimmedSize = stackSize & 0x1f;
    const imm = signExtend(trimmedSize, 5) === stackSize;

    if (imm) {
      return this.dataSet(0, (reg1) => [chunk(OpCode.ADD, { reg1, reg2: reg1, value: stackSize })]);
    }
    return this.dataGet(this.pushData([stackSize]), (reg1) =>
      this.dataSet(0, (reg2) => [chunk(OpCode.ADD, { reg1, reg2, reg3: reg1 })])
    );
  }
}

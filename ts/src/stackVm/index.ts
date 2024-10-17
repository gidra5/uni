import { assert } from "../utils";
import { handlers } from "./handlers";
import { decode, Instruction, StackValue } from "./instructions";

export class VM {
  stack: StackValue[] = []; // stack of values
  pc = 0;
  sb = 0;

  pop(): StackValue {
    assert(this.sb < this.stack.length);
    const v = this.stack.pop();
    assert(v !== undefined);
    return v;
  }

  get(index: number): StackValue {
    assert(this.sb < index);
    const v = this.stack[index];
    assert(v !== undefined);
    return v;
  }

  getFromBase(index: number): StackValue {
    return this.get(this.sb + index);
  }

  getRelative(index: number): StackValue {
    return this.get(this.stack.length - 1 - index);
  }

  async run(code: Instruction[]) {
    this.pc = 0;

    while (this.pc < code.length) {
      const instr = code[this.pc];
      await this.executeInstruction(instr);
      this.pc++;
    }
  }

  async runImage(image: Uint8Array) {
    const instructions = decode(image);
    await this.run(instructions);
  }

  async executeInstruction(instr: Instruction) {
    await handlers[instr.code](this, instr);
  }
}

import { VM } from ".";
import { assert } from "../utils";
import { Instruction, InstructionCode } from "./instructions";

export const handlers: Record<InstructionCode, (vm: VM, instr: Instruction) => void | Promise<void>> = {
  [InstructionCode.PUSH]: (vm, instr) => {
    assert(instr.code === InstructionCode.PUSH);
    vm.stack.push(Number(instr.value));
  },
  [InstructionCode.POP]: (vm, instr) => {
    assert(instr.code === InstructionCode.POP);
    if (vm.sb === vm.stack.length) return;
    vm.stack.pop();
  },
  [InstructionCode.GET]: (vm, instr) => {
    assert(instr.code === InstructionCode.GET);
    const index = vm.pop();
    const value = vm.getRelative(index);
    vm.stack.push(value);
  },
  [InstructionCode.SET]: (vm, instr) => {
    assert(instr.code === InstructionCode.SET);
    const index = vm.pop();
    const value = vm.pop();
    vm.stack[index] = value;
  },
  [InstructionCode.SWAP]: (vm, instr) => {
    assert(instr.code === InstructionCode.SWAP);
    const index1 = vm.pop();
    const index2 = vm.pop();
    if (index1 === index2) return;
    [vm.stack[index1], vm.stack[index2]] = [vm.getRelative(index2), vm.getRelative(index1)];
  },
  [InstructionCode.INSERT]: (vm, instr) => {
    assert(instr.code === InstructionCode.INSERT);
    const index = vm.pop();
    const value = vm.pop();
    vm.stack.splice(index, 0, value);
  },
  [InstructionCode.REMOVE]: (vm, instr) => {
    assert(instr.code === InstructionCode.REMOVE);
    const index = vm.pop();
    vm.stack.splice(index, 1);
  },
  [InstructionCode.PUSH_FRAME]: (vm, instr) => {
    assert(instr.code === InstructionCode.PUSH_FRAME);
    vm.stack.push(vm.sb);
    vm.sb = vm.stack.length;
  },
  [InstructionCode.POP_FRAME]: (vm, instr) => {
    assert(instr.code === InstructionCode.POP_FRAME);
    const sb = vm[vm.sb - 1];
    vm.stack.splice(vm.sb);
    vm.sb = sb;
  },

  [InstructionCode.JUMP_RELATIVE]: (vm, instr) => {
    assert(instr.code === InstructionCode.JUMP_RELATIVE);
    const offset = vm.pop();
    vm.pc += offset;
  },
  [InstructionCode.JUMP_ABSOLUTE]: (vm, instr) => {
    assert(instr.code === InstructionCode.JUMP_ABSOLUTE);
    const address = vm.pop();
    vm.pc = address;
  },

  [InstructionCode.ENTRY_POINT]: (vm, instr) => {},
  [InstructionCode.CALL]: (vm, instr) => {
    assert(instr.code === InstructionCode.CALL);
    const arg = vm.pop();
    const address = vm.pop();
    vm.stack.push(vm.pc);
    vm.stack.push(arg);
    vm.pc = address;
  },
  [InstructionCode.RETURN]: (vm, instr) => {
    assert(instr.code === InstructionCode.RETURN);
    const value = vm.pop();
    const pc = vm.pop();
    vm.pc = pc;
    vm.stack.push(value);
  },

  [InstructionCode.ADD]: (vm, instr) => {
    assert(instr.code === InstructionCode.ADD);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a + b);
  },
  [InstructionCode.SUB]: (vm, instr) => {
    assert(instr.code === InstructionCode.SUB);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a - b);
  },
  [InstructionCode.MUL]: (vm, instr) => {
    assert(instr.code === InstructionCode.MUL);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a * b);
  },
  [InstructionCode.DIV]: (vm, instr) => {
    assert(instr.code === InstructionCode.DIV);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a / b);
  },
  [InstructionCode.MOD]: (vm, instr) => {
    assert(instr.code === InstructionCode.MOD);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a % b);
  },
  [InstructionCode.POW]: (vm, instr) => {
    assert(instr.code === InstructionCode.POW);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a ** b);
  },
  [InstructionCode.SHL]: (vm, instr) => {
    assert(instr.code === InstructionCode.SHL);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a << b);
  },
  [InstructionCode.SHR]: (vm, instr) => {
    assert(instr.code === InstructionCode.SHR);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a >> b);
  },

  [InstructionCode.AND]: (vm, instr) => {
    assert(instr.code === InstructionCode.AND);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a & b);
  },
  [InstructionCode.OR]: (vm, instr) => {
    assert(instr.code === InstructionCode.OR);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a | b);
  },
  [InstructionCode.XOR]: (vm, instr) => {
    assert(instr.code === InstructionCode.XOR);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(a ^ b);
  },
  [InstructionCode.NOT]: (vm, instr) => {
    assert(instr.code === InstructionCode.NOT);
    const a = vm.pop();
    vm.stack.push(~a);
  },
  [InstructionCode.EQ]: (vm, instr) => {
    assert(instr.code === InstructionCode.EQ);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(Number(a === b));
  },
  [InstructionCode.LT]: (vm, instr) => {
    assert(instr.code === InstructionCode.LT);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(Number(a < b));
  },
  [InstructionCode.GT]: (vm, instr) => {
    assert(instr.code === InstructionCode.GT);
    const b = vm.pop();
    const a = vm.pop();
    vm.stack.push(Number(a > b));
  },
};

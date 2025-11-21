import { assert } from "../utils/index.js";
import type { Thread, VM } from "./index.js";
import { Instruction, InstructionCode } from "./instructions.js";

const popNumber = (thread: Thread) => {
  const value = thread.pop();
  assert(typeof value === "number", "vm2 expected numeric value");
  return value;
};

export const handlers: Record<InstructionCode, (vm: VM, thread: Thread, instr: Instruction) => boolean | void> = {
  [InstructionCode.Const]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Const);
    thread.push(instr.arg1);
  },
  [InstructionCode.Add]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Add);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a + b);
  },
  [InstructionCode.Sub]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Sub);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a - b);
  },
  [InstructionCode.Mul]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Mul);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a * b);
  },
  [InstructionCode.Div]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Div);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a / b);
  },
  [InstructionCode.Mod]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Mod);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a % b);
  },
  [InstructionCode.Pow]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Pow);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a ** b);
  },
  [InstructionCode.And]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.And);
    const b = thread.pop();
    const a = thread.pop();
    thread.push(Boolean(a) && Boolean(b));
  },
  [InstructionCode.Or]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Or);
    const b = thread.pop();
    const a = thread.pop();
    thread.push(Boolean(a) || Boolean(b));
  },
  [InstructionCode.Not]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Not);
    const a = thread.pop();
    thread.push(!a);
  },
  [InstructionCode.Eq]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Eq);
    const b = thread.pop();
    const a = thread.pop();
    thread.push(a === b);
  },
  [InstructionCode.Gt]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Gt);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a > b);
  },
  [InstructionCode.Alloc]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Alloc);
    thread.alloc(instr.arg1);
  },
  [InstructionCode.Free]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Free);
    thread.free(instr.arg1);
  },
  [InstructionCode.Call]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Call);
    thread.callFunction(instr.arg1, instr.arg2 ?? 0);
    return false;
  },
  [InstructionCode.Return]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Return);
    thread.returnFromFunction();
    return false;
  },
  [InstructionCode.Jump]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Jump);
    thread.jump(instr.arg1);
    return false;
  },
  [InstructionCode.Native]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Native);
    thread.callNative(instr.arg1, instr.arg2 ?? 0);
  },
};

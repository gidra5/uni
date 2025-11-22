import { generateVm2Bytecode } from "../codegen/vm/index.js";
import { handlers } from "./handlers.js";
import { mergeNatives } from "./natives.js";
import { FunctionCode, Instruction, InstructionCode, Program, Value } from "./instructions.js";
import { assert, nextId } from "../utils/index.js";

export type NativeHandler = (vm: VM, args: Value[]) => Value | void;

type HeapEntry = Value;
type StackEntry = Value;
type CallStackEntry = {
  ip: number;
  functionName: string;
  stack: StackEntry[];
};

type VMOptions = {
  natives?: Record<string, NativeHandler>;
  entry?: string;
};

export class Thread {
  id: string;
  stack: StackEntry[] = [];
  callStack: CallStackEntry[] = [];
  handlersStack: { ip: number; functionName: string }[] = [];

  ip = 0;
  functionName: string;

  constructor(private vm: VM, id: string, entryFunction: string) {
    this.id = id;
    this.functionName = entryFunction;
  }

  push(value: Value) {
    this.stack.push(value);
  }

  pop(): Value {
    assert(this.stack.length > 0, "vm2 stack underflow");
    return this.stack.pop() as Value;
  }

  jump(address: number) {
    this.ip = address;
  }

  callFunction(functionName: string, argCount: number, caller?: CallStackEntry) {
    assert(this.vm.code[functionName], `vm2: missing function "${functionName}"`);
    const args = this.stack.splice(this.stack.length - argCount, argCount);
    const returnFrame =
      caller ??
      ({
        ip: this.ip + 1,
        functionName: this.functionName,
        stack: this.stack,
      } satisfies CallStackEntry);
    this.callStack.push(returnFrame);
    this.stack = args;
    this.functionName = functionName;
    this.ip = 0;
  }

  callNative(name: string, argCount: number) {
    const native = this.vm.natives[name];
    assert(native, `Unknown native function: ${name}`);

    const args: Value[] = [];
    for (let i = 0; i < argCount; i++) args.unshift(this.pop());

    const result = native(this.vm, args);
    const valueToPush = result === undefined ? args[args.length - 1] : result;
    if (valueToPush !== undefined) this.push(valueToPush);
  }

  returnFromFunction() {
    if (this.callStack.length === 0) return;

    const returnValue = this.stack.length > 0 ? this.pop() : undefined;
    const frame = this.callStack.pop()!;

    this.stack = frame.stack ?? [];
    if (returnValue !== undefined) this.push(returnValue);

    this.functionName = frame.functionName;
    this.ip = frame.ip;
  }

  step() {
    const instructions = this.vm.getFunction(this.functionName);

    if (this.ip < 0 || this.ip >= instructions.length) {
      this.callStack = [];
      this.stack = [];
      return;
    }

    const instr = instructions[this.ip];
    const handler = handlers[instr.code];
    assert(handler, `vm2: missing handler for instruction ${InstructionCode[instr.code]}`);

    const shouldAdvance = handler(this.vm, this, instr) ?? true;
    if (this.callStack.length > 0 && shouldAdvance) this.ip++;
  }
}

export class VM {
  heap: Record<string, HeapEntry> = {};
  threads = new Map<string, Thread>();
  atoms = new Map<string, Value>();

  code: Program = {};
  natives: Record<string, NativeHandler>;

  constructor(options?: VMOptions) {
    this.natives = mergeNatives(options?.natives);
  }

  addProgram(name: string, program: Program) {
    for (const [codeName, code] of Object.entries(program)) {
      this.addCode(`${name}:${codeName}`, code);
    }
  }

  addCode(name: string, code: FunctionCode) {
    this.code[name] = code;
  }

  alloc(value: Value) {
    const name = String(nextId());
    this.heap[name] = value;
    return { ref: name };
  }

  free(name: string) {
    delete this.heap[name];
  }

  createSymbol(name?: string, isAtom = false): Value {
    if (isAtom) {
      const key = name ?? "";
      if (!this.atoms.has(key)) this.atoms.set(key, { symbol: `atom:${key}`, name });
      return this.atoms.get(key)!;
    }

    const id = nextId();
    return { symbol: id, name };
  }

  spawnThread(functionName: string, id: string): Thread {
    const thread = new Thread(this, id, functionName);
    this.threads.set(thread.id, thread);
    thread.callFunction(functionName, 0, { ip: -1, functionName, stack: [] });
    return thread;
  }

  run(name = "main") {
    const mainThread = this.spawnThread(name, "main");

    let active = this.activeThreads();
    while (active.length > 0) {
      for (const thread of active) {
        thread.step();
      }
      active = this.activeThreads();
    }

    return mainThread?.stack[mainThread.stack.length - 1];
  }

  private activeThreads() {
    return [...this.threads.values()].filter((thread) => thread.callStack.length > 0);
  }

  getFunction(functionName: string): Instruction[] {
    const instructions = this.code[functionName];
    assert(instructions, `vm2: missing function "${functionName}"`);
    return instructions;
  }
}

export { InstructionCode, generateVm2Bytecode };
export type { Instruction, Program, Value };

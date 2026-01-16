import { generateVm2Bytecode } from "../codegen/vm/index.js";
import { handlers, resumeContinuation } from "./handlers.js";
import { mergeNatives } from "./natives.js";
import {
  Closure,
  ClosureEnv,
  ContinuationFrame,
  ContinuationState,
  FunctionCode,
  HandlerEntry,
  Instruction,
  InstructionCode,
  Program,
  Value,
} from "./instructions.js";
import { assert, nextId } from "../utils/index.js";

export type NativeHandler = (vm: VM, args: Value[]) => Value | void;
export type EffectHandle = {
  threadId: string;
  effect: Value;
  arg: Value;
  continuation: ContinuationState;
};

type HeapEntry = Value;
type StackEntry = Value;
type CallStackEntry = ContinuationFrame;

type VMOptions = {
  natives?: Record<string, NativeHandler>;
  ambientHandlers?: Record<string, Closure>;
};

const isHeapRef = (ref: string) => ref.startsWith("_ref");

type ChannelSender = { thread: Thread; value: Value };
type ChannelReceiver = { thread: Thread };
type ChannelState = { id: string; name?: string; senders: ChannelSender[]; receivers: ChannelReceiver[] };

export class Thread {
  id: string;
  stack: StackEntry[] = [];
  callStack: CallStackEntry[] = [];
  handlersStack: HandlerEntry[] = [];
  env: ClosureEnv = { values: {} };
  blockedChannel?: string;
  blockedEffect?: EffectHandle;

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

  private findEnv(ref: string) {
    let env: ClosureEnv | undefined = this.env;
    while (env) {
      if (ref in env.values) return env;
      env = env.parent;
    }
    return undefined;
  }

  loadRef(ref: string) {
    if (isHeapRef(ref)) return this.vm.heap[ref];
    const env = this.findEnv(ref);
    if (env) return env.values[ref];
    return this.vm.heap[ref];
  }

  storeRef(ref: string, value: Value) {
    if (isHeapRef(ref)) {
      this.vm.heap[ref] = value;
      return;
    }
    const env = this.findEnv(ref) ?? this.env;
    env.values[ref] = value;
  }

  storeRefLocal(ref: string, value: Value) {
    if (isHeapRef(ref)) {
      this.vm.heap[ref] = value;
      return;
    }
    this.env.values[ref] = value;
  }

  jump(address: number) {
    this.ip = address;
  }

  callFunction(functionName: string, argCount: number, caller?: CallStackEntry, parentEnv?: ClosureEnv) {
    assert(this.vm.code[functionName], `vm2: missing function "${functionName}"`);
    assert(this.stack.length >= argCount, `vm2: expected ${argCount} args, got ${this.stack.length}`);
    const args = this.stack.splice(this.stack.length - argCount, argCount);
    const returnFrame =
      caller ??
      ({
        ip: this.ip + 1,
        functionName: this.functionName,
        stack: this.stack,
        env: this.env,
      } satisfies CallStackEntry);
    this.callStack.push(returnFrame);
    this.stack = args;
    this.env = { values: {}, parent: parentEnv ?? this.env };
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

    if (frame.handlersStack) this.handlersStack = frame.handlersStack;

    this.env = frame.env;
    this.functionName = frame.functionName;
    this.ip = frame.ip;
    if (frame.callStack) this.callStack = frame.callStack;
  }

  step() {
    if (this.blockedChannel || this.blockedEffect) return;

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
  channels = new Map<string, ChannelState>();
  ambientHandlers: Record<string, Closure> = {};

  code: Program = {};
  natives: Record<string, NativeHandler>;

  constructor(options?: VMOptions) {
    this.natives = mergeNatives(options?.natives);
    if (options?.ambientHandlers) this.ambientHandlers = options.ambientHandlers;
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

  createChannel(name?: string): Value {
    const id = `_chan${nextId()}`;
    const state: ChannelState = { id, name, senders: [], receivers: [] };
    this.channels.set(id, state);
    return { channel: id, name };
  }

  getChannel(value: { channel: string; name?: string }): ChannelState {
    const state = this.channels.get(value.channel);
    if (state) return state;

    const created: ChannelState = { id: value.channel, name: value.name, senders: [], receivers: [] };
    this.channels.set(value.channel, created);
    return created;
  }

  spawnThread(functionName: string, id: string, parentEnv?: ClosureEnv): Thread {
    const thread = new Thread(this, id, functionName);
    this.threads.set(thread.id, thread);
    thread.callFunction(functionName, 0, { ip: -1, functionName, stack: [], env: thread.env }, parentEnv);
    return thread;
  }

  run(name = "main") {
    const mainThread = this.spawnThread(name, "main");

    return this.runUntilBlocked(mainThread);
  }

  private activeThreads() {
    return [...this.threads.values()].filter(
      (thread) => thread.callStack.length > 0 && !thread.blockedEffect && !thread.blockedChannel
    );
  }

  private findBlockedEffect() {
    const mainThread = this.threads.get("main");
    if (mainThread?.blockedEffect) return mainThread.blockedEffect;
    for (const thread of this.threads.values()) {
      if (thread.blockedEffect) return thread.blockedEffect;
    }
    return undefined;
  }

  private runUntilBlocked(mainThread?: Thread) {
    let active = this.activeThreads();
    while (active.length > 0) {
      for (const thread of active) {
        thread.step();
        const blocked = this.findBlockedEffect();
        if (blocked) return blocked;
      }
      active = this.activeThreads();
    }

    const blocked = this.findBlockedEffect();
    if (blocked) return blocked;

    const thread = mainThread ?? this.threads.get("main");
    return thread?.stack[thread.stack.length - 1];
  }

  handleEffect(handle: EffectHandle, value: Value) {
    const thread = this.threads.get(handle.threadId);
    assert(thread, `vm2: missing thread "${handle.threadId}"`);
    assert(thread.blockedEffect === handle, "vm2: effect handle not pending");
    thread.blockedEffect = undefined;
    resumeContinuation(thread, handle.continuation, value);
    return this.runUntilBlocked();
  }

  getFunction(functionName: string): Instruction[] {
    const instructions = this.code[functionName];
    assert(instructions, `vm2: missing function "${functionName}"`);
    return instructions;
  }
}

export { InstructionCode, generateVm2Bytecode };
export type { Instruction, Program, Value };

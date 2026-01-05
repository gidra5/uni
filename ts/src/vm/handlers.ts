import { assert } from "../utils/index.js";
import type { Thread, VM } from "./index.js";
import { Closure, Instruction, InstructionCode, type SymbolValue, type Value } from "./instructions.js";
import { nextId } from "../utils/index.js";

const popNumber = (thread: Thread) => {
  const value = thread.pop();
  assert(typeof value === "number", "vm2 expected numeric value");
  return value;
};

const normalizeKey = (value: Value) => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (isSymbol(value)) {
    const sym = value;
    return typeof sym.symbol === "string" ? sym.symbol : `symbol:${sym.symbol}`;
  }
  if (isChannel(value)) {
    return `channel:${value.channel}`;
  }
  if (value && typeof value === "object" && "thread" in value) return `thread:${value.thread}`;
  if (value && typeof value === "object" && "ref" in value) return String(value.ref);
  return String(value);
};

const isTuple = (value: Value): value is { tuple: Value[] } =>
  typeof value === "object" && value !== null && "tuple" in value;

const isRecord = (value: Value): value is { record: Record<string, Value> } =>
  typeof value === "object" && value !== null && "record" in value;

const isSymbol = (value: Value): value is SymbolValue =>
  typeof value === "object" && value !== null && "symbol" in value;

const isAtom = (value: Value): value is SymbolValue =>
  isSymbol(value) && typeof value.symbol === "string" && value.symbol.startsWith("atom:");

const isClosure = (value: Value): value is Closure =>
  typeof value === "object" && value !== null && "functionName" in value && "env" in value;

const isChannel = (value: Value): value is { channel: string; name?: string } =>
  typeof value === "object" && value !== null && "channel" in value;

const isThreadHandle = (value: Value): value is { thread: string } =>
  typeof value === "object" && value !== null && "thread" in value;

const stringify = (value: Value): string => {
  if (isAtom(value)) return `:${value.name ?? value.symbol}`;
  if (isSymbol(value)) return `symbol(${value.name ?? value.symbol})`;
  if (isChannel(value)) return `channel(${value.name ?? value.channel})`;
  if (isThreadHandle(value)) return `thread(${value.thread})`;
  if (isTuple(value)) return `(${value.tuple.map(stringify).join(",")})`;
  if (isRecord(value)) return "[object Record]";
  return String(value);
};

const getRef = (value: Value): string => {
  assert(typeof value === "object" && value !== null && "ref" in value, "vm2 expected reference");
  return (value as { ref: string }).ref;
};

const deepEqual = (a: Value, b: Value): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return a === b;

  if (isSymbol(a) && isSymbol(b)) {
    return a.symbol === b.symbol;
  }
  if (isChannel(a) && isChannel(b)) {
    return a.channel === b.channel;
  }

  if (isTuple(a) && isTuple(b)) {
    return a.tuple.length === b.tuple.length && a.tuple.every((item, index) => deepEqual(item, b.tuple[index]));
  }

  if (isRecord(a) && isRecord(b)) {
    const keysA = Object.keys(a.record);
    const keysB = Object.keys(b.record);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a.record[key], b.record[key]));
  }

  return false;
};

const resumeBlockedThread = (thread: Thread, channelId: string, value: Value) => {
  assert(thread.blockedChannel === channelId, "vm2: thread not blocked on expected channel");
  thread.blockedChannel = undefined;
  if (value) thread.push(value);
  thread.ip++;
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
    const b = thread.pop() as Value;
    const a = thread.pop() as Value;
    if (isSymbol(a) && isSymbol(b)) {
      thread.push(a.symbol === b.symbol);
      return;
    }
    thread.push(a === b);
  },
  [InstructionCode.DeepEq]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.DeepEq);
    const b = thread.pop() as Value;
    const a = thread.pop() as Value;
    thread.push(deepEqual(a, b));
  },
  [InstructionCode.Gt]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Gt);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a > b);
  },
  [InstructionCode.Lt]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Lt);
    const b = popNumber(thread);
    const a = popNumber(thread);
    thread.push(a < b);
  },
  [InstructionCode.Alloc]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Alloc);
    const value = thread.pop();
    const ref = `_ref${nextId()}`;
    _vm.heap[ref] = value;
    thread.push({ ref });
  },
  [InstructionCode.Free]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Free);
    const ref = getRef(thread.pop());
    vm.free(ref);
  },
  [InstructionCode.Load]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Load);
    const ref = getRef(thread.pop());
    thread.push(thread.loadRef(ref));
  },
  [InstructionCode.Store]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Store);
    const ref = getRef(thread.pop());
    const value = thread.pop();
    thread.storeRef(ref, value);
  },
  [InstructionCode.Tuple]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Tuple);
    const values: Value[] = [];
    for (let i = 0; i < instr.arg1; i++) values.unshift(thread.pop() as Value);
    thread.push({ tuple: values });
  },
  [InstructionCode.Record]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Record);
    const record: Record<string, Value> = {};
    for (let i = 0; i < instr.arg1; i++) {
      const value = thread.pop() as Value;
      const key = normalizeKey(thread.pop());
      record[key] = value;
    }
    thread.push({ record });
  },
  [InstructionCode.In]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.In);
    const collection = thread.pop() as Value;
    const item = thread.pop() as Value;
    let result = false;

    if (isTuple(collection)) {
      result = collection.tuple.some((x) => deepEqual(x, item));
    } else if (isRecord(collection)) {
      result = Object.prototype.hasOwnProperty.call(collection.record, normalizeKey(item));
    }

    thread.push(result);
  },
  [InstructionCode.Concat]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Concat);
    const b = thread.pop();
    const a = thread.pop();
    thread.push(stringify(a) + stringify(b));
  },
  [InstructionCode.Length]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Length);
    const value = thread.pop();
    if (isTuple(value)) {
      thread.push(value.tuple.length);
      return;
    }
    if (typeof value === "string") {
      thread.push(value.length);
      return;
    }
    throw new Error("vm2: Length expects tuple or string");
  },
  [InstructionCode.Index]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Index);
    const index = popNumber(thread);
    const collection = thread.pop() as Value;
    if (isTuple(collection)) {
      thread.push(collection.tuple[index]);
      return;
    }
    if (typeof collection === "string") {
      thread.push(collection[index]);
      return;
    }
    throw new Error("vm2: Index expects tuple or string");
  },
  [InstructionCode.Append]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Append);
    const collection = thread.pop() as Value;
    const value = thread.pop() as Value;
    if (isTuple(collection)) {
      thread.push({ tuple: [...collection.tuple, value] });
      return;
    }
    throw new Error("vm2: Append expects tuple");
  },
  [InstructionCode.Call]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Call);
    const argCount = instr.arg2 ?? 0;
    if (instr.arg1) {
      thread.callFunction(instr.arg1, argCount);
      return false;
    }

    const callee = thread.pop();
    assert(isClosure(callee), "vm2: expected callable value");
    thread.callFunction(callee.functionName, argCount, undefined, callee.env);
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
  [InstructionCode.JumpIfFalse]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.JumpIfFalse);
    const cond = thread.pop();
    if (!cond) {
      thread.jump(instr.arg1);
      return false;
    }
  },
  [InstructionCode.Native]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Native);
    thread.callNative(instr.arg1, instr.arg2 ?? 0);
  },
  [InstructionCode.Closure]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Closure);
    thread.push({ functionName: instr.arg1, env: thread.env });
  },
  [InstructionCode.Send]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Send);
    const value = thread.pop();
    const channelValue = thread.pop();
    assert(isChannel(channelValue), "vm2: expected channel for send");
    const channel = vm.getChannel(channelValue);

    const receiver = channel.receivers.shift();
    if (receiver) {
      resumeBlockedThread(receiver.thread, channel.id, value);
      return;
    }

    channel.senders.push({ thread, value });
    thread.blockedChannel = channel.id;
    return false;
  },
  [InstructionCode.Receive]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Receive);
    const channelValue = thread.pop();
    assert(isChannel(channelValue), "vm2: expected channel for receive");
    const channel = vm.getChannel(channelValue);

    const sender = channel.senders.shift();
    if (sender) {
      resumeBlockedThread(sender.thread, channel.id, sender.value);
      return;
    }

    channel.receivers.push({ thread });
    thread.blockedChannel = channel.id;
    return false;
  },
  [InstructionCode.TrySend]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.TrySend);
    const value = thread.pop();
    const channelValue = thread.pop();
    assert(isChannel(channelValue), "vm2: expected channel for try send");
    const channel = vm.getChannel(channelValue);

    const receiver = channel.receivers.shift();
    if (receiver) {
      resumeBlockedThread(receiver.thread, channel.id, value);
      thread.push(true);
      return;
    }

    thread.push(false);
  },
  [InstructionCode.TryReceive]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.TryReceive);
    const channelValue = thread.pop();
    assert(isChannel(channelValue), "vm2: expected channel for try receive");
    const channel = vm.getChannel(channelValue);

    const sender = channel.senders.shift();
    if (sender) {
      resumeBlockedThread(sender.thread, channel.id, { tuple: [true, sender.value] });
      return;
    }

    thread.push({ tuple: [false, null] });
  },
  [InstructionCode.Fork]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Fork);
    const closure = thread.pop();
    assert(isClosure(closure), "vm2: expected callable value for async");

    const id = `thread_${nextId()}`;
    vm.spawnThread(closure.functionName, id, closure.env);
    thread.push({ thread: id });
  },
  [InstructionCode.Join]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Join);
    const handle = thread.pop();
    if (!isThreadHandle(handle)) {
      thread.push(handle);
      return;
    }

    const target = vm.threads.get(handle.thread);
    assert(target, `vm2: missing thread "${handle.thread}"`);

    if (target.callStack.length > 0) {
      thread.push(handle);
      return false;
    }

    const result = target.stack[target.stack.length - 1];
    thread.push(result);
  },
};

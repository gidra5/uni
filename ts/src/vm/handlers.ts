import { assert } from "../utils/index.js";
import type { Thread, VM } from "./index.js";
import {
  Closure,
  ContinuationState,
  HandlerEntry,
  type ClosureEnv,
  Instruction,
  InstructionCode,
  type SymbolValue,
  type Value,
} from "./instructions.js";
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

const isContinuation = (value: Value): value is { continuation: ContinuationState } =>
  typeof value === "object" && value !== null && "continuation" in value;

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

const cloneEnv = (env: ClosureEnv, envMap: Map<ClosureEnv, ClosureEnv>): ClosureEnv => {
  const existing = envMap.get(env);
  if (existing) return existing;

  const cloned: ClosureEnv = { values: {}, parent: undefined };
  envMap.set(env, cloned);
  cloned.parent = env.parent ? cloneEnv(env.parent, envMap) : undefined;
  for (const [key, value] of Object.entries(env.values)) {
    cloned.values[key] = cloneValue(value, envMap);
  }
  return cloned;
};

const cloneClosure = (closure: Closure, envMap: Map<ClosureEnv, ClosureEnv>): Closure => ({
  functionName: closure.functionName,
  env: cloneEnv(closure.env, envMap),
});

const cloneHandlerEntry = (entry: HandlerEntry, envMap: Map<ClosureEnv, ClosureEnv>): HandlerEntry => {
  if (entry.kind === "mask" || entry.kind === "without") {
    return { ...entry };
  }
  const handlers: Record<string, Closure> = {};
  for (const [key, value] of Object.entries(entry.handlers)) {
    assert(isClosure(value), "vm2: expected handler closure");
    handlers[key] = cloneClosure(value, envMap);
  }
  return { kind: "handlers", handlers, returnHandler: cloneClosure(entry.returnHandler, envMap) };
};

const cloneValue = (value: Value, envMap: Map<ClosureEnv, ClosureEnv>): Value => {
  if (isClosure(value)) return cloneClosure(value, envMap);
  if (isTuple(value)) return { tuple: value.tuple.map((item) => cloneValue(item, envMap)) };
  if (isRecord(value)) {
    const record: Record<string, Value> = {};
    for (const [key, entry] of Object.entries(value.record)) {
      record[key] = cloneValue(entry, envMap);
    }
    return { record };
  }
  return value;
};

const cloneContinuationState = (state: ContinuationState): ContinuationState => {
  const envMap = new Map<ClosureEnv, ClosureEnv>();
  const cloneFrame = (frame: ContinuationState["callStack"][number]): ContinuationState["callStack"][number] => ({
    ip: frame.ip,
    functionName: frame.functionName,
    stack: frame.stack.map((value) => cloneValue(value, envMap)),
    env: cloneEnv(frame.env, envMap),
    handlersStack: frame.handlersStack
      ? frame.handlersStack.map((entry) => cloneHandlerEntry(entry, envMap))
      : undefined,
    callStack: frame.callStack ? frame.callStack.map(cloneFrame) : undefined,
  });
  return {
    functionName: state.functionName,
    ip: state.ip,
    stack: state.stack.map((value) => cloneValue(value, envMap)),
    callStack: state.callStack.map(cloneFrame),
    env: cloneEnv(state.env, envMap),
    handlersStack: state.handlersStack.map((entry) => cloneHandlerEntry(entry, envMap)),
    blockedChannel: state.blockedChannel,
  };
};

export const captureContinuationState = (thread: Thread, ip: number): ContinuationState => {
  const envMap = new Map<ClosureEnv, ClosureEnv>();
  const captureFrame = (frame: ContinuationState["callStack"][number]): ContinuationState["callStack"][number] => ({
    ip: frame.ip,
    functionName: frame.functionName,
    stack: frame.stack.map((value) => cloneValue(value, envMap)),
    env: cloneEnv(frame.env, envMap),
    handlersStack: frame.handlersStack
      ? frame.handlersStack.map((entry) => cloneHandlerEntry(entry, envMap))
      : undefined,
    callStack: frame.callStack ? frame.callStack.map(captureFrame) : undefined,
  });
  return {
    functionName: thread.functionName,
    ip,
    stack: thread.stack.map((value) => cloneValue(value, envMap)),
    callStack: thread.callStack.map(captureFrame),
    env: cloneEnv(thread.env, envMap),
    handlersStack: thread.handlersStack.map((entry) => cloneHandlerEntry(entry, envMap)),
    blockedChannel: thread.blockedChannel,
  };
};

export const resumeContinuation = (thread: Thread, continuation: ContinuationState, value: Value) => {
  const state = cloneContinuationState(continuation);
  thread.functionName = state.functionName;
  thread.ip = state.ip;
  thread.stack = state.stack;
  thread.callStack = state.callStack;
  thread.env = state.env;
  thread.handlersStack = state.handlersStack;
  thread.blockedChannel = state.blockedChannel;
  thread.push(value);
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
  [InstructionCode.StoreLocal]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.StoreLocal);
    const ref = getRef(thread.pop());
    const value = thread.pop();
    thread.storeRefLocal(ref, value);
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
  [InstructionCode.SetHandle]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.SetHandle);
    const returnHandlerValue = thread.pop();
    const handlersValue = thread.pop();
    assert(isRecord(handlersValue), "vm2: expected handlers record");
    assert(isClosure(returnHandlerValue), "vm2: expected return handler closure");

    const returnHandlerKey = "atom:return_handler";
    const fallbackReturnHandler = returnHandlerValue;
    let resolvedReturnHandler: Closure | undefined = undefined;

    const handlers: Record<string, Closure> = {};
    for (const [key, value] of Object.entries(handlersValue.record)) {
      if (key === returnHandlerKey || key === "return_handler") {
        if (isClosure(value)) resolvedReturnHandler = value;
        continue;
      }
      assert(isClosure(value), "vm2: expected handler closure");
      handlers[key] = value;
    }

    thread.handlersStack.push({
      kind: "handlers",
      handlers,
      returnHandler: resolvedReturnHandler ?? fallbackReturnHandler,
    });
  },
  [InstructionCode.Mask]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Mask);
    const effect = thread.pop();
    const key = normalizeKey(effect);
    thread.handlersStack.push({ kind: "mask", key });
  },
  [InstructionCode.MaskEnd]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.MaskEnd);
    const entry = thread.handlersStack.pop();
    if (!entry) return;
    assert(entry.kind === "mask", "vm2: expected mask entry");
  },
  [InstructionCode.Without]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Without);
    const effect = thread.pop();
    const key = normalizeKey(effect);
    thread.handlersStack.push({ kind: "without", key });
  },
  [InstructionCode.WithoutEnd]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.WithoutEnd);
    const entry = thread.handlersStack.pop();
    if (!entry) return;
    assert(entry.kind === "without", "vm2: expected without entry");
  },
  [InstructionCode.EmitEffect]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.EmitEffect);
    const arg = thread.pop();
    const effect = thread.pop();
    const key = normalizeKey(effect);

    let matchedEntry: HandlerEntry | undefined;
    let matchedHandler: Closure | undefined;
    let skipCount = 0;
    let blocked = false;

    for (let i = thread.handlersStack.length - 1; i >= 0; i--) {
      const entry = thread.handlersStack[i];
      if (entry.kind === "mask") {
        if (entry.key === key) skipCount++;
        continue;
      }
      if (entry.kind === "without") {
        if (entry.key === key) {
          blocked = true;
          break;
        }
        continue;
      }
      const handlerValue = entry.handlers[key];
      if (!handlerValue) continue;
      if (skipCount > 0) {
        skipCount--;
        continue;
      }
      matchedEntry = entry;
      matchedHandler = handlerValue;
      break;
    }

    if (blocked || !matchedEntry) {
      if (!blocked) {
        const ambient = vm.ambientHandlers[key];
        if (ambient) {
          const continuation = captureContinuationState(thread, thread.ip + 1);
          thread.push({ continuation });
          thread.push(arg);
          thread.callFunction(ambient.functionName, 2, undefined, ambient.env);
          return false;
        }
      }
      const continuation = captureContinuationState(thread, thread.ip + 1);
      thread.blockedEffect = { threadId: thread.id, effect, arg, continuation };
      return false;
    }

    assert(matchedHandler && matchedEntry?.kind === "handlers", "vm2: expected handler closure");

    const continuation = captureContinuationState(thread, thread.ip + 1);

    thread.push({ continuation });
    thread.push(arg);
    thread.callFunction(
      matchedHandler.functionName,
      2,
      {
        ip: thread.ip + 1,
        functionName: thread.functionName,
        stack: thread.stack,
        env: thread.env,
      },
      matchedHandler.env
    );
    return false;
  },
  [InstructionCode.ReturnHandler]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.ReturnHandler);
    const value = thread.pop();
    const entry = thread.handlersStack.pop();
    if (!entry || entry.kind !== "handlers") {
      thread.push(value);
      return;
    }
    thread.push(value);
    thread.callFunction(entry.returnHandler.functionName, 1, undefined, entry.returnHandler.env);
    return false;
  },
  [InstructionCode.Call]: (_vm, thread, instr) => {
    assert(instr.code === InstructionCode.Call);
    const argCount = instr.argCount ?? 0;
    if (instr.fnName) {
      thread.callFunction(instr.fnName, argCount);
      return false;
    }

    const callee = thread.pop();
    if (isContinuation(callee)) {
      assert(argCount === 1, "vm2: continuation expects a single argument");
      const value = thread.pop();
      const returnFrame = {
        ip: thread.ip + 1,
        functionName: thread.functionName,
        stack: thread.stack,
        env: thread.env,
        handlersStack: thread.handlersStack,
        callStack: thread.callStack,
      };
      const state = cloneContinuationState(callee.continuation);
      const baseLength = state.handlersStack.length;
      const extraHandlers = thread.handlersStack.slice(baseLength);
      thread.functionName = state.functionName;
      thread.ip = state.ip;
      thread.stack = state.stack;
      thread.callStack = [...state.callStack, returnFrame];
      thread.env = state.env;
      thread.handlersStack = [...state.handlersStack, ...extraHandlers];
      thread.blockedChannel = state.blockedChannel;
      thread.push(value);
      return false;
    }
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
  [InstructionCode.Spawn]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Spawn);
    const closure = thread.pop();
    assert(isClosure(closure), "vm2: expected callable value for async");

    const id = `thread_${nextId()}`;
    vm.spawnThread(closure.functionName, id, closure.env);
    thread.push({ thread: id });
  },
  [InstructionCode.Fork]: (vm, thread, instr) => {
    assert(instr.code === InstructionCode.Fork);
    const closure = thread.pop();
    assert(isClosure(closure), "vm2: expected callable value for async");

    const id = `thread_${nextId()}`;
    const forked = vm.spawnThread(closure.functionName, id, closure.env);
    forked.handlersStack = thread.handlersStack.map((frame) => ({ ...frame }));
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

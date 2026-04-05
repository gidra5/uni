import type { CompileContext, EvalContext } from './evaluate/index.js';
import { Position } from './position.js';
import { assert, inspect } from './utils.js';
import { SystemError } from './error.js';
import { Environment } from './environment.js';

export type CallSite = [Position, EvalContext, CompileContext];
export type EvalFunction = (
  callSite: CallSite,
  arg: EvalValue
) => Promise<EvalValue>;
type EvalSymbol = symbol;

export type EvalRecord = Map<EvalValue, EvalValue>;

type EvalChannel = EvalSymbol;
type EvalEvent = EvalSymbol;
export type EvalEffect = {
  effect: EvalValue;
  value: EvalValue;
  env: Environment;
  continuations: EvalFunction[];
};
type EvalHandler = {
  handler: EvalFunction;
};
export type EvalPrototype = { prototypes: EvalRecord[]; value: EvalValue };

export type EvalValue =
  | number
  | string
  | boolean
  | null
  | EvalValue[]
  | EvalFunction
  | EvalSymbol
  | EvalRecord
  | EvalChannel
  | EvalEvent
  | EvalEffect
  | EvalPrototype
  | EvalHandler;

type ChannelReceiver = {
  resolve: (v: EvalValue | null) => void;
  reject: (e: unknown) => void;
};
type ChannelMessage = {
  resolve: () => void;
  value: EvalValue | Error;
};
type Channel = {
  closed?: boolean;
  queue: Array<ChannelReceiver | ChannelMessage>;
};
export type RuntimeResourceStats = {
  channels: number;
  channelQueueEntries: number;
  events: number;
  eventListeners: number;
  liveTasks: number;
  pendingTasks: number;
  settledTasks: number;
};
export enum ChannelStatus {
  Empty = 'empty',
  Pending = 'pending',
  Queued = 'queued',
  Closed = 'closed',
}

export const fn = (
  n: number,
  f: (
    callSite: CallSite,
    ...args: EvalValue[]
  ) => EvalValue | Promise<EvalValue>
): EvalFunction => {
  return async (callSite, arg) => {
    if (n === 1) return await f(callSite, arg);
    return fn(n - 1, async (callSite, ...args) => f(callSite, arg, ...args));
  };
};

const atoms = new Map<string, symbol>();

export const symbol = (): EvalSymbol => Symbol();
export const atom = (name: string): EvalSymbol => {
  if (!atoms.has(name)) atoms.set(name, Symbol(name));
  return atoms.get(name)!;
};

export const prototyped = (
  value: EvalValue,
  prototypes: EvalRecord[]
): EvalPrototype => {
  return { value, prototypes };
};

export function isChannel(
  channelValue: EvalValue
): channelValue is EvalChannel {
  return (
    !!channelValue &&
    typeof channelValue === 'symbol' &&
    channelValue in channels
  );
}

export function isRecord(recordValue: unknown): recordValue is EvalRecord {
  return !!recordValue && recordValue instanceof Map;
}

export function isSymbol(symbolValue: EvalValue): symbolValue is EvalSymbol {
  return !!symbolValue && typeof symbolValue === 'symbol';
}

export function isEffect(value: EvalValue): value is EvalEffect {
  return !!value && typeof value === 'object' && 'effect' in value;
}

export function isHandler(value: EvalValue): value is EvalHandler {
  return !!value && typeof value === 'object' && 'handler' in value;
}

export function isPrototyped(value: EvalValue): value is EvalPrototype {
  return !!value && typeof value === 'object' && 'prototypes' in value;
}

const channels: Record<symbol, Channel> = {};

const disposeChannel = (channelSymbol: symbol) => {
  const channel = channels[channelSymbol];
  if (!channel) return;
  delete channels[channelSymbol];
};

export const channelStatus = (c: symbol): ChannelStatus => {
  const channel = channels[c];
  if (!channel) return ChannelStatus.Closed;

  if (channel.queue.length > 0) {
    const head = channel.queue[0];
    if ('value' in head) return ChannelStatus.Pending;
    else return ChannelStatus.Queued;
  }
  if (channel.closed) return ChannelStatus.Closed;

  return ChannelStatus.Empty;
};

export const createChannel = (name = 'channel'): EvalChannel => {
  const channel = Symbol(name);
  channels[channel] = {
    closed: false,
    queue: [],
  };
  return channel;
};

export const closeChannel = (c: symbol) => {
  const status = channelStatus(c);
  if (status === ChannelStatus.Closed) throw new Error('channel closed');
  const channel = channels[c]!;
  channel.closed = true;

  while (channel.queue.length > 0) {
    const head = channel.queue[0]!;
    if ('value' in head) break;
    const receiver = channel.queue.shift()! as ChannelReceiver;
    receiver.reject(new Error('channel closed'));
  }
};

export const getChannel = (c: symbol) => {
  return channels[c];
};

export const send = (
  c: symbol,
  value: EvalValue | Error
): [ChannelStatus, Promise<void>] => {
  const status = channelStatus(c);

  if (status === ChannelStatus.Queued) {
    const receiver = channels[c].queue.shift()! as ChannelReceiver;
    if (value instanceof Error) receiver.reject(value);
    else receiver.resolve(value);
    return [status, Promise.resolve()];
  }

  if (status !== ChannelStatus.Closed) {
    const p = new Promise<void>((resolve) => {
      channels[c].queue.push({ resolve, value });
    });

    return [status, p];
  }

  throw new Error('channel closed');
};

export const receive = async (c: symbol): Promise<EvalValue> => {
  const [value, status] = tryReceive(c);
  if (status === ChannelStatus.Pending) {
    if (value instanceof Error) throw value;
    return value;
  }
  if (status === ChannelStatus.Closed) throw new Error('channel closed');

  return new Promise((resolve, reject) => {
    channels[c].queue.push({ resolve, reject });
  });
};

export const tryReceive = (c: symbol): [EvalValue | Error, ChannelStatus] => {
  const status = channelStatus(c);

  if (status === ChannelStatus.Pending) {
    const { value, resolve } = channels[c].queue.shift()! as ChannelMessage;
    resolve();
    return [value, status];
  }

  return [null, status];
};

type _Event = {
  closed: boolean;
  disposableWhenClosed: boolean;
  listeners: EvalFunction[];
  emit: (cs: CallSite, value: EvalValue) => Promise<void>;
  subscribe: (listener: EvalFunction) => EvalFunction;
};
const events = new Map<symbol, _Event>();

const cleanupEvent = (event: symbol) => {
  const entry = events.get(event);
  if (!entry) return;
  if (!entry.closed) return;
  if (entry.listeners.length !== 0) return;
  if (!entry.disposableWhenClosed) return;
  events.delete(event);
};

const setEventClosed = (event: symbol, dispose: boolean) => {
  const entry = events.get(event);
  if (!entry || entry.closed) throw new Error('event closed');
  entry.closed = true;
  entry.disposableWhenClosed = dispose;
  entry.listeners.length = 0;
  if (dispose) cleanupEvent(event);
};

const disposeEvent = (event: symbol) => {
  const entry = events.get(event);
  if (!entry) return;
  entry.disposableWhenClosed = true;
  cleanupEvent(event);
};

export const createEvent = (name: string = 'event'): EvalEvent => {
  const listeners: Array<EvalFunction> = [];
  const event = Symbol(name);
  events.set(event, {
    closed: false,
    disposableWhenClosed: true,
    listeners,
    async emit(cs, v) {
      for (const listener of listeners) await listener(cs, v);
    },
    subscribe(listener) {
      assert(typeof listener === 'function', 'expected function');
      listeners.push(listener);
      return async () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
        cleanupEvent(event);
        return null;
      };
    },
  });
  return event;
};

export const isEvent = (event: EvalValue): event is EvalEvent => {
  return !!event && typeof event === 'symbol' && events.has(event);
};

export const isEventClosed = (event: EvalValue): boolean => {
  if (!event || typeof event !== 'symbol') throw new Error('expected event');
  return events.get(event)?.closed ?? true;
};

export const closeEvent = (event: EvalValue) => {
  if (!event || typeof event !== 'symbol') throw new Error('expected event');
  setEventClosed(event, true);
};

export const onceEvent = (event: EvalValue, f: EvalFunction) => {
  const unsubscribe = subscribeEvent(event, async (cs, v) => {
    await f(cs, v);
    await unsubscribe(cs, null);
    return null;
  });
  return unsubscribe;
};

export const emitEvent = async (
  cs: CallSite,
  event: EvalValue,
  value: EvalValue
) => {
  if (!event || typeof event !== 'symbol') throw new Error('expected event');
  const entry = events.get(event);
  if (!entry || entry.closed) throw new Error('event closed');
  await entry.emit(cs, value);
};

export const subscribeEvent = (event: EvalValue, listener: EvalFunction) => {
  if (!event || typeof event !== 'symbol') throw new Error('expected event');
  const entry = events.get(event);
  if (!entry || entry.closed) throw new Error('event closed');
  return entry.subscribe(listener);
};

export const nextEvent = (event: EvalValue) => {
  return new Promise<EvalValue>((resolve) =>
    onceEvent(event, async (ca, v) => {
      resolve(v);
      return null;
    })
  );
};

export type EvalTask = [taskAwait: EvalChannel, taskCancel: EvalEvent];

type TaskState = {
  settled: boolean;
  listeners: Set<() => void>;
};

const liveTasks = new Set<EvalTask>();
const taskStates = new WeakMap<EvalTask, TaskState>();

const getTaskState = (task: EvalTask): TaskState => {
  const state = taskStates.get(task);
  assert(state, 'task state missing');
  return state;
};

const markTaskSettled = (task: EvalTask) => {
  const state = getTaskState(task);
  if (state.settled) return;
  state.settled = true;
  for (const listener of state.listeners) listener();
  state.listeners.clear();
};

export const isTask = (task: EvalValue): task is EvalTask => {
  return (
    !!task &&
    Array.isArray(task) &&
    task.length === 2 &&
    isChannel(task[0]) &&
    isEvent(task[1])
  );
};

export const createTask = (
  cs: CallSite,
  f: () => Promise<EvalValue>
): EvalTask => {
  const awaitChannel = createChannel('task await');
  const cancelEvent = createEvent('task cancel');
  const task: EvalTask = [awaitChannel, cancelEvent];
  taskStates.set(task, {
    settled: false,
    listeners: new Set(),
  });
  liveTasks.add(task);
  let status = 'pending';

  const unsub = onceEvent(cancelEvent, async (cs) => {
    if (status === 'resolved') return null;
    status = 'cancelled';
    send(awaitChannel, null);
    closeChannel(awaitChannel);
    setEventClosed(cancelEvent, false);
    markTaskSettled(task);
    return null;
  });

  f().then(
    (value) => {
      if (status === 'cancelled') return;
      status = 'resolved';
      unsub(cs, null);
      send(awaitChannel, value);
      closeChannel(awaitChannel);
      if (!isEventClosed(cancelEvent)) setEventClosed(cancelEvent, false);
      markTaskSettled(task);
    },
    (e) => {
      if (status === 'cancelled') return;
      status = 'resolved';
      unsub(cs, null);
      send(awaitChannel, e);
      closeChannel(awaitChannel);
      if (!isEventClosed(cancelEvent)) setEventClosed(cancelEvent, false);
      markTaskSettled(task);
    }
  );

  return task;
};

export const isTaskSettled = (task: EvalTask): boolean => {
  return getTaskState(task).settled;
};

export const onTaskSettled = (task: EvalTask, listener: () => void) => {
  const state = getTaskState(task);
  if (state.settled) {
    listener();
    return () => {};
  }
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
};

export const cancelTask = async (cs: CallSite, task: EvalTask) => {
  if (!isEvent(task[1]) || isEventClosed(task[1])) return null;
  await emitEvent(cs, task[1], null);

  return null;
};

export const awaitTask = async (task: EvalTask): Promise<EvalValue> => {
  const taskAwait = task[0];
  const value = await receive(taskAwait);
  disposeChannel(taskAwait);
  disposeEvent(task[1]);
  liveTasks.delete(task);
  return value;
};

export const getRuntimeResourceStats = (): RuntimeResourceStats => {
  const channelSymbols = Object.getOwnPropertySymbols(channels);
  const eventEntries = [...events.values()];
  let pendingTasks = 0;
  for (const task of liveTasks) {
    if (!isTaskSettled(task)) pendingTasks += 1;
  }
  return {
    channels: channelSymbols.length,
    channelQueueEntries: channelSymbols.reduce((total, channelSymbol) => {
      return total + (channels[channelSymbol]?.queue.length ?? 0);
    }, 0),
    events: events.size,
    eventListeners: eventEntries.reduce((total, event) => {
      return total + event.listeners.length;
    }, 0),
    liveTasks: liveTasks.size,
    pendingTasks,
    settledTasks: liveTasks.size - pendingTasks,
  };
};

export const fileHandle = (file: EvalRecord): EvalRecord => {
  return createRecord({
    write: async (cs, data) => {
      const [position, _, compileContext] = cs;
      const fileId = compileContext.fileId;
      const writeErrorFactory = SystemError.invalidArgumentType(
        'all',
        { args: [['data', 'string']], returns: 'void' },
        position
      );
      assert(typeof data === 'string', writeErrorFactory(0).withFileId(fileId));
      const write = recordGet(file, atom('write'));
      assert(typeof write === 'function', 'expected write to be a function');
      await write(cs, data);
      return null;
    },
  });
};

export const createSet = (values: EvalValue[]): EvalRecord => {
  const set = new Set(values);
  return createRecord({
    add: async (cs, value) => {
      const [position, _, compileContext] = cs;
      const fileId = compileContext.fileId;
      const addErrorFactory = SystemError.invalidArgumentType(
        'add',
        { args: [['value', 'a']], returns: 'void' },
        position
      );
      assert(typeof value === 'string', addErrorFactory(0).withFileId(fileId));
      set.add(value);
      return null;
    },
    values: async () => [...set.values()],
  });
};

export const createRecord = (
  values: Record<PropertyKey, EvalValue> | Array<[EvalValue, EvalValue]> = {}
): EvalRecord => {
  if (Array.isArray(values)) return new Map(values);
  const keys = [
    ...Object.getOwnPropertyNames(values),
    ...Object.getOwnPropertySymbols(values),
  ];
  const entries: [EvalValue, EvalValue][] = keys.map((k) => [
    typeof k === 'string' ? atom(k) : k,
    values[k],
  ]);
  return new Map(entries);
};

export const recordGet = (record: EvalRecord, key: EvalValue): EvalValue => {
  return record.get(key) ?? null;
};

export const recordSet = (
  record: EvalRecord,
  key: EvalValue,
  value: EvalValue
) => {
  record.set(key, value);
};

export const recordDelete = (record: EvalRecord, key: EvalValue) => {
  record.delete(key);
};

export const recordMerge = (
  record: EvalRecord,
  other: EvalRecord
): EvalRecord => {
  return new Map([...record, ...other]);
};

export const recordOmit = (
  record: EvalRecord,
  keys: EvalValue[]
): EvalRecord => {
  return new Map([...record.entries()].filter(([key]) => !keys.includes(key)));
};

export const recordHas = (record: EvalRecord, key: EvalValue): boolean => {
  return record.has(key);
};

export const createEffect = (
  effect: EvalValue,
  value: EvalValue,
  env: Environment,
  continuations: EvalFunction[] = [
    // async (cs, v) => {
    //   showPos(cs[0], cs[1], `effect ${String(effect)} ${String(value)}`);
    //   return v;
    // },
  ]
): EvalEffect => ({ effect, value, env, continuations });

export const createHandler = (handler: EvalFunction): EvalHandler => ({
  handler,
});

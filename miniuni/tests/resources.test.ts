import { beforeEach, describe, expect, it } from 'vitest';
import { FileMap } from 'codespan-napi';
import { addFile } from '../src/files.ts';
import { Environment } from '../src/environment.ts';
import {
  compileScript,
  newCompileContext,
  newContext,
  type CompileContext,
  type EvalContext,
} from '../src/evaluate/index.ts';
import { Injectable, register } from '../src/injector.ts';
import { parseScript } from '../src/parser.ts';
import { Position } from '../src/position.ts';
import { parseTokens } from '../src/tokens.ts';
import {
  awaitTask,
  cancelTask,
  channelStatus,
  ChannelStatus,
  closeChannel,
  closeEvent,
  createChannel,
  createEvent,
  createTask,
  emitEvent,
  getRuntimeResourceStats,
  receive,
  subscribeEvent,
  type CallSite,
  type EvalValue,
} from '../src/values.ts';

const ROOT_DIR = '/runtime_resource_tests';

const evaluate = async (input: string): Promise<EvalValue> => {
  const file = `${ROOT_DIR}/index.uni`;
  const fileId = addFile(file, input);
  const compileContext = newCompileContext(fileId, file);
  const tokens = parseTokens(input);
  const ast = parseScript(tokens);
  const compiled = compileScript(ast, compileContext);
  return await compiled(newContext());
};

const TEST_POSITION: Position = { start: 0, end: 0 };
const createCallSite = (): CallSite => {
  const context: EvalContext = { env: new Environment() };
  const compileContext: CompileContext = {
    file: '<runtime-resource-test>',
    fileId: 0,
  };
  return [TEST_POSITION, context, compileContext];
};

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.RootDir, ROOT_DIR);
});

describe('runtime resource cleanup', () => {
  it('event unsubscribe removes listeners and closed events leave no registry entries', async () => {
    const baseline = getRuntimeResourceStats();
    const cs = createCallSite();
    const event = createEvent('cleanup event');
    let calls = 0;

    const unsubscribe = subscribeEvent(event, async () => {
      calls += 1;
      return null;
    });

    await unsubscribe(cs, null);
    await emitEvent(cs, event, 123);
    closeEvent(event);

    expect(calls).toBe(0);
    expect(getRuntimeResourceStats()).toEqual(baseline);
  });

  it('closing a channel rejects queued receivers and keeps the closed status observable', async () => {
    const baseline = getRuntimeResourceStats();
    const channel = createChannel('cleanup channel');
    const pending = receive(channel);

    expect(channelStatus(channel)).toBe(ChannelStatus.Queued);

    closeChannel(channel);

    await expect(pending).rejects.toThrow('channel closed');
    expect(channelStatus(channel)).toBe(ChannelStatus.Closed);
    expect(getRuntimeResourceStats()).toEqual({
      ...baseline,
      channels: baseline.channels + 1,
    });
  });

  it('completed tasks release their await and cancel resources after await', async () => {
    const baseline = getRuntimeResourceStats();
    const cs = createCallSite();
    const task = createTask(cs, async () => 123);

    await expect(awaitTask(task)).resolves.toBe(123);
    await cancelTask(cs, task);

    expect(getRuntimeResourceStats()).toEqual(baseline);
  });

  it('tracks live tasks until they are awaited', async () => {
    const baseline = getRuntimeResourceStats();
    const cs = createCallSite();
    let resolveTask: ((value: EvalValue) => void) | null = null;
    const task = createTask(
      cs,
      () =>
        new Promise((resolve) => {
          resolveTask = resolve;
        })
    );

    expect(getRuntimeResourceStats()).toEqual({
      ...baseline,
      channels: baseline.channels + 1,
      eventListeners: baseline.eventListeners + 1,
      events: baseline.events + 1,
      liveTasks: baseline.liveTasks + 1,
      pendingTasks: baseline.pendingTasks + 1,
      settledTasks: baseline.settledTasks,
    });

    resolveTask!(123);
    await Promise.resolve();

    expect(getRuntimeResourceStats()).toEqual({
      ...baseline,
      channelQueueEntries: baseline.channelQueueEntries + 1,
      channels: baseline.channels + 1,
      events: baseline.events + 1,
      liveTasks: baseline.liveTasks + 1,
      pendingTasks: baseline.pendingTasks,
      settledTasks: baseline.settledTasks + 1,
    });

    await expect(awaitTask(task)).resolves.toBe(123);
    expect(getRuntimeResourceStats()).toEqual(baseline);
  });

  it('sync drains completed async children without leaving runtime resources behind', async () => {
    const baseline = getRuntimeResourceStats();
    const result = await evaluate(`
      import "std/concurrency" as { sync }

      sync {
        async { 1 }
        async { 2 }
        async { 3 }
        123
      }
    `);

    expect(result).toBe(123);
    expect(getRuntimeResourceStats()).toEqual(baseline);
  });

  it('cancel_on_return drains cancelled child tasks without leaving runtime resources behind', async () => {
    const baseline = getRuntimeResourceStats();
    const result = await evaluate(`
      import "std/concurrency" as { cancel_on_return, some, wait }

      cancel_on_return {
        some (
          | { wait 10; 1 }
          | { wait 50; 2 }
        )
      }
    `);

    expect(result).toBe(1);
    expect(getRuntimeResourceStats()).toEqual(baseline);
  });
});

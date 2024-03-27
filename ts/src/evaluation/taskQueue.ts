import { type Value } from "./types";

type ConsumerTask = { task: (val: Value) => void; channel: symbol };
type PureTask = { task: () => void };
type Task = ConsumerTask | PureTask;
export class TaskQueue {
  private queue: Task[] = [];
  private blocked: ConsumerTask[] = [];
  private channels: Record<symbol, Value> = {};

  createTask(task: () => void) {
    this.queue.push({ task });
  }

  createConsumeTask(channel: symbol, task: (val: Value) => void) {
    this.queue.push({ channel, task });
  }

  createProduceTask(channel: symbol, task: () => Value) {
    this.queue.push({
      task: () => {
        const result = task();
        this.send(channel, result);
      },
    });
  }

  createTransformTask(inChannel: symbol, outChannel: symbol, task: (val: Value) => Value) {
    this.queue.push({
      channel: inChannel,
      task: (v) => {
        const result = task(v);
        this.send(outChannel, result);
      },
    });
  }

  createConsumeTaskChannel(task: (val: Value) => void): symbol {
    const channel = Symbol();
    this.createConsumeTask(channel, task);
    return channel;
  }

  createProduceTaskChannel(task: () => Value): symbol {
    const channel = Symbol();
    this.createProduceTask(channel, task);
    return channel;
  }

  createTransformTaskInChannel(outChannel: symbol, task: (val: Value) => Value): symbol {
    const inChannel = Symbol();
    this.createTransformTask(inChannel, outChannel, task);
    return inChannel;
  }

  createTransformTaskOutChannel(inChannel: symbol, task: (val: Value) => Value): symbol {
    const outChannel = Symbol();
    this.createTransformTask(inChannel, outChannel, task);
    return outChannel;
  }

  createTransformTaskChannels(task: (val: Value) => Value): [inChannel: symbol, outChannel: symbol] {
    const inChannel = Symbol();
    const outChannel = Symbol();
    this.createTransformTask(inChannel, outChannel, task);
    return [inChannel, outChannel];
  }

  send(channel: symbol, value: Value) {
    this.channels[channel] = value;
  }

  receive(channel: symbol): Value {
    const value = this.channels[channel];
    delete this.channels[channel];
    return value;
  }

  ready(channel: symbol): boolean {
    return channel in this.channels;
  }

  run() {
    while (true) {
      this.checkBlocked();
      if (this.queue.length === 0) break;
      this.executeNextTask();
    }
  }

  private executeNextTask() {
    const task = this.queue.shift()!;

    if (!("channel" in task)) {
      task.task();
      return;
    }

    if (!this.ready(task.channel)) {
      this.blocked.push(task);
      return;
    }

    const value = this.receive(task.channel);
    task.task(value);
  }

  private checkBlocked() {
    for (let i = this.blocked.length - 1; i >= 0; i--) {
      const task = this.blocked[i];
      if (!this.ready(task.channel)) continue;
      this.blocked.splice(i, 1);
      this.queue.push(task);
    }
  }
}

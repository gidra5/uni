import { TaskQueueValue } from "./types";

type ProduceTask = { task: (val: void) => TaskQueueValue; outChannel: symbol };
type TransformTask = { task: (val: TaskQueueValue) => TaskQueueValue; inChannel: symbol; outChannel: symbol };
type ConsumeTask = { task: (val: TaskQueueValue) => void; inChannel: symbol };
type PureTask = { task: () => void };
type Task = TransformTask | ConsumeTask | ProduceTask | PureTask;
export class TaskQueue {
  private queue: Task[] = [];
  private blocked: (ConsumeTask | TransformTask)[] = [];
  private channels: Record<symbol, TaskQueueValue> = {};

  createTask(task: () => void) {
    this.queue.push({ task });
  }

  createConsumeTask(inChannel: symbol, task: (val: TaskQueueValue) => void) {
    this.queue.push({ inChannel, task });
  }

  createProduceTask(outChannel: symbol, task: () => TaskQueueValue) {
    this.queue.push({ outChannel, task });
  }

  createTransformTask(inChannel: symbol, outChannel: symbol, task: (val: TaskQueueValue) => TaskQueueValue) {
    this.queue.push({ inChannel, outChannel, task });
  }

  createConsumeTaskChannel(task: (val: TaskQueueValue) => void): symbol {
    const channel = Symbol("consume");
    this.createConsumeTask(channel, task);
    return channel;
  }

  createProduceTaskChannel(task: () => TaskQueueValue): symbol {
    const channel = Symbol("produce");
    this.createProduceTask(channel, task);
    return channel;
  }

  createTransformTaskInChannel(outChannel: symbol, task: (val: TaskQueueValue) => TaskQueueValue): symbol {
    const inChannel = Symbol("transform.in");
    this.createTransformTask(inChannel, outChannel, task);
    return inChannel;
  }

  createTransformTaskOutChannel(inChannel: symbol, task: (val: TaskQueueValue) => TaskQueueValue): symbol {
    const outChannel = Symbol("transform.out");
    this.createTransformTask(inChannel, outChannel, task);
    return outChannel;
  }

  createTransformTaskChannels(task: (val: TaskQueueValue) => TaskQueueValue): [inChannel: symbol, outChannel: symbol] {
    const inChannel = Symbol("transform.in");
    const outChannel = Symbol("transform.out");
    this.createTransformTask(inChannel, outChannel, task);
    return [inChannel, outChannel];
  }

  pipe(inChannel: symbol, outChannel: symbol) {
    this.createTransformTask(inChannel, outChannel, (val) => val);
  }

  send(channel: symbol, value: TaskQueueValue) {
    if (value !== null) {
      this.channels[channel] = value;
      return;
    }
    this.cancel(channel);
  }

  receive(channel: symbol): TaskQueueValue {
    const value = this.channels[channel];
    delete this.channels[channel];
    return value;
  }

  ready(channel: symbol): boolean {
    return channel in this.channels;
  }

  run() {
    while (true) {
      console.dir(this, { depth: null });
      this.checkBlocked();
      if (this.queue.length === 0) break;
      this.executeNextTask();
    }
  }

  private executeNextTask() {
    const task = this.queue.shift()!;

    if (!("inChannel" in task)) {
      if ("outChannel" in task) this.send(task.outChannel, task.task());
      else task.task();
      return;
    }

    if (!this.ready(task.inChannel)) {
      this.blocked.push(task);
      return;
    }

    const value = this.receive(task.inChannel);

    if ("outChannel" in task) this.send(task.outChannel, task.task(value));
    else task.task(value);
  }

  private checkBlocked() {
    for (let i = this.blocked.length - 1; i >= 0; i--) {
      const task = this.blocked[i];
      if (!this.ready(task.inChannel)) continue;
      this.blocked.splice(i, 1);
      this.queue.push(task);
    }
  }

  cancel(channel: symbol) {
    const dependant = [...this.blocked, ...this.queue].filter(
      (task) => "inChannel" in task && task.inChannel === channel
    );
    this.blocked = this.blocked.filter((task) => !dependant.includes(task));
    this.queue = this.queue.filter((task) => !dependant.includes(task));

    for (const task of dependant) {
      if ("outChannel" in task) this.cancel(task.outChannel);
    }
  }
}

import { Value } from "./types";

type ProduceTask = { task: (val: void) => Value; outChannel: symbol };
type TransformTask = { task: (val: Value) => Value; inChannel: symbol; outChannel: symbol };
type ConsumeTask = { task: (val: Value) => void; inChannel: symbol };
type PureTask = { task: () => void };
type Task = TransformTask | ConsumeTask | ProduceTask | PureTask;

export class TaskQueue {
  private queue: Task[] = [];
  private blocked: Task[] = [];
  private channels: Record<symbol, Value> = {};

  createTask(task: () => void) {
    this.queue.push({ task });
  }

  createConsumeTask(inChannel: symbol, task: (val: Value) => void) {
    this.queue.push({ inChannel, task });
  }

  createProduceTask(outChannel: symbol, task: () => Value) {
    this.queue.push({ outChannel, task });
  }

  createTransformTask(inChannel: symbol, outChannel: symbol, task: (val: Value) => Value) {
    this.queue.push({ inChannel, outChannel, task });
  }

  createConsumeTaskChannel(task: (val: Value) => void): symbol {
    const channel = Symbol("consume");
    this.createConsumeTask(channel, task);
    return channel;
  }

  createProduceTaskChannel(task: () => Value): symbol {
    const channel = Symbol("produce");
    this.createProduceTask(channel, task);
    return channel;
  }

  createTransformTaskInChannel(outChannel: symbol, task: (val: Value) => Value): symbol {
    const inChannel = Symbol("transform.in");
    this.createTransformTask(inChannel, outChannel, task);
    return inChannel;
  }

  createTransformTaskOutChannel(inChannel: symbol, task: (val: Value) => Value): symbol {
    const outChannel = Symbol("transform.out");
    this.createTransformTask(inChannel, outChannel, task);
    return outChannel;
  }

  createTransformTaskChannels(task: (val: Value) => Value): [inChannel: symbol, outChannel: symbol] {
    const inChannel = Symbol("transform.in");
    const outChannel = Symbol("transform.out");
    this.createTransformTask(inChannel, outChannel, task);
    return [inChannel, outChannel];
  }

  pipe(inChannel: symbol, outChannel: symbol) {
    this.createTransformTask(inChannel, outChannel, (val) => val);
  }

  fanIn(channels: symbol[], task: (vals: Value[]) => Value): symbol {
    const vals: Value[] = [];
    const outChannel = Symbol("fanIn.out");

    // TODO: memory leak, because if any of input channels' tasks are cancelled, the outChannel will never be resolved, leaving dangling tasks
    for (const channel of channels) {
      this.createConsumeTask(channel, (val) => {
        vals.push(val);
        if (vals.length === channels.length) {
          this.send(outChannel, task(vals));
        }
      });
    }
    return outChannel;
  }

  send(channel: symbol, value: Value) {
    if (value !== null) {
      this.channels[channel] = value;
      return;
    }
    this.cancel(channel);
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
      // console.dir({ msg: "before check blocked", queue: this }, { depth: null });
      this.checkBlocked();
      // console.dir({ msg: "after check blocked", queue: this }, { depth: null });
      // console.dir(this, { depth: null });
      if (this.queue.length === 0) break;
      this.executeNextTask();
    }
  }

  private executeNextTask() {
    const task = this.queue.shift()!;

    if (!("inChannel" in task)) {
      if (!("outChannel" in task)) task.task();
      else if (this.ready(task.outChannel)) this.blocked.push(task);
      else this.send(task.outChannel, task.task());

      return;
    }

    if (!this.ready(task.inChannel)) {
      this.blocked.push(task);
      return;
    }
    if ("outChannel" in task && this.ready(task.outChannel)) this.blocked.push(task);

    const value = this.receive(task.inChannel);

    try {
      const result = task.task(value) ?? null;
      if ("outChannel" in task) this.send(task.outChannel, result);
    } catch (e) {
      console.log(e);
      if ("outChannel" in task) this.cancel(task.outChannel);
    }
  }

  private checkBlocked() {
    for (let i = this.blocked.length - 1; i >= 0; i--) {
      const task = this.blocked[i];
      if ("inChannel" in task && !this.ready(task.inChannel)) continue;
      if ("outChannel" in task && this.ready(task.outChannel)) continue;
      this.blocked.splice(i, 1);
      this.queue.unshift(task);
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

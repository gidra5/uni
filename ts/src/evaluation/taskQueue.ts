import { type Value } from "./types";

type Task = { continuation: (val: Value) => void; id: symbol };
export class TaskQueue {
  private queue: Task[] = [];
  private blocked: Task[] = [];
  private values: Record<symbol, Value> = {};

  createTask(id: symbol, continuation: (val: Value) => void) {
    this.queue.push({ continuation, id });
  }

  createContinuation(continuation: (val: Value) => void): symbol {
    const id = Symbol();
    this.createTask(id, continuation);
    return id;
  }

  setValue(id: symbol, value: Value) {
    this.values[id] = value;
  }

  getValue(id: symbol): Value {
    const value = this.values[id];
    delete this.values[id];
    return value;
  }

  ready(id: symbol): boolean {
    return id in this.values;
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
    if (this.ready(task.id)) {
      const value = this.getValue(task.id);
      task.continuation(value);
    } else {
      this.blocked.push(task);
    }
  }

  private checkBlocked() {
    for (let i = this.blocked.length - 1; i >= 0; i--) {
      const task = this.blocked[i];
      if (!this.ready(task.id)) continue;
      this.blocked.splice(i, 1);
      this.queue.push(task);
    }
  }
}

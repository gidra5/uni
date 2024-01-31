import { Iterator } from "iterator-js";

export class Scope<T> {
  scope: T[];
  names: Record<string, number>;

  constructor(recordScope: Record<string, T> = {}) {
    const iter = Iterator.iterEntries(recordScope)
      .enumerate()
      .map<[string, T, number]>(([x, i]) => [...x, i]);
    this.scope = iter.map(([_, x]) => x).toArray();
    this.names = iter.map<[string, number]>(([x, _, i]) => [x, i]).toObject();
  }

  iter() {
    return Iterator.iterEntries(this.names).map(([name, i]) => ({ name, ...this.scope[i] }));
  }

  iterScope() {
    return Iterator.iter(this.scope);
  }

  getByName(name: string): T | undefined {
    if (!(name in this.names)) return;
    const index = this.names[name];
    return this.scope[index];
  }

  /** 0 is closest scope variable */
  getByIndex(index: number): T | undefined {
    return this.scope[index];
  }

  /** 0 is top-level scope variable */
  getByLevel(level: number): T | undefined {
    return this.scope[this.scope.length - level];
  }

  getLevel(name: string): number | undefined {
    if (!(name in this.names)) return;
    return this.scope.length - this.names[name];
  }

  getIndex(name: string): number | undefined {
    return this.names[name];
  }

  push(value: T): number {
    const index = this.scope.push(value) - 1;
    console.dir(
      {
        msg: "scope push",
        index,
        value,
        scope: this.scope,
        stack: new Error().stack,
      },
      { depth: null }
    );
    return index;
  }

  add(name: string, value: T): number {
    const index = this.push(value);
    this.names[name] = index;
    return index;
  }

  removeByName(name: string): T | undefined {
    if (!(name in this.names)) return;
    const index = this.names[name];
    delete this.names[name];
    this.names = Iterator.iterEntries(this.names)
      .map<[string, number]>(([x, i]) => [x, i > index ? i - 1 : i])
      .toObject();
    return this.scope.splice(index, 1)[0];
  }

  /** mutates */
  append(scope: Scope<T>) {
    const length = this.scope.length;
    this.scope.push(...scope.scope);
    const _names = Iterator.iterEntries(scope.names)
      .map<[string, number]>(([x, i]) => [x, i + length])
      .toObject();
    this.names = { ...this.names, ..._names };
    return this;
  }

  /** creates new merged scope with priority to passed scope */
  merge(scope: Scope<T>): Scope<T> {
    const copied = this.copy();
    return copied.append(scope);
  }

  copy(): Scope<T> {
    const copied = new Scope<T>();
    copied.scope = this.scope.slice();
    copied.names = { ...this.names };
    return copied;
  }
}

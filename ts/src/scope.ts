import { Iterator } from "iterator-js";
import { CopySymbol, copy } from "./utils/copy.js";

type ScopeInnerEntry<T> = { name?: string | symbol; value: T };
export type ScopeEntry<T> = { name?: string | symbol; relativeIndex: number; index: number; value: T };
export type ScopeEntryIdentifier = { name: string | symbol } | { relativeIndex: number } | { index: number };

export class Scope<T = any> {
  scope: ScopeInnerEntry<T>[];
  names: Record<string | symbol, number>;

  constructor(recordScope: Record<string, T> = {}) {
    const iter = Iterator.iterEntries(recordScope)
      .enumerate()
      .map<[string, T, number]>(([x, i]) => [...x, i]);
    this.scope = iter.map(([name, value]) => ({ name, value })).toArray();
    this.names = iter.map<[string, number]>(([x, _, i]) => [x, i]).toObject();
  }

  static namesFromScope<T>(entry: ScopeInnerEntry<T>[]) {
    return Iterator.iter(entry)
      .enumerate()
      .filterMap<[string | symbol, number]>(([{ name }, i]) => {
        if (name === undefined) return;
        return [name, i];
      })
      .toObject();
  }

  updateNames() {
    this.names = Scope.namesFromScope(this.scope);
  }

  drop(n: number) {
    const copied = this.copy();
    copied.scope = copied.scope.slice(0, -n);
    copied.updateNames();
    return copied;
  }

  relativeToIndex(index: number): number {
    return this.scope.length - index - 1;
  }

  indexToRelative(level: number): number {
    return this.scope.length - level - 1;
  }

  assignName(entry: ScopeEntryIdentifier, name: string | symbol) {
    const copied = this.copy();
    const index = copied.toIndex(entry);
    copied.scope[index].name = name;
    copied.names[name] = index;
    return copied;
  }

  iter() {
    return Iterator.iter(this.scope)
      .enumerate()
      .map<ScopeEntry<T>>(([{ name, value }, index]) => ({
        index,
        relativeIndex: this.indexToRelative(index),
        name,
        value,
      }));
  }

  iterEntries() {
    return Iterator.iterEntries(this.names).map<Required<ScopeEntry<T>>>(([name, index]) => ({
      index,
      relativeIndex: this.indexToRelative(index),
      name,
      value: this.scope[index].value,
    }));
  }

  toIndex(identifier: ScopeEntryIdentifier): number {
    if ("index" in identifier) return identifier.index;
    if ("relativeIndex" in identifier) return this.relativeToIndex(identifier.relativeIndex);
    return this.names[identifier.name] ?? -1;
  }

  toRelativeIndex(identifier: ScopeEntryIdentifier): number {
    if ("relativeIndex" in identifier) return identifier.relativeIndex;
    const level = this.toIndex(identifier);
    return this.indexToRelative(level);
  }

  toName(identifier: ScopeEntryIdentifier): string | symbol | undefined {
    if ("name" in identifier) return identifier.name;
    const level = this.toIndex(identifier);
    if (level === -1) return;
    return this.scope[level].name;
  }

  has(identifier: ScopeEntryIdentifier): boolean {
    if ("index" in identifier) return identifier.index < this.scope.length;
    if ("relativeIndex" in identifier) return identifier.relativeIndex <= this.scope.length;
    return identifier.name in this.names;
  }

  get(identifier: ScopeEntryIdentifier): ScopeEntry<T> | undefined {
    const level = this.toIndex(identifier);
    if (level === -1) return;

    return { ...this.scope[level], index: level, relativeIndex: this.indexToRelative(level) };
  }

  getByName(name: string | symbol): ScopeEntry<T> | undefined {
    return this.get({ name });
  }

  /** 0 is closest scope variable */
  getByRelativeIndex(index: number): ScopeEntry<T> | undefined {
    return this.get({ relativeIndex: index });
  }

  /** 0 is top-level scope variable */
  getByIndex(level: number): ScopeEntry<T> | undefined {
    return this.get({ index: level });
  }

  getIndex(name: string | symbol): number {
    return this.toIndex({ name });
  }

  getRelativeIndex(name: string | symbol): number {
    return this.toRelativeIndex({ name });
  }

  push(...values: T[]): Scope<T> {
    const copied = this.copy();
    copied.scope.push(...values.map((value) => ({ value })));
    // console.dir(
    //   {
    //     msg: "scope push",
    //     value,
    //     scope: this.scope,
    //     stack: new Error().stack,
    //   },
    //   { depth: null }
    // );
    return copied;
  }

  add(name: string | symbol, value: T): Scope<T> {
    const copied = this.push(value);
    const index = copied.scope.length - 1;
    copied.names[name] = index;
    copied.scope[index].name = name;
    return copied;
  }

  remove(identifier: ScopeEntryIdentifier): Scope<T> {
    const level = this.toIndex(identifier);
    if (level === undefined) return this;
    const copied = this.copy();
    copied.scope.splice(level, 1);
    copied.updateNames();
    return copied;
  }

  removeAll(name: string | symbol): Scope<T> {
    const copied = this.copy();
    copied.scope = copied.scope.filter((x) => x.name !== name);
    copied.updateNames();
    return copied;
  }

  removeByName(name: string | symbol): Scope<T> {
    return this.remove({ name });
  }

  removeByRelativeIndex(relativeIndex: number): Scope<T> {
    return this.remove({ relativeIndex });
  }

  removeByIndex(index: number): Scope<T> {
    return this.remove({ index });
  }

  private _append(scope: Scope<T>) {
    this.scope.push(...scope.scope);
    this.updateNames();
    return this;
  }

  /** creates new merged scope with priority to passed scope */
  append(scope: Scope<T>): Scope<T> {
    const copied = this.copy();
    return copied._append(scope);
  }

  copy(): Scope<T> {
    const copied = new Scope<T>();
    copied.scope = this.scope.slice();
    copied.names = { ...this.names };
    return copied;
  }

  [CopySymbol](): Scope<T> {
    return this.copy();
  }

  size() {
    return this.scope.length;
  }
}

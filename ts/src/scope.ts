import { Iterator } from "iterator-js";

type ScopeInnerEntry<T> = { name?: string; value: T };
export type ScopeEntry<T> = { name?: string; relativeIndex: number; index: number; value: T };
type ScopeEntryIdentifier = { name: string } | { relativeIndex: number } | { index: number };

export class Scope<T = any> {
  scope: ScopeInnerEntry<T>[];
  names: Record<string, number>;

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
      .filterMap<[string, number]>(([{ name }, i]) => {
        if (name === undefined) return;
        return [name, i];
      })
      .toObject();
  }

  private updateNames() {
    this.names = Scope.namesFromScope(this.scope);
  }

  relativeToIndex(index: number): number {
    return this.scope.length - index - 1;
  }

  indexToRelative(level: number): number {
    return this.scope.length - level - 1;
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

  toLevel(identifier: ScopeEntryIdentifier): number {
    if ("index" in identifier) return identifier.index;
    if ("relativeIndex" in identifier) return this.relativeToIndex(identifier.relativeIndex);
    return this.names[identifier.name] ?? -1;
  }

  toIndex(identifier: ScopeEntryIdentifier): number {
    if ("relativeIndex" in identifier) return identifier.relativeIndex;
    const level = this.toLevel(identifier);
    return this.indexToRelative(level);
  }

  toName(identifier: ScopeEntryIdentifier): string | undefined {
    if ("name" in identifier) return identifier.name;
    const level = this.toLevel(identifier);
    if (level === -1) return;
    return this.scope[level].name;
  }

  has(identifier: ScopeEntryIdentifier): boolean {
    if ("index" in identifier) return identifier.index < this.scope.length;
    if ("relativeIndex" in identifier) return identifier.relativeIndex <= this.scope.length;
    return identifier.name in this.names;
  }

  get(identifier: ScopeEntryIdentifier): ScopeEntry<T> | undefined {
    const level = this.toLevel(identifier);
    if (level === -1) return;

    return { ...this.scope[level], index: level, relativeIndex: this.indexToRelative(level) };
  }

  getByName(name: string): ScopeEntry<T> | undefined {
    return this.get({ name });
  }

  /** 0 is closest scope variable */
  getByIndex(index: number): ScopeEntry<T> | undefined {
    return this.get({ relativeIndex: index });
  }

  /** 0 is top-level scope variable */
  getByLevel(level: number): ScopeEntry<T> | undefined {
    return this.get({ index: level });
  }

  getLevel(name: string): number {
    return this.toLevel({ name });
  }

  getIndex(name: string): number {
    return this.toIndex({ name });
  }

  push(value: T): Scope<T> {
    const copied = this.copy();
    copied.scope.push({ value });
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

  add(name: string, value: T): Scope<T> {
    const copied = this.push(value);
    const index = copied.scope.length - 1;
    copied.names[name] = index;
    copied.scope[index].name = name;
    return copied;
  }

  remove(identifier: ScopeEntryIdentifier): Scope<T> {
    const level = this.toLevel(identifier);
    if (level === undefined) return this;
    const copied = this.copy();
    copied.scope.splice(level, 1);
    copied.updateNames();
    return copied;
  }

  removeAll(name: string): Scope<T> {
    const copied = this.copy();
    copied.scope = copied.scope.filter((x) => x.name !== name);
    copied.updateNames();
    return copied;
  }

  removeByName(name: string): Scope<T> {
    return this.remove({ name });
  }

  removeByIndex(index: number): Scope<T> {
    return this.remove({ relativeIndex: index });
  }

  removeByLevel(level: number): Scope<T> {
    return this.remove({ index: level });
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
}

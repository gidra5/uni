import { Iterator } from "iterator-js";

type ScopeInnerEntry<T> = { name?: symbol; value: T };
export type ScopeEntry<T> = { name?: string | symbol; relativeIndex: number; index: number; value: T };
export type ScopeEntryIdentifier = { name: string | symbol } | { relativeIndex: number } | { index: number };

export class Environment<T = any> {
  private scope: ScopeInnerEntry<T>[];
  private names: Record<symbol, number>;

  private constructor(recordScope: Record<string, T> = {}) {
    const iter = Iterator.iterEntries(recordScope)
      .enumerate()
      .map<[string, T, number]>(([x, i]) => [...x, i]);
    this.scope = iter.map(([name, value]) => ({ name, value })).toArray();
    this.names = iter.map<[string, number]>(([x, _, i]) => [x, i]).toObject();
  }

  private static namesFromScope<T>(entry: ScopeInnerEntry<T>[]) {
    return Iterator.iter(entry)
      .enumerate()
      .filterMap<[string | symbol, number]>(([{ name }, i]) => {
        if (name === undefined) return;
        return [name, i];
      })
      .toObject();
  }

  private updateNames() {
    this.names = Environment.namesFromScope(this.scope);
  }

  private drop(n: number) {
    const copied = this.copy();
    copied.scope = copied.scope.slice(0, -n);
    copied.updateNames();
    return copied;
  }

  private relativeToIndex(index: number): number {
    return this.scope.length - index - 1;
  }

  private indexToRelative(level: number): number {
    return this.scope.length - level - 1;
  }

  private assignName(entry: ScopeEntryIdentifier, name: string | symbol) {
    const copied = this.copy();
    const index = copied.toIndex(entry);
    copied.scope[index].name = name;
    copied.names[name] = index;
    return copied;
  }

  private iter() {
    return Iterator.iter(this.scope)
      .enumerate()
      .map<ScopeEntry<T>>(([{ name, value }, index]) => ({
        index,
        relativeIndex: this.indexToRelative(index),
        name,
        value,
      }));
  }

  private iterEntries() {
    return Iterator.iterEntries(this.names).map<Required<ScopeEntry<T>>>(([name, index]) => ({
      index,
      relativeIndex: this.indexToRelative(index),
      name,
      value: this.scope[index].value,
    }));
  }

  private toIndex(identifier: ScopeEntryIdentifier): number {
    if ("index" in identifier) return identifier.index;
    if ("relativeIndex" in identifier) return this.relativeToIndex(identifier.relativeIndex);
    return this.names[identifier.name] ?? -1;
  }

  private toRelativeIndex(identifier: ScopeEntryIdentifier): number {
    if ("relativeIndex" in identifier) return identifier.relativeIndex;
    const level = this.toIndex(identifier);
    return this.indexToRelative(level);
  }

  private toName(identifier: ScopeEntryIdentifier): string | symbol | undefined {
    if ("name" in identifier) return identifier.name;
    const level = this.toIndex(identifier);
    if (level === -1) return;
    return this.scope[level].name;
  }

  private has(identifier: ScopeEntryIdentifier): boolean {
    if ("index" in identifier) return identifier.index < this.scope.length;
    if ("relativeIndex" in identifier) return identifier.relativeIndex <= this.scope.length;
    return identifier.name in this.names;
  }

  private get(identifier: ScopeEntryIdentifier): ScopeEntry<T> | undefined {
    const level = this.toIndex(identifier);
    if (level === -1) return;

    return { ...this.scope[level], index: level, relativeIndex: this.indexToRelative(level) };
  }

  private getByName(name: string | symbol): ScopeEntry<T> | undefined {
    return this.get({ name });
  }

  /** 0 is closest scope variable */
  private getByRelativeIndex(index: number): ScopeEntry<T> | undefined {
    return this.get({ relativeIndex: index });
  }

  /** 0 is top-level scope variable */
  private getByIndex(level: number): ScopeEntry<T> | undefined {
    return this.get({ index: level });
  }

  private getIndex(name: string | symbol): number {
    return this.toIndex({ name });
  }

  private getRelativeIndex(name: string | symbol): number {
    return this.toRelativeIndex({ name });
  }

  private push(...values: T[]): Environment<T> {
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

  private add(name: string | symbol, value: T): Environment<T> {
    const copied = this.push(value);
    const index = copied.scope.length - 1;
    copied.names[name] = index;
    copied.scope[index].name = name;
    return copied;
  }

  private remove(identifier: ScopeEntryIdentifier): Environment<T> {
    const level = this.toIndex(identifier);
    if (level === undefined) return this;
    const copied = this.copy();
    copied.scope.splice(level, 1);
    copied.updateNames();
    return copied;
  }

  private removeAll(name: string | symbol): Environment<T> {
    const copied = this.copy();
    copied.scope = copied.scope.filter((x) => x.name !== name);
    copied.updateNames();
    return copied;
  }

  private removeByName(name: string | symbol): Environment<T> {
    return this.remove({ name });
  }

  private removeByRelativeIndex(relativeIndex: number): Environment<T> {
    return this.remove({ relativeIndex });
  }

  private removeByIndex(index: number): Environment<T> {
    return this.remove({ index });
  }

  private _append(scope: Environment<T>) {
    this.scope.push(...scope.scope);
    this.updateNames();
    return this;
  }

  /** creates new merged scope with priority to passed scope */
  private append(scope: Environment<T>): Environment<T> {
    const copied = this.copy();
    return copied._append(scope);
  }

  private copy(): Environment<T> {
    const copied = new Environment<T>();
    copied.scope = this.scope.slice();
    copied.names = { ...this.names };
    return copied;
  }

  private size() {
    return this.scope.length;
  }
}

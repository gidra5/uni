import { Iterator } from "iterator-js";

type ScopeInnerEntry<T> = { name?: string; value: T };
export type ScopeEntry<T> = { name?: string; index: number; level: number; value: T };
type ScopeEntryIdentifier = { name: string } | { index: number } | { level: number };

export class Scope<T> {
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

  indexToLevel(index: number): number {
    return this.scope.length - index - 1;
  }

  levelToIndex(level: number): number {
    return this.scope.length - level - 1;
  }

  iter() {
    return Iterator.iter(this.scope)
      .enumerate()
      .map<ScopeEntry<T>>(([{ name, value }, level]) => ({
        level,
        index: this.levelToIndex(level),
        name,
        value,
      }));
  }

  toLevel(identifier: ScopeEntryIdentifier): number | undefined {
    if ("level" in identifier) return identifier.level;
    if ("index" in identifier) return this.indexToLevel(identifier.index);
    if ("name" in identifier) return this.names[identifier.name];
  }

  toIndex(identifier: ScopeEntryIdentifier): number | undefined {
    if ("index" in identifier) return identifier.index;
    const level = this.toLevel(identifier);
    if (level === undefined) return;
    return this.levelToIndex(level);
  }

  toName(identifier: ScopeEntryIdentifier): string | undefined {
    if ("name" in identifier) return identifier.name;
    const level = this.toLevel(identifier);
    if (level === undefined) return;
    return this.scope[level].name;
  }

  get(identifier: ScopeEntryIdentifier): ScopeEntry<T> | undefined {
    const level = this.toLevel(identifier);
    if (level === undefined) return;

    return { ...this.scope[level], level, index: this.levelToIndex(level) };
  }

  getByName(name: string): ScopeEntry<T> | undefined {
    return this.get({ name });
  }

  /** 0 is closest scope variable */
  getByIndex(index: number): ScopeEntry<T> | undefined {
    return this.get({ index });
  }

  /** 0 is top-level scope variable */
  getByLevel(level: number): ScopeEntry<T> | undefined {
    return this.get({ level });
  }

  getLevel(name: string): number | undefined {
    if (!(name in this.names)) return;
    return this.names[name];
  }

  getIndex(name: string): number | undefined {
    if (!(name in this.names)) return;
    return this.levelToIndex(this.names[name]);
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
    return this.remove({ index });
  }

  removeByLevel(level: number): Scope<T> {
    return this.remove({ level });
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

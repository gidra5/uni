const atomsCache: Record<string, symbol> = {};

export const getAtom = (name: string): symbol => {
  if (!(name in atomsCache)) {
    atomsCache[name] = Symbol(name);
  }
  return atomsCache[name];
};

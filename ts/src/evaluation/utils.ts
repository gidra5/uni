import { Scope } from "../scope.js";
import { Context, ScopeValue } from "./types";
import { getterSymbol, setterSymbol } from "./values.js";
import { TaskQueue } from "./taskQueue.js";

export const initialContext = (taskQueue: TaskQueue): Context => {
  const context = {
    scope: new Scope<ScopeValue>({
      getter: { get: () => getterSymbol },
      setter: { get: () => setterSymbol },
    }),
  };

  return context;
};

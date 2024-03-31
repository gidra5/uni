import { evaluate } from "./index.js";
import { Scope } from "../scope.js";
import { TaskQueueContext, ExprValue, FunctionValue, RecordValue, ScopeValue, Value } from "./types";
import { getterSymbol, setterSymbol } from "./values.js";
import { TaskQueue } from "./taskQueue.js";

export const initialContext = (taskQueue: TaskQueue): TaskQueueContext => {
  const context = {
    scope: new Scope<ScopeValue>({
      getter: { get: () => getterSymbol },
      setter: { get: () => setterSymbol },
    }),
    taskQueue,
  };

  return context;
};

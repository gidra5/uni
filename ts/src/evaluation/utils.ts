import { evaluate } from "./index.js";
import { Scope } from "../scope.js";
import { TaskQueueContext, ExprValue, FunctionValue, RecordValue, ScopeValue, Value } from "./types";
import { getterSymbol, setterSymbol } from "./values.js";
import { TaskQueue } from "./taskQueue.js";

export const initialContext = (taskQueue: TaskQueue): TaskQueueContext => {
  const _eval: FunctionValue = (argChannel) => {
    const outChannel = Symbol();
    taskQueue.createConsumeTask(argChannel, (exprVal) => {
      const expr = exprVal as ExprValue;
      const inChannel = evaluate(taskQueue, expr.ast, { scope: expr.scope });
      taskQueue.createConsumeTask(inChannel, (val) => {
        const expr = val as ExprValue;
        const evalChannel = evaluate(taskQueue, expr.ast, { scope: expr.scope });
        taskQueue.pipe(evalChannel, outChannel);
      });
    });
    return outChannel;
  };
  const context = {
    scope: new Scope<ScopeValue>({
      eval: { get: () => _eval },
      getter: { get: () => getterSymbol },
      setter: { get: () => setterSymbol },
    }),
    taskQueue,
  };

  return context;
};

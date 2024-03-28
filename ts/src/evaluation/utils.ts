import { Iterator } from "iterator-js";
import { taskQueueEvaluate } from "./index.js";
import { Scope } from "../scope.js";
import {
  TaskQueueContext,
  TaskQueueExprValue,
  TaskQueueFunctionValue,
  TaskQueueRecordValue,
  TaskQueueScopeValue,
  TaskQueueValue,
} from "./types";
import { getterSymbol, setterSymbol } from "./values.js";
import { TaskQueue } from "./taskQueue.js";

export const isTaskQueueRecord = (value: TaskQueueValue): value is TaskQueueRecordValue =>
  !!value && typeof value === "object" && value.kind === "record";

export const initialTaskQueueContext = (taskQueue: TaskQueue): TaskQueueContext => {
  const _eval: TaskQueueFunctionValue = (argChannel) => {
    const outChannel = Symbol();
    taskQueue.createConsumeTask(argChannel, (exprVal) => {
      const expr = exprVal as TaskQueueExprValue;
      const inChannel = taskQueueEvaluate(taskQueue, expr.ast, { scope: expr.scope });
      taskQueue.createConsumeTask(inChannel, (val) => {
        const expr = val as TaskQueueExprValue;
        const evalChannel = taskQueueEvaluate(taskQueue, expr.ast, { scope: expr.scope });
        taskQueue.pipe(evalChannel, outChannel);
      });
    });
    return outChannel;
  };
  const context = {
    scope: new Scope<TaskQueueScopeValue>({
      eval: { get: () => _eval },
      getter: { get: () => getterSymbol },
      setter: { get: () => setterSymbol },
    }),
    taskQueue,
  };

  return context;
};

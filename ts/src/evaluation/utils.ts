import { Iterator } from "iterator-js";
import { evaluate, taskQueueEvaluate } from "./index.js";
import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope.js";
import {
  Context,
  ExprValue,
  FunctionValue,
  RecordValue,
  ScopeValue,
  TaskQueueContext,
  TaskQueueExprValue,
  TaskQueueRecordValue,
  TaskQueueScopeValue,
  TaskQueueValue,
  Value,
} from "./types";
import { parseExprString } from "../parser/string.js";
import { expr, fn, getterSymbol, record, setterSymbol, taskQueueExpr, taskQueueFn, taskQueueRecord } from "./values.js";
import { TaskQueue } from "./taskQueue.js";

export const isRecord = (value: Value): value is RecordValue =>
  !!value && typeof value === "object" && value.kind === "record";

export const exprToRecord = (_expr: ExprValue): RecordValue => {
  const exprRecord: RecordValue = record();
  const children = _expr.ast.children.map<RecordValue>((child) => exprToRecord(expr(child, _expr.scope)));

  exprRecord.set("children", record(children));
  exprRecord.set("name", _expr.ast.name);
  exprRecord.set("value", jsValueToValue(_expr.ast.value));
  exprRecord.set("data", jsValueToValue(_expr.ast.data));

  return record([], {
    expr: exprRecord,
    env: _expr.scope as unknown as Value,
    cont: (_expr.continuation ?? null) as unknown as Value,
  });
};
export const recordToExpr = (record: RecordValue): ExprValue => {
  const env = record.get("env") as any;
  const children = record.get("children")! as RecordValue;
  const _expr: AbstractSyntaxTree = {
    children: children.tuple.map((child) => recordToExpr(child as RecordValue).ast),
    name: record.get("name") as string,
    value: valueToJsValue(record.get("value")),
    data: valueToJsValue(record.get("data")),
  };
  return expr(_expr, env, record.get("cont") as any);
};
export const jsValueToValue = (value: any): Value => {
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || typeof value === "symbol")
    return value;
  if (Array.isArray(value)) return record(value.map(jsValueToValue));
  if (typeof value === "object") return record([], Iterator.iterEntries(value).mapValues(jsValueToValue).toObject());
  if (typeof value === "function") return (arg: ExprValue) => jsValueToValue(value(arg));
  return null;
};
export const valueToJsValue = (value: Value): any => {
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || typeof value === "symbol")
    return value;
  if (isRecord(value)) {
    const v = value.tuple.map(valueToJsValue);
    Object.assign(v, value.record);
    return v;
  }
  if (typeof value === "function") {
    throw new Error("Not implemented");
  }
  return null;
};

export const initialContext = (): Context => {
  const bind = fn((env: Value) =>
    fn((names: RecordValue) => {
      return (env as unknown as Scope)
        .push(...names.tuple.map((value) => ({ value })))
        .append(
          new Scope(
            Iterator.iterEntries(names.record)
              .map<[string | symbol, ScopeValue]>(([name, value]) => [
                name,
                { get: () => value, set: (v) => (value = v) },
              ])
              .toObject()
          )
        )
        .append(
          new Scope(
            Iterator.iter(names.map)
              .filter<[string, Value]>((x): x is [string, Value] => typeof x[0] === "string")
              .map<[string, ScopeValue]>(([key, value]) => [key, { get: () => value, set: (v) => (value = v) }])
              .toObject()
          )
        ) as unknown as Value;
    })
  );
  const envSet = fn((env: Value) =>
    fn((name: Value) =>
      fn((value: Value) => {
        const ast = recordToExpr(name as RecordValue).ast;
        const scope = env as unknown as Scope<ScopeValue>;
        if (ast.children[0].name === "name") {
          const name = ast.children[0].value;
          const entryIndex = scope.toIndex({ name });
          const entry = scope.scope[entryIndex];

          if (entry !== undefined) {
            entry.value.set?.(value);
          }
        } else {
          const context = { scope };
          const accessor = ast.children[0];
          const recordFieldNode = accessor.children[1];
          const record = evaluate(accessor.children[0], context) as RecordValue;
          const key = accessor.name === "access" ? recordFieldNode.value : evaluate(recordFieldNode, context);

          record.set(key, value);
        }

        return value;
      })
    )
  );
  const quote = (expr) => exprToRecord(expr);
  const env = fn((env: Value) => {
    return (env as unknown as Scope).copy() as unknown as Value;
  });
  const _eval = fn((value) => {
    const expr = recordToExpr(value as RecordValue);
    return evaluate(expr.ast, { scope: expr.scope });
  });
  const context = {
    scope: new Scope<ScopeValue>({
      bind: { get: () => bind },
      env_set: { get: () => envSet },
      env: { get: () => env },
      eval: { get: () => _eval },
      quote: { get: () => quote },
      getter: { get: () => getterSymbol },
      setter: { get: () => setterSymbol },
    }),
  };

  const _fn = evaluate(
    parseExprString(
      `macro name_expr -> macro body_expr -> {
          returnLabel := symbol
          name := if (:value) in name_expr.expr: name_expr.expr.value else 0
          body_expr.env = bind body_expr.env (["return"]: (macro value -> {
            expr := quote break eval value
            expr.expr.data.label = returnLabel
            eval expr
          }))

          macro arg_expr -> {
            arg := eval arg_expr
            body := quote { eval (bind body_expr ([name]: arg)) }
            body.expr.data.label = returnLabel
            eval body
          }
        }`
    )[0],
    context
  );

  context.scope = context.scope.add("fn", {
    get: () => _fn,
  });

  console.dir(["initialContext", context], { depth: null });

  return context;
};

export const isTaskQueueRecord = (value: TaskQueueValue): value is TaskQueueRecordValue =>
  !!value && typeof value === "object" && value.kind === "record";

export const taskQueueExprToRecord = (taskQueue: TaskQueue, _expr: TaskQueueExprValue): TaskQueueRecordValue => {
  const exprRecord: TaskQueueRecordValue = taskQueueRecord(taskQueue);
  const children = _expr.ast.children.map<TaskQueueRecordValue>((child) =>
    taskQueueExprToRecord(taskQueue, taskQueueExpr(child, _expr.scope))
  );

  exprRecord.set("children", taskQueueRecord(taskQueue, children));
  exprRecord.set("name", _expr.ast.name);
  exprRecord.set("value", jsValueToTaskQueueValue(taskQueue, _expr.ast.value));
  exprRecord.set("data", jsValueToTaskQueueValue(taskQueue, _expr.ast.data));

  return taskQueueRecord(taskQueue, [], {
    expr: exprRecord,
    env: _expr.scope as unknown as TaskQueueValue,
  });
};

export const taskQueueRecordToExpr = (record: TaskQueueRecordValue): TaskQueueExprValue => {
  const env = record.get("env") as any;
  const children = record.get("children")! as TaskQueueRecordValue;
  const _expr: AbstractSyntaxTree = {
    children: children.tuple.map((child) => taskQueueRecordToExpr(child as TaskQueueRecordValue).ast),
    name: record.get("name") as string,
    value: taskQueueValueToJsValue(record.get("value")),
    data: taskQueueValueToJsValue(record.get("data")),
  };
  return taskQueueExpr(_expr, env);
};

export const jsValueToTaskQueueValue = (taskQueue: TaskQueue, value: any): TaskQueueValue => {
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || typeof value === "symbol")
    return value;
  if (Array.isArray(value)) return taskQueueRecord(taskQueue, value.map(jsValueToTaskQueueValue));
  if (typeof value === "object")
    return taskQueueRecord(
      taskQueue,
      [],
      Iterator.iterEntries(value)
        .mapValues((v) => jsValueToTaskQueueValue(taskQueue, v))
        .toObject()
    );
  if (typeof value === "function") return value;
  return null;
};

export const taskQueueValueToJsValue = (value: TaskQueueValue): any => {
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || typeof value === "symbol")
    return value;
  if (isTaskQueueRecord(value)) {
    const v = value.tuple.map(taskQueueValueToJsValue);
    Object.assign(v, value.record);
    return v;
  }
  if (typeof value === "function") {
    throw new Error("Not implemented");
  }
  return null;
};

export const initialTaskQueueContext = (taskQueue: TaskQueue): TaskQueueContext => {
  const _eval = (argChannel) => {
    const outChannel = Symbol();
    taskQueue.createConsumeTask(argChannel, (exprVal) => {
      const expr = exprVal as unknown as TaskQueueExprValue;
      const inChannel = taskQueueEvaluate(taskQueue, expr.ast, { scope: expr.scope });
      taskQueue.createConsumeTask(inChannel, (val) => {
        const expr = taskQueueRecordToExpr(val as TaskQueueRecordValue);
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

import { Iterator } from "iterator-js";
import { AbstractSyntaxTree, string } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { isEqual, omitASTDataScope } from "../utils/index.js";
import { match, template } from "../parser/utils.js";
import { parseExprString } from "../parser/string.js";

type SymbolValue = symbol;
type RecordValue = {
  kind: "record";
  get: (key: Value) => Value;
  set: (key: Value, val: Value) => void;
  has: (key: Value) => boolean;
  tuple: Value[];
  record: Record<string | symbol, Value>;
  map: Map<Value, Value>;
};
type TypeValue = { kind: "type"; name: string; value: Value };
type ExprValue = {
  kind: "expr";
  ast: AbstractSyntaxTree;
  scope: Scope<ScopeValue>;
  continuation?: (val: Value) => Value;
};
type FunctionValue = (arg: ExprValue) => Value;
type Value = number | string | boolean | null | FunctionValue | RecordValue | SymbolValue | TypeValue;
type ScopeValue = { get?: () => Value; set?: (val: Value) => void; type?: TypeValue };
type Context = { scope: Scope<ScopeValue>; continuation?: (val: Value) => Value; tasks: TaskQueue };

type Task = { continuation: (val: Value, queue: TaskQueue) => void; id: symbol };
class TaskQueue {
  queue: Task[] = [];
  blocked: Task[] = [];
  values: Record<symbol, Value> = {};

  run() {
    while (true) {
      this.checkBlocked();
      if (this.queue.length === 0) break;
      const task = this.queue.shift()!;
      if (task.id in this.values) {
        const value = this.values[task.id];
        task.continuation(value, this);
      } else {
        this.blocked.push(task);
      }
    }
  }

  private checkBlocked() {
    for (let i = this.blocked.length - 1; i >= 0; i--) {
      const task = this.blocked[i];
      if (!(task.id in this.values)) continue;
      this.blocked.splice(i, 1);
      this.queue.push(task);
    }
  }
}

const atomsCache: Record<string, symbol> = {};

const getAtom = (name: string): symbol => {
  if (!(name in atomsCache)) {
    atomsCache[name] = Symbol(name);
  }
  return atomsCache[name];
};
const getterSymbol = Symbol();
const setterSymbol = Symbol();

const isRecord = (value: Value): value is RecordValue =>
  !!value && typeof value === "object" && value.kind === "record";

const record = (
  tuple: Value[] = [],
  record: { [key: string]: Value } = {},
  map: Map<Value, Value> = new Map()
): RecordValue => ({
  kind: "record",
  has: recordHas(tuple, record, map),
  get(key: Value) {
    const getter = recordGet(tuple, record, map);
    if (key === getterSymbol) return fn(this.get);
    if (key === setterSymbol) return fn((k) => fn((v) => (this.set(k, v), null)));
    return getter(key);
  },
  set: recordSet(tuple, record, map),
  tuple,
  record,
  map,
});
const expr = (ast: AbstractSyntaxTree, scope: Scope<ScopeValue>, continuation?: (val: Value) => Value): ExprValue => ({
  kind: "expr",
  ast,
  scope,
  continuation,
});
const fn =
  <T extends Value>(value: (arg: T) => Value): FunctionValue =>
  (arg) =>
    evaluate(arg.ast, { scope: arg.scope, continuation: value as any });
const exprToRecord = (_expr: ExprValue): RecordValue => {
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
const recordToExpr = (record: RecordValue): ExprValue => {
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
const jsValueToValue = (value: any): Value => {
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || typeof value === "symbol")
    return value;
  if (Array.isArray(value)) return record(value.map(jsValueToValue));
  if (typeof value === "object") return record([], Iterator.iterEntries(value).mapValues(jsValueToValue).toObject());
  if (typeof value === "function") return (arg: ExprValue) => jsValueToValue(value(arg));
  return null;
};
const valueToJsValue = (value: Value): any => {
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

const recordSet =
  (tuple: Value[], record: Record<string | symbol, Value>, map: Map<Value, Value>) =>
  (key: Value, value: Value): void => {
    if (key === null) return;

    if (value === null) {
      if (typeof key === "number") {
        tuple.splice(key, 1);
      } else if (typeof key === "symbol" && key.description) {
        delete record[key.description];
      } else {
        map.delete(key);
      }
      return;
    }

    if (typeof key === "number") {
      tuple[key] = value;
    } else if (typeof key === "symbol" || typeof key === "string") {
      record[key] = value;
    } else {
      map.set(key, value);
    }
  };
const recordGet =
  (tuple: Value[], record: Record<string | symbol, Value>, map: Map<Value, Value>) =>
  (key: Value): Value => {
    if (key === null) return null;

    if (typeof key === "number") return tuple[key] ?? null;
    if (typeof key === "symbol" || typeof key === "string") return record[key] ?? null;
    return map.get(key) ?? null;
  };
const recordHas =
  (tuple: Value[], record: Record<string | symbol, Value>, map: Map<Value, Value>) =>
  (key: Value): boolean => {
    if (key === null) return false;
    if (typeof key === "number") return key in tuple;
    if (typeof key === "symbol" || typeof key === "string") return key in record;
    return map.has(key);
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

export const evaluate = (ast: AbstractSyntaxTree, context = initialContext()): Value => {
  const result = (() => {
    // console.dir(
    //   {
    //     msg: "evaluate",
    //     ast: omitASTDataScope(ast),
    //     context,
    //   },
    //   { depth: null }
    // );

    switch (ast.name) {
      case "program":
        return evaluate(ast.children[0], context);
      case "operator": {
        switch (ast.value) {
          case "print": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val) => {
                console.dir(val, { depth: null });
                return val;
              },
            });
          }

          case "+": {
            const [head, ...rest] = ast.children;
            return evaluate(head, {
              ...context,
              continuation: (val1) =>
                evaluate(rest.length === 1 ? rest[0] : { ...ast, children: rest }, {
                  ...context,
                  continuation: (val2) => (val1 as number) + (val2 as number),
                }),
            });
          }
          case "*": {
            const [head, ...rest] = ast.children;
            return evaluate(head, {
              ...context,
              continuation: (val1) =>
                evaluate(rest.length === 1 ? rest[0] : { ...ast, children: rest }, {
                  ...context,
                  continuation: (val2) => (val1 as number) * (val2 as number),
                }),
            });
          }
          case "-": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val1) =>
                evaluate(ast.children[1], {
                  ...context,
                  continuation: (val2) => (val1 as number) - (val2 as number),
                }),
            });
          }
          case "/": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val1) =>
                evaluate(ast.children[1], {
                  ...context,
                  continuation: (val2) => (val1 as number) / (val2 as number),
                }),
            });
          }
          case "%": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val1) =>
                evaluate(ast.children[1], {
                  ...context,
                  continuation: (val2) => (val1 as number) % (val2 as number),
                }),
            });
          }
          case "^": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val1) =>
                evaluate(ast.children[1], {
                  ...context,
                  continuation: (val2) => Math.pow(val1 as number, val2 as number),
                }),
            });
          }

          case "set": {
            const [tuple, key, value] = ast.children;
            return evaluate(tuple, {
              ...context,
              continuation: (tupleVal) =>
                evaluate(key, {
                  ...context,
                  continuation: (keyVal) =>
                    evaluate(value, {
                      ...context,
                      continuation: (valueVal) => {
                        const record = tupleVal as RecordValue;
                        record.set(keyVal, valueVal);
                        return record;
                      },
                    }),
                }),
            });
          }
          case "push": {
            const [tuple, value] = ast.children;
            return evaluate(tuple, {
              ...context,
              continuation: (tupleVal) =>
                evaluate(value, {
                  ...context,
                  continuation: (valueVal) => {
                    const record = tupleVal as RecordValue;
                    record.tuple.push(valueVal);
                    return record;
                  },
                }),
            });
          }
          case "join": {
            const [tuple, value] = ast.children;
            return evaluate(tuple, {
              ...context,
              continuation: (tupleVal) =>
                evaluate(value, {
                  ...context,
                  continuation: (valueVal) => {
                    if (!isRecord(valueVal)) return tupleVal;
                    const record = tupleVal as RecordValue;
                    valueVal.tuple.forEach((value) => record.tuple.push(value));
                    valueVal.map.forEach((value, key) => record.map.set(key, value));
                    Object.assign(record.record, valueVal.record);
                    return record;
                  },
                }),
            });
          }
          case "unit": {
            return record();
          }

          case "in": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val) => {
                return evaluate(ast.children[1], {
                  ...context,
                  continuation: (_record) => {
                    const record = _record as RecordValue;
                    return record.has(val);
                  },
                });
              },
            });
          }
          case "and": {
            const [head, ...rest] = ast.children;
            return evaluate(head, {
              ...context,
              continuation: (val1) =>
                (val1 as boolean) &&
                evaluate(rest.length === 1 ? rest[0] : { ...ast, children: rest }, {
                  ...context,
                  continuation: (val2) => val2 as boolean,
                }),
            });
          }
          case "or": {
            const [head, ...rest] = ast.children;
            return evaluate(head, {
              ...context,
              continuation: (val1) =>
                (val1 as boolean) ||
                evaluate(rest.length === 1 ? rest[0] : { ...ast, children: rest }, {
                  ...context,
                  continuation: (val2) => val2 as boolean,
                }),
            });
          }
          case "==": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val1) =>
                evaluate(ast.children[1], {
                  ...context,
                  continuation: (val2) => val1 === val2,
                }),
            });
          }
          case "===": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val1) =>
                evaluate(ast.children[1], {
                  ...context,
                  continuation: (val2) => isEqual(val1, val2),
                }),
            });
          }
          case "!": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val) => !val,
            });
          }
          case "<": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val1) =>
                evaluate(ast.children[1], {
                  ...context,
                  continuation: (val2) => (val1 as number) < (val2 as number),
                }),
            });
          }

          case "macro": {
            const scope = context.scope;
            const name = ast.children[0].value;
            return (arg: ExprValue) => {
              const exprRecord = exprToRecord(arg);
              const boundScope =
                name !== undefined ? scope.add(name, { get: () => exprRecord }) : scope.push({ get: () => exprRecord });

              return evaluate(ast.children[1], { scope: boundScope, continuation: arg.continuation });
            };
          }

          case ";": {
            const [head, ...rest] = ast.children;
            return evaluate(head, {
              ...context,
              continuation: () => evaluate(rest.length === 1 ? rest[0] : { ...ast, children: rest }, context),
            });
          }

          case "#": {
            const node = ast.children[0];
            return context.scope.getByRelativeIndex(node.value)?.value.get?.() ?? null;
          }

          case "codeLabel": {
            const label = ast.children[0].value;
            const expr = ast.children[1];
            const labelValue = fn(context.continuation!);
            const scope = context.scope.add(label, { get: () => labelValue });

            return evaluate(expr, { scope, continuation: context.continuation });
          }

          case "=": {
            const value = evaluate(ast.children[1], context);

            if (
              ast.children[0].name !== "name" &&
              !(ast.children[0].name === "operator" && ast.children[0].value === "brackets")
            ) {
              const accessor = ast.children[0];
              const recordFieldNode = accessor.children[1];
              const record = evaluate(accessor.children[0], context) as RecordValue;
              const key = accessor.name === "access" ? recordFieldNode.value : evaluate(recordFieldNode, context);
              record.set(key, value);
              return value;
            }

            const name = ast.children[0].name === "name" ? ast.children[0].value : evaluate(ast.children[0], context);

            const entryIndex = context.scope.toIndex({ name });
            const entry = context.scope.scope[entryIndex];
            if (entry !== undefined) {
              entry.value.set?.(value);
            }

            return value;
          }

          case ":=": {
            const cont = (name) =>
              evaluate(ast.children[1], {
                ...context,
                continuation: (val) => ((context.scope = context.scope.add(name, { get: () => val })), val),
              });

            return ast.children[0].name === "name"
              ? cont(ast.children[0].value)
              : evaluate(ast.children[0], { ...context, continuation: cont });
          }

          case "atom": {
            const name = ast.children[0].value;
            return getAtom(name);
          }

          case "access": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (_record) => {
                const record = _record as RecordValue;
                return record.get(ast.children[1].value);
              },
            });
          }

          case "accessDynamic": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (_record) => {
                const record = _record as RecordValue;
                return evaluate(ast.children[1], {
                  ...context,
                  continuation: (key) => record.get(key),
                });
              },
            });
          }

          case "negate": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (val) => -(val as number),
            });
          }

          case "application": {
            return evaluate(ast.children[0], {
              ...context,
              continuation: (fn) => {
                const func = fn as FunctionValue;
                return func(expr(ast.children[1], context.scope, context.continuation));
              },
            });
          }
          case "symbol":
            return Symbol();
          case "brackets":
            return evaluate(ast.children[0], context);

          case "ref":
          case "deref":
          case "free":
          case "allocate": {
            throw new Error("Not implemented");
          }

          case "parallel":
          case "send":
          case "receive":
          case "peekSend":
          case "peekReceive":
          case "channel":
          case "import":
          case "importWith":
          case "export":
          case "exportAs":
          case "external":

          // must be eliminated by that point
          case "pipe":
          case "async":
          case "await":
          case "is":
          case "as":
          case "mut":
          case "->":
          case "pin":
          case "operator":
          case "operatorPrecedence":
          default:
            const impl = context.scope.getByName(ast.value);
            if (impl !== undefined) {
              return ast.children.reduce(
                (acc, child) => acc(expr(child, context.scope)) as FunctionValue,
                impl.value.get?.() as FunctionValue
              ) as Value;
            }
            throw new Error(`Operator ${ast.value} not implemented`);
        }
      }
      case "boolean":
        return Boolean(ast.value);
      case "float":
      case "int": {
        return Number(ast.value);
      }
      case "string": {
        return String(ast.value);
      }
      case "placeholder":
        return null;
      case "name": {
        return context.scope.getByName(ast.value)?.value.get?.() ?? null;
      }
      default:
        return null;
    }
  })();

  return context.continuation?.(result) ?? result;
};

class BreakError extends Error {
  constructor(public label?: any, public value: Value = null) {
    super("Break");
  }
}

class ReturnError extends Error {
  constructor(public value: Value = null) {
    super("Return");
  }
}

class YieldError extends Error {
  constructor(public value: Value = null) {
    super("Yield");
  }
}

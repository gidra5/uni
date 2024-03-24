import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
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
type ExprValue = { kind: "expr"; ast: AbstractSyntaxTree; scope: Scope<ScopeValue> };
type FunctionValue = (arg: ExprValue) => Value;
type Value = number | string | boolean | null | FunctionValue | RecordValue | SymbolValue | TypeValue;
type ScopeValue = { get?: () => Value; set?: (val: Value) => void; type?: TypeValue };
type Context = { scope: Scope<ScopeValue> };

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
const expr = (ast: AbstractSyntaxTree, scope: Scope<ScopeValue>): ExprValue => ({
  kind: "expr",
  ast,
  scope,
});
const fn =
  <T extends Value>(value: (arg: T) => Value): FunctionValue =>
  (arg) => {
    const evaluatedArg = evaluate(arg.ast, { scope: arg.scope });
    return value(evaluatedArg as T);
  };
const exprToRecord = (_expr: ExprValue): RecordValue => {
  const exprRecord: RecordValue = record();
  const children = _expr.ast.children.map<RecordValue>((child) => exprToRecord(expr(child, _expr.scope)));

  exprRecord.set("children", record(children));
  exprRecord.set("name", _expr.ast.name);
  exprRecord.set("value", jsValueToValue(_expr.ast.value));
  exprRecord.set("data", jsValueToValue(_expr.ast.data));

  return record([], { expr: exprRecord, env: _expr.scope as unknown as Value });
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
  return expr(_expr, env);
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
          const result = evaluate(ast.children[0], context);
          console.dir(result, { depth: null });
          return result;
        }

        case "ref":
        case "deref":
        case "free":
        case "allocate": {
          throw new Error("Not implemented");
        }

        case "+": {
          return ast.children.reduce((acc, child) => acc + (evaluate(child, context) as number), 0);
        }
        case "*": {
          return ast.children.reduce((acc, child) => acc * (evaluate(child, context) as number), 1);
        }
        case "-": {
          return (evaluate(ast.children[0], context) as number) - (evaluate(ast.children[1], context) as number);
        }
        case "/": {
          return (evaluate(ast.children[0], context) as number) / (evaluate(ast.children[1], context) as number);
        }
        case "%": {
          return (evaluate(ast.children[0], context) as number) % (evaluate(ast.children[1], context) as number);
        }
        case "^": {
          return Math.pow(evaluate(ast.children[0], context) as number, evaluate(ast.children[1], context) as number);
        }

        case "label": {
          const _record: RecordValue = record();
          const isRecordKey = ast.children[0].name === "name";
          const key = isRecordKey ? getAtom(ast.children[0].value) : evaluate(ast.children[0], context);
          const value = evaluate(ast.children[1], context);

          _record.set(key, value);
          return _record;
        }

        case ",": {
          return ast.children.reduce<RecordValue>((val, child) => {
            if (child.value === "label") {
              const isRecordKey = child.children[0].name === "name";
              const key = isRecordKey ? getAtom(child.children[0].value) : evaluate(child.children[0], context);
              const value = evaluate(child.children[1], context);
              val.set(key, value);
              return val;
            } else if (child.value === "...") {
              const value = evaluate(child.children[0], context);
              if (!isRecord(value)) return val;
              val.tuple.forEach((value) => val.tuple.push(value));
              val.map.forEach((value, key) => val.map.set(key, value));
              Object.assign(val.record, value.record);
              return val;
            }

            const value = evaluate(child, context);
            if (!value) return val;

            val.tuple.push(value);
            return val;
          }, record());
        }

        case "in": {
          const value = evaluate(ast.children[0], context);
          return (evaluate(ast.children[1], context) as RecordValue).has(value);
        }

        case "and": {
          return ast.children.every((child) => evaluate(child, context) as boolean);
        }

        case "or": {
          return ast.children.some((child) => evaluate(child, context) as boolean);
        }

        case "==": {
          return evaluate(ast.children[0], context) === evaluate(ast.children[1], context);
        }

        case "!=": {
          return evaluate(ast.children[0], context) !== evaluate(ast.children[1], context);
        }

        case "===": {
          return isEqual(evaluate(ast.children[0], context), evaluate(ast.children[1], context));
        }

        case "!==": {
          return !isEqual(evaluate(ast.children[0], context), evaluate(ast.children[1], context));
        }

        case "!": {
          const value = evaluate(ast.children[0], context);
          if (typeof value !== "boolean") return null;
          return !value;
        }

        case "<": {
          return (evaluate(ast.children[0], context) as number) < (evaluate(ast.children[1], context) as number);
        }

        case "<=": {
          return (evaluate(ast.children[0], context) as number) <= (evaluate(ast.children[1], context) as number);
        }

        case ">": {
          return (evaluate(ast.children[0], context) as number) > (evaluate(ast.children[1], context) as number);
        }

        case ">=": {
          return (evaluate(ast.children[0], context) as number) >= (evaluate(ast.children[1], context) as number);
        }

        case "macro": {
          const scope = context.scope;
          const name = ast.children[0].value;
          return (arg: ExprValue) => {
            const exprRecord = exprToRecord(arg);
            const continuationLabel = Symbol();
            exprRecord.set(getAtom("continuation"), (result: ExprValue) => {
              throw new BreakError(continuationLabel, exprToRecord(result));
            });
            const boundScope =
              name !== undefined ? scope.add(name, { get: () => exprRecord }) : scope.push({ get: () => exprRecord });
            try {
              return evaluate(ast.children[1], { scope: boundScope });
            } catch (error) {
              if (error instanceof BreakError && error.label === continuationLabel) {
                return error.value;
              }
              if (error instanceof ReturnError) {
                return error.value;
              }
              throw error;
            }
          };
        }

        case ";": {
          return ast.children
            .filter((x) => x.name !== "placeholder")
            .reduce<Value>((_, child) => evaluate(child, context), null);
        }

        case "#": {
          const node = ast.children[0];
          return context.scope.getByRelativeIndex(node.value)?.value.get?.() ?? null;
        }

        case "match": {
          const value = evaluate(ast.children[0], context);
          const scope = context.scope;
          const cases = ast.children.slice(1);
          for (const caseAst of cases) {
            const [pattern, body] = caseAst.children;
            context.scope = scope;
            const match = evaluate(pattern, context);
            if (isEqual(value, match)) {
              return evaluate(body, context);
            }
          }
          context.scope = scope;
          return null;
        }

        case "codeLabel": {
          const label = ast.children[0].value;
          const expr = ast.children[1];
          const labelValue = record([], {
            break: fn((val) => {
              throw new BreakError(val);
            }),
            continue: () => {
              throw new ContinueError();
            },
          });
          const scope = context.scope.add(label, { get: () => labelValue });

          while (true) {
            try {
              return evaluate(expr, { scope });
            } catch (error) {
              if (error instanceof BreakError) {
                return error.value;
              }
              if (error instanceof ContinueError) {
                continue;
              }
              throw error;
            }
          }
        }

        case "yield": {
          throw new YieldError(evaluate(ast.children[0], context));
        }

        case "pipe": {
          const value: ExprValue = expr(ast.children[0], context.scope);
          const func = evaluate(ast.children[1], context) as FunctionValue;
          return func(value);
        }

        case "=": {
          const value = evaluate(ast.children[1], context);

          if (ast.children[0].name !== "name" && ast.children[0].name !== "braces") {
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
          const name = ast.children[0].name === "name" ? ast.children[0].value : evaluate(ast.children[0], context);
          let value = evaluate(ast.children[1], context);
          context.scope = context.scope.add(name, { get: () => value, set: (val) => (value = val) });
          return value;
        }

        case "atom": {
          const name = ast.children[0].value;
          return getAtom(name);
        }

        case "access": {
          const value = evaluate(ast.children[0], context) as RecordValue;
          const key = ast.children[1].value;
          return value.record[key] ?? null;
        }

        case "accessDynamic": {
          const value = evaluate(ast.children[0], context) as RecordValue;
          const key = evaluate(ast.children[1], context);
          return value.get(key);
        }

        case "negate": {
          return -(evaluate(ast.children[0], context) as number);
        }

        case "application": {
          const func = evaluate(ast.children[0], context) as FunctionValue;
          return func(expr(ast.children[1], context.scope));
        }

        case "parallel":
        case "send":
        case "receive":
        case "peekSend":
        case "peekReceive":
        case "channel":
        case "set":
        case "import":
        case "importWith":
        case "use":
        case "useWith":
        case "export":
        case "exportAs":
        case "external":

        // must be eliminated by that point
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
    case "group": {
      switch (ast.value) {
        case "symbol":
          return Symbol();
        case "brackets":
        case "parens": {
          return evaluate(ast.children[0], context);
        }
        default:
          const impl = context.scope.getByName(ast.value);
          if (impl !== undefined) {
            return ast.children.reduce(
              (acc, child) => acc(expr(child, context.scope)) as FunctionValue,
              impl.value.get?.() as FunctionValue
            ) as Value;
          }
          return null;
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
};

class BreakError extends Error {
  constructor(public label?: any, public value: Value = null) {
    super("Break");
  }
}

class ContinueError extends Error {
  constructor(public label?: any, public value: Value = null) {
    super("Continue");
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

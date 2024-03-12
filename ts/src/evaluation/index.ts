import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { isEqual, omitASTDataScope } from "../utils/index.js";
import { match, template } from "../parser/utils.js";
import { parseExprString } from "../parser/string.js";

type SymbolValue = symbol;
type RecordValue = { kind: "record"; tuple: Value[]; record: { [key: string]: Value }; map: Map<Value, Value> };
type VariantValue = { kind: "variant"; tag: Value; value: Value };
type TypeValue = { kind: "type"; name: string; value: Value };
type ExprValue = { kind: "expr"; ast: AbstractSyntaxTree; scope: Scope<ScopeValue> };
type FunctionValue = (arg: ExprValue) => Value;
type Value =
  | number
  | string
  | boolean
  | null
  | FunctionValue
  | RecordValue
  | VariantValue
  | SymbolValue
  | TypeValue
  | ExprValue;
type ScopeValue = { value: Value; type?: TypeValue };
type Context = { scope: Scope<ScopeValue> };

const atoms: Record<string, symbol> = {};

const getAtom = (name: string): symbol => {
  if (!(name in atoms)) {
    atoms[name] = Symbol(name);
  }
  return atoms[name];
};

const isRecord = (value: Value): value is RecordValue =>
  !!value && typeof value === "object" && value.kind === "record";
const isExpr = (value: Value): value is ExprValue => !!value && typeof value === "object" && value.kind === "expr";

const record = (
  tuple: Value[] = [],
  record: { [key: string]: Value } = {},
  map: Map<Value, Value> = new Map()
): RecordValue => ({
  kind: "record",
  tuple,
  record,
  map,
});
const expr = (ast: AbstractSyntaxTree, scope: Scope<ScopeValue>): ExprValue => ({
  kind: "expr",
  ast: omitASTDataScope(ast),
  scope,
});
const fn =
  <T extends Value>(value: (arg: T) => Value): FunctionValue =>
  (arg) => {
    const evaluatedArg = evaluate(arg.ast, { scope: arg.scope });
    return value(evaluatedArg as T);
  };

const recordSet = (record: RecordValue, key: Value, value: Value): void => {
  if (key === null) return;

  if (value === null) {
    if (typeof key === "number") {
      record.tuple.splice(key, 1);
    } else if (typeof key === "symbol" && key.description) {
      delete record.record[key.description];
    } else {
      record.map.delete(key);
    }
    return;
  }

  if (typeof key === "number") {
    record.tuple[key] = value;
  } else if (typeof key === "symbol" && key.description) {
    record.record[key.description] = value;
  } else {
    record.map.set(key, value);
  }
};
const recordGet = (record: RecordValue, key: Value): Value => {
  if (key === null) return null;
  if (typeof key === "number") return record.tuple[key] ?? null;
  if (typeof key === "symbol" && key.description) return record.record[key.description] ?? null;
  return record.map.get(key) ?? null;
};
const recordHas = (record: RecordValue, key: Value): boolean => {
  if (key === null) return false;
  if (typeof key === "number") return key in record.tuple;
  if (typeof key === "symbol" && key.description) return key.description in record.record;
  return record.map.has(key);
};
export const initialContext = (): Context => {
  const context = {
    scope: new Scope<ScopeValue>({
      bind: {
        value: fn((_expr: ExprValue) =>
          fn((names: RecordValue) => {
            const scope = _expr.scope
              .push(...names.tuple.map((value) => ({ value })))
              .append(
                new Scope(
                  Iterator.iterEntries(names.record)
                    .map<[string, ScopeValue]>(([name, value]) => [name, { value }])
                    .toObject()
                )
              )
              .append(
                new Scope(
                  Iterator.iter(names.map)
                    .filter<[string, Value]>((x): x is [string, Value] => typeof x[0] === "string")
                    .map<[string, ScopeValue]>(([key, value]) => [key, { value }])
                    .toObject()
                )
              );
            // console.dir({ names, _expr, scope }, { depth: null });
            return expr(_expr.ast, scope);
          })
        ),
      },
      node: {
        value: fn((_expr: ExprValue) => {
          const _record: RecordValue = record();
          const children = _expr.ast.children.map<ExprValue>((child) => expr(child, _expr.scope));

          _record.record.children = record(children);
          _record.record.name = _expr.ast.name;
          _record.record.value = _expr.ast.value;
          _record.record.data = record([], _expr.ast.data);
          return _record;
        }),
      },
      eval: {
        value: fn((value) => {
          if (!isExpr(value)) return null;
          return evaluate(value.ast, { scope: value.scope });
        }),
      },
      quote: { value: (expr) => expr },
    }),
  };
  context.scope = context.scope.add("fn", {
    value: evaluate(
      parseExprString(
        `macro name_expr -> macro body_expr -> {
          returnLabel := symbol
          name_node := node name_expr 
          name := if (:value) in name_node: name_node.value else 0
          body_expr := bind body_expr (["return"]: (macro value -> {
            expr := quote break eval value
            expr_node := node expr
            expr_node.data.label = returnLabel
            eval expr
          }))

          macro arg_expr -> {
            arg := eval arg_expr
            body := quote { eval (bind body_expr ([name]: arg)) }
            body_node := node body
            body_node.data.label = returnLabel
            eval body
          }
        }`
      )[0],
      context
    ),
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
          recordSet(_record, key, value);
          return _record;
        }

        case ",": {
          return ast.children.reduce<RecordValue>((val, child) => {
            if (child.value === "label") {
              const isRecordKey = child.children[0].name === "name";
              const key = isRecordKey ? getAtom(child.children[0].value) : evaluate(child.children[0], context);
              const value = evaluate(child.children[1], context);
              recordSet(val, key, value);
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
          return recordHas(evaluate(ast.children[1], context) as RecordValue, value);
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
            try {
              const boundScope = name !== undefined ? scope.add(name, { value: arg }) : scope.push({ value: arg });
              return evaluate(ast.children[1], { scope: boundScope });
            } catch (error) {
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
          return context.scope.getByRelativeIndex(node.value)?.value.value ?? null;
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

        case "if": {
          const scope = context.scope;
          const condition = evaluate(ast.children[0], context);
          if (condition) {
            const result = evaluate(ast.children[1], context);
            context.scope = scope;
            return result;
          }
          context.scope = scope;
          return null;
        }

        case "ifElse": {
          const scope = context.scope;
          const condition = evaluate(ast.children[0], context);
          if (condition) {
            const result = evaluate(ast.children[1], context);
            context.scope = scope;
            return result;
          }
          context.scope = scope;
          const result = evaluate(ast.children[2], context);
          context.scope = scope;
          return result;
        }

        case "break": {
          // console.dir(["break", omitASTDataScope(ast)], { depth: null });

          throw new BreakError(ast.data.label, evaluate(ast.children[0], context));
        }

        case "continue": {
          throw new ContinueError(ast.data.label, evaluate(ast.children[0], context));
        }

        // case "return": {
        //   throw new ReturnError(evaluate(ast.children[0], context));
        // }

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

          if (ast.children[0].name === "name") {
            const name = ast.children[0].value;
            const entryIndex = context.scope.toIndex({ name });
            const entry = context.scope.scope[entryIndex];
            if (entry !== undefined) {
              entry.value.value = value;
            }
          } else {
            const accessor = ast.children[0];
            const recordFieldNode = accessor.children[1];
            const record = evaluate(accessor.children[0], context) as RecordValue;
            const key = accessor.name === "access" ? recordFieldNode.value : evaluate(recordFieldNode, context);
            recordSet(record, key, value);
          }

          return value;
        }

        case ":=": {
          const name = ast.children[0].value;
          const value = evaluate(ast.children[1], context);
          context.scope = context.scope.add(name, { value });
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
          return recordGet(value, key);
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
        case "inRange_<_<":
        case "inRange_<=_<":
        case "inRange_<_<=":
        case "inRange_<=_<=":
        case "inRange_>_>":
        case "inRange_>=_>":
        case "inRange_>_>=":
        case "inRange_>=_>=":
        case "inRange_<_>":
        case "inRange_<=_>":
        case "inRange_<_>=":
        case "inRange_<=_>=":
        case "inRange_>_<":
        case "inRange_>=_<":
        case "inRange_>_<=":
        case "inRange_>=_<=":
        case "async":
        case "await":
        case "is":
        case "as":
        case "mut":
        case "->":
        case "pin":
        case "...":
        case "matchColon":
        case "ifBlock":
        case "ifElseBlock":
        case "ifBlockElseBlock":
        case "forBlock":
        case "whileBlock":
        case "loopBlock":
        case "while":
        case "for":
        case "loop":
        case "operator":
        case "operatorPrecedence":
        case "prefixDecrement":
        case "prefixIncrement":
        case "postfixDecrement":
        case "postfixIncrement":
        default:
          const impl = context.scope.getByName(ast.value);
          if (impl !== undefined) {
            return ast.children.reduce(
              (acc, child) => acc(expr(child, context.scope)) as FunctionValue,
              impl.value.value as FunctionValue
            ) as Value;
          }
          throw new Error(`Operator ${ast.value} not implemented`);
      }
    }
    case "group": {
      switch (ast.value) {
        case "true":
          return true;
        case "false":
          return false;
        case "symbol":
          return Symbol();
        case "brackets":
        case "parens": {
          return evaluate(ast.children[0], context);
        }
        case "braces": {
          const scope = context.scope;
          while (true) {
            try {
              const result = evaluate(ast.children[0], context);
              context.scope = scope;
              return result;
            } catch (error) {
              context.scope = scope;
              if (!(error instanceof BreakError) && !(error instanceof ContinueError)) throw error;
              if (error.label !== undefined && error.label !== ast.data.label) throw error;

              if (error instanceof BreakError) return error.value;
              if (error instanceof ContinueError) continue;
            }
          }
        }
        default:
          const impl = context.scope.getByName(ast.value);
          if (impl !== undefined) {
            return ast.children.reduce(
              (acc, child) => acc(expr(child, context.scope)) as FunctionValue,
              impl.value.value as FunctionValue
            ) as Value;
          }
          return null;
      }
    }
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
      return context.scope.getByName(ast.value)?.value.value ?? null;
    }
    default:
      return null;
  }
};

class BreakError extends Error {
  constructor(public label?: string, public value: Value = null) {
    super("Break");
  }
}

class ContinueError extends Error {
  constructor(public label?: string, public value: Value = null) {
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
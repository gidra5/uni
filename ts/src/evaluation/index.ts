import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope.js";
import { isEqual, omitASTDataScope } from "../utils/index.js";
import { match, template } from "../parser/utils";

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
export const initialContext = (): Context => ({
  scope: new Scope<ScopeValue>({
    bind: {
      value: (expr) => (_names) => {
        const names = evaluate(_names.ast, { scope: _names.scope }) as RecordValue;
        const scope = _names.scope.push(...names.tuple.map((value) => ({ value }))).append(
          new Scope(
            Iterator.iterEntries(names.record)
              .map<[string, ScopeValue]>(([name, value]) => [name, { value }])
              .toObject()
          )
        );
        return { kind: "expr", ast: expr.ast, scope };
      },
    },
    // match_expr: {
    //   value: (pattern) => (expr) => {
    //     const matched = match(expr.ast, pattern.ast);
    // } },
    eval: { value: (expr) => evaluate(expr.ast, { scope: expr.scope }) },
    quote: { value: (expr) => expr },
  }),
});

export const evaluate = (ast: AbstractSyntaxTree, context = initialContext()): Value => {
  console.dir(
    {
      msg: "evaluate",
      ast: omitASTDataScope(ast),
      context,
    },
    { depth: null }
  );

  switch (ast.name) {
    case "program":
      return evaluate(ast.children[0], context);
    case "operator": {
      switch (ast.value) {
        case "print": {
          const result = evaluate(ast.children[0], context);
          console.log(result);
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

        case ",": {
          return ast.children.reduce<RecordValue>(
            (val, child) => {
              if (child.value === "label") {
                const isRecordKey = child.children[0].name === "name";
                if (isRecordKey) {
                  const key = child.children[0].value;
                  val.record[key] = evaluate(child.children[1], context);
                } else {
                  const key = evaluate(child.children[0], context);
                  if (key === null) {
                    return val;
                  } else if (typeof key === "number") {
                    val.tuple[key] = evaluate(child.children[1], context);
                  } else if (typeof key === "string") {
                    val.record[key] = evaluate(child.children[1], context);
                  } else {
                    val.map.set(key, evaluate(child.children[1], context));
                  }
                }
              } else {
                val.tuple.push(evaluate(child, context));
              }
              return val;
            },
            { kind: "record", map: new Map(), record: {}, tuple: [] }
          );
        }

        case "in": {
          const value = evaluate(ast.children[1], context);
          if (value === null) return null;
          if (typeof value !== "object") return null;
          if (value.kind !== "record") return null;
          const key = evaluate(ast.children[0], context);
          return recordGet(value, key) !== null;
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

        case "macro":
        case "fn": {
          const scope = context.scope;
          const name = ast.children[0].value;
          return (arg: ExprValue) => {
            if (ast.value === "fn") arg = evaluate(arg.ast, { scope: arg.scope }) as ExprValue;
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
          return ast.children.reduce<Value>((_, child) => evaluate(child, context), null);
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

        case "loop": {
          const scope = context.scope;
          const values: Value[] = [];
          let i = 0;
          while (i < 100) {
            let value: Value;
            try {
              context.scope = scope;
              value = evaluate(ast.children[0], context);
              // console.log("loop result", result);

              if (value !== null) {
                values.push(value);
              }
            } catch (error) {
              if (!(error instanceof BreakError) && !(error instanceof ContinueError)) throw error;
              if (error.label !== undefined && error.label !== ast.data.label) {
                throw error;
              }

              const value = error.value;
              if (value !== null) {
                values.push(value);
              }

              if (error instanceof BreakError) break;
              if (error instanceof ContinueError) continue;
            }
            i++;
          }
          return { kind: "record", map: new Map(), record: {}, tuple: values };
        }

        case "break": {
          // console.dir(["break", omitASTDataScope(ast)], { depth: null });

          throw new BreakError(ast.data.label, evaluate(ast.children[0], context));
        }

        case "continue": {
          throw new ContinueError(ast.data.label, evaluate(ast.children[0], context));
        }

        case "return": {
          throw new ReturnError(evaluate(ast.children[0], context));
        }

        case "yield": {
          throw new YieldError(evaluate(ast.children[0], context));
        }

        case "pipe": {
          const value: ExprValue = { kind: "expr", ast: ast.children[0], scope: context.scope };
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
          return func({ kind: "expr", ast: ast.children[1], scope: context.scope });
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
        case "label":
        case "operator":
        case "operatorPrecedence":
        case "prefixDecrement":
        case "prefixIncrement":
        case "postfixDecrement":
        case "postfixIncrement":
        default:
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
          try {
            const result = evaluate(ast.children[0], context);
            context.scope = scope;
            return result;
          } catch (error) {
            context.scope = scope;
            if (error instanceof BreakError) {
              if (error.label !== undefined && error.label !== ast.data.label) {
                throw error;
              }
              return error.value;
            }
            throw error;
          }
        }
        case "brackets":
        default:
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

import { AbstractSyntaxTree } from "../parser/ast.js";
import { isEqual } from "../utils/index.js";
import { ExprValue, FunctionValue, RecordValue, Value } from "./types.js";
import { exprToRecord, initialContext, isRecord } from "./utils.js";
import { expr, fn, record } from "./values.js";
import { getAtom } from "./atoms.js";

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

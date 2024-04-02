import { isEqual } from "../utils/index.js";
import { ChannelValue, Evaluate, ExprValue, FunctionValue, RecordValue, Value } from "./types.js";
import { initialContext } from "./utils.js";
import { expr, fn, record, isRecord, channel } from "./values.js";
import { getAtom } from "./atoms.js";
import { AbstractSyntaxTree } from "../parser/ast.js";

export const evaluate: Evaluate = (taskQueue, ast, context = initialContext(taskQueue)) => {
  const _return = (value: Value) => context.continuation(value);

  const evalChildren = (
    reducer: (v: Value[]) => void,
    [head, ...tail]: AbstractSyntaxTree["children"],
    v: Value[] = []
  ) => {
    evaluate(taskQueue, head, {
      ...context,
      continuation: (value) => {
        const result = [...v, value];
        if (tail.length === 0) return reducer(result);
        evalChildren(reducer, tail, result);
      },
    });
  };

  const evalReturnChildren = (
    reducer: (v: Value[]) => Value,
    [head, ...tail]: AbstractSyntaxTree["children"],
    v: Value[] = []
  ) => evalChildren((vals) => _return(reducer(vals)), [head, ...tail], v);

  switch (ast.name) {
    case "operator": {
      switch (ast.value) {
        case "print": {
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (value) => {
              console.dir(value, { depth: null });
              _return(value);
            },
          });
        }

        case "+": {
          evalReturnChildren((vals) => vals.reduce((acc: number, val) => acc + (val as number), 0), ast.children);
        }
        case "*": {
          evalReturnChildren((vals) => vals.reduce((acc: number, val) => acc * (val as number), 1), ast.children);
        }
        case "-": {
          evalReturnChildren(([left, right]) => (left as number) - (right as number), ast.children);
        }
        case "/": {
          evalReturnChildren(([left, right]) => (left as number) / (right as number), ast.children);
        }
        case "%": {
          evalReturnChildren(([left, right]) => (left as number) % (right as number), ast.children);
        }
        case "^": {
          evalReturnChildren(([left, right]) => Math.pow(left as number, right as number), ast.children);
        }

        case "set": {
          evalReturnChildren(([tuple, key, value]) => {
            const record = tuple as RecordValue;
            record.set(key, value);
            return record;
          }, ast.children);
        }
        case "push": {
          evalReturnChildren(([tuple, value]) => {
            const record = tuple as RecordValue;
            record.tuple.push(value);
            return record;
          }, ast.children);
        }
        case "join": {
          evalReturnChildren(([tuple, value]) => {
            if (!isRecord(value)) return tuple;
            const record = tuple as RecordValue;

            value.tuple.forEach((value) => record.tuple.push(value));
            value.map.forEach((value, key) => record.map.set(key, value));
            Object.assign(record.record, value.record);

            return record;
          }, ast.children);
        }

        case "in": {
          evalReturnChildren(([tuple, key]) => {
            const record = tuple as RecordValue;
            return record.has(key);
          }, ast.children);
        }
        case "and": {
          evalReturnChildren((vals) => vals.every((val) => val), ast.children);
        }
        case "or": {
          evalReturnChildren((vals) => vals.some((val) => val), ast.children);
        }
        case "==": {
          evalReturnChildren(([left, right]) => left === right, ast.children);
        }
        case "===": {
          evalReturnChildren(([left, right]) => isEqual(left, right), ast.children);
        }
        case "!": {
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (value) => _return(!value),
          });
        }
        case "<": {
          evalReturnChildren(([left, right]) => (left as number) < (right as number), ast.children);
        }

        case "macro": {
          const scope = context.scope;
          context.continuation((arg, continuation) => {
            const boundScope = scope.push({ get: () => arg, set: (value) => (arg = value as ExprValue) });

            evaluate(taskQueue, ast.children[0], { scope: boundScope, continuation });
          });
        }

        case "fn": {
          const scope = context.scope;
          context.continuation((arg, continuation) => {
            const outChannel = Symbol("fn.out");

            evaluate(taskQueue, arg.ast, {
              scope: arg.scope,
              continuation: (arg) => {
                const boundScope = scope.push({ get: () => arg, set: (value) => (arg = value) });

                evaluate(taskQueue, ast.children[0], { scope: boundScope, continuation });
              },
            });
            return outChannel;
          });
        }

        case "eval": {
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (value) => {
              const expr = value as ExprValue;
              evaluate(taskQueue, expr.ast, { scope: expr.scope, continuation: context.continuation });
            },
          });
        }

        case "codeLabel": {
          const label = ast.children[0].value;
          const expr = ast.children[1];
          const continuation = context.continuation;

          const labelValue: FunctionValue = fn(taskQueue, (value) => {
            continuation(value);
            return null;
          });
          const scope = context.scope.add(label, { get: () => labelValue });

          evaluate(taskQueue, expr, { continuation, scope });
        }

        case "=": {
          evaluate(taskQueue, ast.children[1], {
            ...context,
            continuation: (value) => {
              if (
                ast.children[0].name !== "name" &&
                !(ast.children[0].name === "operator" && ast.children[0].value === "brackets")
              ) {
                const accessor = ast.children[0];
                evaluate(taskQueue, accessor.children[0], {
                  ...context,
                  continuation: (_record) => {
                    const recordFieldNode = accessor.children[1];
                    const record = _record as RecordValue;

                    if (accessor.name === "access") {
                      const key = recordFieldNode.value;
                      record.set(key, value);
                      return _return(value);
                    }

                    evaluate(taskQueue, recordFieldNode, {
                      ...context,
                      continuation: (key) => {
                        record.set(key, value);
                        return _return(value);
                      },
                    });
                  },
                });
              }

              if (ast.children[0].name === "name") {
                const name = ast.children[0].value;
                const entryIndex = context.scope.toIndex({ name });
                const entry = context.scope.scope[entryIndex];
                entry?.value.set?.(value);
                return _return(value);
              }

              evaluate(taskQueue, ast.children[0], {
                ...context,
                continuation: (name) => {
                  const entryIndex = context.scope.toIndex({ name: name as string });
                  const entry = context.scope.scope[entryIndex];
                  entry?.value.set?.(value);
                  return _return(value);
                },
              });
            },
          });
        }

        case ":=": {
          evaluate(taskQueue, ast.children[1], {
            ...context,
            continuation: (value) => {
              const entry = { get: () => value, set: (_value) => (value = _value) };
              if (ast.children[0].name === "name") {
                const name = ast.children[0].value;
                context.scope = context.scope.add(name, entry);
                return _return(value);
              }

              evaluate(taskQueue, ast.children[0], {
                ...context,
                continuation: (name) => {
                  context.scope = context.scope.add(name as string, entry);
                  return _return(value);
                },
              });
            },
          });
        }

        case "access": {
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (value) => {
              const record = value as RecordValue;
              _return(record.get(ast.children[1].value));
            },
          });
        }

        case "accessDynamic": {
          evalReturnChildren(([record, key]) => {
            return (record as RecordValue).get(key);
          }, ast.children);
        }

        case "negate": {
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (value) => _return(-(value as number)),
          });
        }

        case "application": {
          const arg = expr(ast.children[1], context.scope);
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (fn) => {
              const func = fn as FunctionValue;
              func(arg, context.continuation);
            },
          });
        }
        case "brackets": {
          evaluate(taskQueue, ast.children[0], context);
        }

        case "send": {
          evalChildren(([_channel, value]) => {
            const { channel } = _channel as ChannelValue;
            const callbackChannel = Symbol("send.callback");
            const message = record(taskQueue, [value, callbackChannel]);

            taskQueue.createConsumeTask(callbackChannel, _return);
            taskQueue.createProduceTask(channel, () => message);
          }, ast.children);
        }
        case "receive": {
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (_channel) => {
              const { channel } = _channel as ChannelValue;
              taskQueue.createConsumeTask(channel, (_message) => {
                const message = _message as RecordValue;
                const [value, callbackChannel] = message.tuple;
                taskQueue.send(callbackChannel as symbol, value);
                _return(value);
              });
            },
          });
        }
        case "peekSend": {
          evalReturnChildren(([_channel, value]) => {
            const { channel } = _channel as ChannelValue;
            const callbackChannel = Symbol("peekSend.callback");
            if (taskQueue.ready(channel)) return record(taskQueue, [getAtom("err"), null]);
            const message = record(taskQueue, [value, callbackChannel]);
            taskQueue.send(channel, message);
            return record(taskQueue, [getAtom("ok"), value, callbackChannel]);
          }, ast.children);
        }
        case "peekReceive": {
          evaluate(taskQueue, ast.children[0], {
            ...context,
            continuation: (_channel) => {
              const { channel } = _channel as ChannelValue;
              if (taskQueue.ready(channel)) {
                const message = taskQueue.receive(channel) as RecordValue;
                const [value, callbackChannel] = message.tuple;
                taskQueue.send(callbackChannel as symbol, value);
                _return(record(taskQueue, [getAtom("ok"), value]));
                return;
              }
              _return(record(taskQueue, [getAtom("err"), null]));
            },
          });
        }
        case "parallel": {
          ast.children.map((child) => evaluate(taskQueue, child, context));
        }
        case "select": {
          let consumed = false;
          ast.children.map((child) =>
            evaluate(taskQueue, child, {
              ...context,
              continuation: (arg) => {
                if (consumed) return;
                consumed = true;
                context.continuation(arg);
              },
            })
          );
        }

        case "ref":
        case "deref":
        case "free":
        case "allocate": {
          throw new Error("Not implemented");
        }

        case "import":
        case "importWith":

        // must be eliminated by that point
        case "export":
        case "exportAs":
        case "external":
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
          throw new Error(`Operator ${ast.value} not implemented`);
      }
    }

    case "unit": {
      _return(record(taskQueue));
    }

    case "symbol": {
      _return(Symbol());
    }

    case "channel": {
      _return(channel());
    }

    case "atom": {
      _return(getAtom(ast.children[0].value));
    }

    case "boolean": {
      _return(Boolean(ast.value));
    }

    case "float":
    case "int": {
      _return(Number(ast.value));
    }

    case "string": {
      _return(String(ast.value));
    }

    case "name": {
      const entry =
        typeof ast.value === "number"
          ? context.scope.getByRelativeIndex(ast.value)
          : context.scope.getByName(ast.value);
      const value = entry?.value.get?.() ?? null;
      _return(value);
    }

    case "placeholder":
    default:
      _return(null);
  }
};

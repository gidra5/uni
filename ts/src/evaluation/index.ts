import { AbstractSyntaxTree } from "../parser/ast.js";
import { isEqual } from "../utils/index.js";
import {
  ExprValue,
  FunctionValue,
  RecordValue,
  TaskQueueExprValue,
  TaskQueueFunctionValue,
  TaskQueueRecordValue,
  TaskQueueValue,
  Value,
} from "./types.js";
import {
  exprToRecord,
  initialContext,
  initialTaskQueueContext,
  isRecord,
  isTaskQueueRecord,
  taskQueueExprToRecord,
} from "./utils.js";
import { expr, fn, record, taskQueueExpr, taskQueueFn, taskQueueRecord } from "./values.js";
import { getAtom } from "./atoms.js";
import { TaskQueue } from "./taskQueue.js";

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

          case "#": {
            return context.scope.getByRelativeIndex(ast.value)?.value.get?.() ?? null;
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
        const entry =
          typeof ast.value === "number"
            ? context.scope.getByRelativeIndex(ast.value)
            : context.scope.getByName(ast.value);

        return entry?.value.get?.() ?? null;
      }
      default:
        return null;
    }
  })();

  return context.continuation?.(result) ?? result;
};

const taskQueueFanIn =
  (taskQueue: TaskQueue) =>
  (channels: symbol[], task: (vals: TaskQueueValue[]) => TaskQueueValue): symbol => {
    const vals: TaskQueueValue[] = [];
    const outChannel = Symbol("fanIn.out");

    for (const channel of channels) {
      taskQueue.createConsumeTask(channel, (val) => {
        vals.push(val);
        if (vals.length === channels.length) {
          taskQueue.send(outChannel, task(vals));
        }
      });
    }
    return outChannel;
  };

export const taskQueueEvaluate = (
  taskQueue: TaskQueue,
  ast: AbstractSyntaxTree,
  context = initialTaskQueueContext(taskQueue)
): symbol => {
  const fanIn = taskQueueFanIn(taskQueue);
  switch (ast.name) {
    case "operator": {
      switch (ast.value) {
        case "print": {
          const id = taskQueueEvaluate(taskQueue, ast.children[0], context);
          return taskQueue.createTransformTaskOutChannel(id, (val) => {
            console.dir(val, { depth: null });
            return val;
          });
        }

        case "+": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, (vals) => vals.reduce((acc: number, val) => acc + (val as number), 0));
        }
        case "*": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, (vals) => vals.reduce((acc: number, val) => acc * (val as number), 1));
        }
        case "-": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => (left as number) - (right as number));
        }
        case "/": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => (left as number) / (right as number));
        }
        case "%": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => (left as number) % (right as number));
        }
        case "^": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => Math.pow(left as number, right as number));
        }

        case "set": {
          const tuple = taskQueueEvaluate(taskQueue, ast.children[0], context);
          const key = taskQueueEvaluate(taskQueue, ast.children[1], context);
          const value = taskQueueEvaluate(taskQueue, ast.children[2], context);

          return fanIn([tuple, key, value], ([tupleVal, keyVal, valueVal]) => {
            const record = tupleVal as TaskQueueRecordValue;
            record.set(keyVal, valueVal);
            return record;
          });
        }
        case "push": {
          const tuple = taskQueueEvaluate(taskQueue, ast.children[0], context);
          const value = taskQueueEvaluate(taskQueue, ast.children[1], context);

          return fanIn([tuple, value], ([tupleVal, valueVal]) => {
            const record = tupleVal as TaskQueueRecordValue;
            // console.log("push", record);

            record.tuple.push(valueVal);
            return record;
          });
        }
        case "join": {
          const tuple = taskQueueEvaluate(taskQueue, ast.children[0], context);
          const value = taskQueueEvaluate(taskQueue, ast.children[1], context);

          return fanIn([tuple, value], ([tupleVal, valueVal]) => {
            if (!isTaskQueueRecord(valueVal)) return tupleVal;
            const record = tupleVal as TaskQueueRecordValue;
            valueVal.tuple.forEach((value) => record.tuple.push(value));
            valueVal.map.forEach((value, key) => record.map.set(key, value));
            Object.assign(record.record, valueVal.record);
            return record;
          });
        }
        case "unit": {
          return taskQueue.createProduceTaskChannel(() => taskQueueRecord(taskQueue));
        }

        case "in": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => {
            const record = right as TaskQueueRecordValue;
            return record.has(left);
          });
        }
        case "and": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, (vals) => vals.every((val) => val));
        }
        case "or": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, (vals) => vals.some((val) => val));
        }
        case "==": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => left === right);
        }
        case "===": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => isEqual(left, right));
        }
        case "!": {
          return taskQueue.createTransformTaskOutChannel(
            taskQueueEvaluate(taskQueue, ast.children[0], context),
            (val) => !val
          );
        }
        case "<": {
          const channels = ast.children.map((child) => taskQueueEvaluate(taskQueue, child, context));

          return fanIn(channels, ([left, right]) => (left as number) < (right as number));
        }

        case "macro": {
          const scope = context.scope;
          const name = ast.children[0].value;
          return taskQueue.createProduceTaskChannel(() => (argChannel) => {
            const outChannel = Symbol("macro.out");
            taskQueue.createConsumeTask(argChannel, (_arg) => {
              const arg = _arg as unknown as TaskQueueExprValue;
              const exprRecord = taskQueueExprToRecord(taskQueue, arg);
              const boundScope =
                name !== undefined ? scope.add(name, { get: () => exprRecord }) : scope.push({ get: () => exprRecord });

              const resultChannel = taskQueueEvaluate(taskQueue, ast.children[1], { scope: boundScope });
              taskQueue.pipe(resultChannel, outChannel);
            });
            return outChannel;
          });
        }

        case "#": {
          return taskQueue.createProduceTaskChannel(
            () => context.scope.getByRelativeIndex(ast.value)?.value.get?.() ?? null
          );
        }

        case "codeLabel": {
          const label = ast.children[0].value;
          const expr = ast.children[1];
          const outChannel = Symbol("codeLabel.out");
          const labelValue: TaskQueueFunctionValue = taskQueueFn(taskQueue, (value) => {
            taskQueue.send(outChannel, value);
            return null;
          });
          const scope = context.scope.add(label, { get: () => labelValue });

          const result = taskQueueEvaluate(taskQueue, expr, { ...context, scope });
          taskQueue.pipe(result, outChannel);
          return outChannel;
        }

        case "=": {
          const value = taskQueueEvaluate(taskQueue, ast.children[1], context);

          if (
            ast.children[0].name !== "name" &&
            !(ast.children[0].name === "operator" && ast.children[0].value === "brackets")
          ) {
            const accessor = ast.children[0];
            const recordFieldNode = accessor.children[1];
            const record = taskQueueEvaluate(taskQueue, accessor.children[0], context);
            const key =
              accessor.name === "access"
                ? taskQueue.createProduceTaskChannel(() => recordFieldNode.value)
                : taskQueueEvaluate(taskQueue, recordFieldNode, context);

            return fanIn([record, key, value], ([recordVal, keyVal, valueVal]) => {
              const record = recordVal as TaskQueueRecordValue;
              record.set(keyVal, valueVal);
              return valueVal;
            });
          }

          const name =
            ast.children[0].name === "name"
              ? taskQueue.createProduceTaskChannel(() => ast.children[0].value)
              : taskQueueEvaluate(taskQueue, ast.children[0], context);

          return fanIn([name, value], ([nameVal, valueVal]) => {
            const entryIndex = context.scope.toIndex({ name: nameVal as string });
            const entry = context.scope.scope[entryIndex];
            entry?.value.set?.(valueVal);
            return valueVal;
          });
        }

        case ":=": {
          const value = taskQueueEvaluate(taskQueue, ast.children[1], context);
          const name =
            ast.children[0].name === "name"
              ? taskQueue.createProduceTaskChannel(() => ast.children[0].value)
              : taskQueueEvaluate(taskQueue, ast.children[0], context);

          return fanIn([name, value], ([nameVal, valueVal]) => {
            context.scope = context.scope.add(nameVal as string, { get: () => valueVal });
            return valueVal;
          });
        }

        case "atom": {
          return taskQueue.createProduceTaskChannel(() => getAtom(ast.children[0].value));
        }

        case "access": {
          return taskQueue.createTransformTaskOutChannel(
            taskQueueEvaluate(taskQueue, ast.children[0], context),
            (record) => {
              const recordValue = record as TaskQueueRecordValue;
              return recordValue.get(ast.children[1].value);
            }
          );
        }

        case "accessDynamic": {
          const record = taskQueueEvaluate(taskQueue, ast.children[0], context);
          const key = taskQueueEvaluate(taskQueue, ast.children[1], context);

          return fanIn([record, key], ([recordVal, keyVal]) => {
            const record = recordVal as TaskQueueRecordValue;
            return record.get(keyVal);
          });
        }

        case "negate": {
          return taskQueue.createTransformTaskOutChannel(
            taskQueueEvaluate(taskQueue, ast.children[0], context),
            (val) => -(val as number)
          );
        }

        case "application": {
          const fnChannel = taskQueueEvaluate(taskQueue, ast.children[0], context);
          const argChannel = taskQueue.createProduceTaskChannel(() => taskQueueExpr(ast.children[1], context.scope));
          const outChannel = Symbol("application.out");
          taskQueue.createConsumeTask(fnChannel, (fn) => {
            const func = fn as TaskQueueFunctionValue;
            taskQueue.pipe(func(argChannel), outChannel);
          });
          return outChannel;
        }
        case "symbol": {
          return taskQueue.createProduceTaskChannel(() => Symbol());
        }
        case "brackets": {
          return taskQueueEvaluate(taskQueue, ast.children[0], context);
        }

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
          throw new Error(`Operator ${ast.value} not implemented`);
      }
    }
    case "boolean": {
      return taskQueue.createProduceTaskChannel(() => Boolean(ast.value));
    }
    case "float":
    case "int": {
      return taskQueue.createProduceTaskChannel(() => Number(ast.value));
    }
    case "string": {
      return taskQueue.createProduceTaskChannel(() => String(ast.value));
    }
    case "placeholder":
      return taskQueue.createProduceTaskChannel(() => null);
    case "name": {
      return taskQueue.createProduceTaskChannel(() => {
        const entry =
          typeof ast.value === "number"
            ? context.scope.getByRelativeIndex(ast.value)
            : context.scope.getByName(ast.value);

        return entry?.value.get?.() ?? null;
      });
    }
    default:
      return taskQueue.createProduceTaskChannel(() => null);
  }
};

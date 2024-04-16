import { isEqual } from "../utils/index.js";
import { ChannelValue, Evaluate, ExprValue, FunctionValue, RecordValue, Value, ValueRef } from "./types.js";
import { initialContext } from "./utils.js";
import { expr, fn, record, isRecord, channel, immutableRef, ref } from "./values.js";
import { getAtom } from "./atoms.js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import type { ScopeEntryIdentifier } from "../scope.js";

export const evaluate: Evaluate = (taskQueue, ast, context = initialContext(taskQueue), continuation) => {
  const evalChildren = (
    reducer: (v: Value[]) => void,
    [head, ...tail]: AbstractSyntaxTree["children"],
    v: Value[] = []
  ) => {
    evaluate(taskQueue, head, context, (value) => {
      const result = [...v, value];
      if (tail.length === 0) return reducer(result);
      evalChildren(reducer, tail, result);
    });
  };

  const evalReturnChildren = (
    reducer: (v: Value[]) => Value,
    [head, ...tail]: AbstractSyntaxTree["children"],
    v: Value[] = []
  ) => evalChildren((vals) => continuation(reducer(vals)), [head, ...tail], v);

  const evalShortcircuit = (
    consumer: (v: Value[]) => void,
    circuit: (v: Value[]) => boolean,
    [head, ...tail]: AbstractSyntaxTree["children"],
    v: Value[] = []
  ) => {
    evaluate(taskQueue, head, context, (value) => {
      const result = [...v, value];
      if (circuit(result)) return consumer(result);
      if (tail.length === 0) return consumer(result);
      evalShortcircuit(consumer, circuit, tail, result);
    });
  };

  switch (ast.name) {
    case "operator": {
      switch (ast.value) {
        case "print": {
          evaluate(taskQueue, ast.children[0], context, (value) => {
            console.dir(value, { depth: null });
            continuation(value);
          });
          return;
        }

        case "+": {
          evalReturnChildren((vals) => vals.reduce((acc: number, val) => acc + (val as number), 0), ast.children);
          return;
        }
        case "*": {
          evalReturnChildren((vals) => vals.reduce((acc: number, val) => acc * (val as number), 1), ast.children);
          return;
        }
        case "-": {
          evalReturnChildren(([left, right]) => (left as number) - (right as number), ast.children);
          return;
        }
        case "/": {
          evalReturnChildren(([left, right]) => (left as number) / (right as number), ast.children);
          return;
        }
        case "%": {
          evalReturnChildren(([left, right]) => (left as number) % (right as number), ast.children);
          return;
        }
        case "^": {
          evalReturnChildren(([left, right]) => Math.pow(left as number, right as number), ast.children);
          return;
        }

        case "set": {
          evalReturnChildren(([tuple, key, value]) => {
            const record = tuple as RecordValue;
            const field = record.get(key);
            if ("set" in field) field.set(value);
            return record;
          }, ast.children);
          return;
        }
        case "push": {
          evalReturnChildren(([tuple, value]) => {
            const record = tuple as RecordValue;
            record.tuple.push(value);
            return record;
          }, ast.children);
          return;
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
          return;
        }

        case "in": {
          evalReturnChildren(([tuple, key]) => {
            const record = tuple as RecordValue;
            return record.has(key);
          }, ast.children);
          return;
        }
        case "and": {
          evalShortcircuit(
            (vals) => continuation(vals.pop()!),
            (vals) => !vals[vals.length - 1],
            ast.children
          );
          return;
        }
        case "or": {
          evalShortcircuit(
            (vals) => continuation(vals.pop()!),
            (vals) => !!vals[vals.length - 1],
            ast.children
          );
          return;
        }
        case "==": {
          evalReturnChildren(([left, right]) => left === right, ast.children);
          return;
        }
        case "===": {
          evalReturnChildren(([left, right]) => isEqual(left, right), ast.children);
          return;
        }
        case "!": {
          evaluate(taskQueue, ast.children[0], context, (value) => continuation(!value));
          return;
        }
        case "<": {
          evalReturnChildren(([left, right]) => (left as number) < (right as number), ast.children);
          return;
        }

        case ";": {
          evalReturnChildren((vals) => vals.pop() ?? null, ast.children);
          return;
        }

        case "macro": {
          const scope = context.scope;
          continuation((arg, continuation) => {
            const boundScope = scope.push({ get: () => arg, set: (value) => (arg = value as ExprValue) });

            evaluate(taskQueue, ast.children[0], { scope: boundScope }, continuation);
          });
          return;
        }

        case "fn": {
          const scope = context.scope;
          continuation((arg, continuation) => {
            evaluate(taskQueue, arg.ast, { scope: arg.scope }, (arg) => {
              const boundScope = scope.push({ get: () => arg, set: (value) => (arg = value) });

              evaluate(taskQueue, ast.children[0], { scope: boundScope }, continuation);
            });
          });
          return;
        }

        case "eval": {
          evaluate(taskQueue, ast.children[0], context, (value) => {
            const expr = value as ExprValue;
            evaluate(taskQueue, expr.ast, { scope: expr.scope }, continuation);
          });
          return;
        }

        case "codeLabel": {
          const label = ast.children[0].value;
          const expr = ast.children[1];

          const labelValue: FunctionValue = fn(taskQueue, (value) => {
            continuation(value);
            return null;
          });
          const scope = context.scope.add(label, { get: () => labelValue });

          evaluate(taskQueue, expr, { scope }, continuation);
          return;
        }

        case "=": {
          evaluate(taskQueue, ast.children[1], context, (value) => {
            evaluate(taskQueue, ast.children[0], context, (name) => {
              const entryIndex = context.scope.toIndex({ name: name as string });
              const entry = context.scope.scope[entryIndex];
              if (!entry) throw new Error(`Variable ${name as string} not found in scope`);

              const ref = entry.value;
              if (!("set" in ref)) throw new Error(`Variable ${name as string} is not mutable`);

              ref.set(value);
              return continuation(value);
            });
          });
          return;
        }

        case ":=": {
          evaluate(taskQueue, ast.children[1], context, (value) => {
            const entry = ast.children[0].data.mutable ? ref(value) : immutableRef(value);

            evaluate(taskQueue, ast.children[0], context, (name) => {
              context.scope = context.scope.add(name as string, entry as ValueRef);

              return continuation(value);
            });
          });
          return;
        }

        case "access": {
          evaluate(taskQueue, ast.children[0], context, (value) => {
            const record = value as RecordValue;
            continuation(record.get(ast.children[1].value).get());
          });
          return;
        }

        case "accessDynamic": {
          evalReturnChildren(([record, key]) => {
            return (record as RecordValue).get(key).get();
          }, ast.children);
          return;
        }

        case "negate": {
          evaluate(taskQueue, ast.children[0], context, (value) => continuation(-(value as number)));
          return;
        }

        case "application": {
          const arg = expr(ast.children[1], context.scope);
          evaluate(taskQueue, ast.children[0], context, (fn) => {
            const func = fn as FunctionValue;
            func(arg, continuation);
          });
          return;
        }

        case "send": {
          evalChildren(([_channel, value]) => {
            const { channel } = _channel as ChannelValue;
            const callbackChannel = Symbol("send.callback");
            const message = record(taskQueue, [value, callbackChannel]);

            taskQueue.createConsumeTask(callbackChannel, continuation);
            taskQueue.createProduceTask(channel, () => message);
          }, ast.children);
          return;
        }
        case "receive": {
          evaluate(taskQueue, ast.children[0], context, (_channel) => {
            const { channel } = _channel as ChannelValue;
            taskQueue.createConsumeTask(channel, (_message) => {
              const message = _message as RecordValue;
              const [value, callbackChannel] = message.tuple;
              taskQueue.send(callbackChannel as symbol, value);
              continuation(value);
            });
          });
          return;
        }
        case "peekSend": {
          evalReturnChildren(([_channel, value]) => {
            const { channel } = _channel as ChannelValue;
            if (taskQueue.ready(channel)) return record(taskQueue, [getAtom("err"), null, null]);

            const callbackChannel = Symbol("peekSend.callback");
            const message = record(taskQueue, [value, callbackChannel]);
            taskQueue.send(channel, message);
            return record(taskQueue, [getAtom("ok"), value, callbackChannel]);
          }, ast.children);
          return;
        }
        case "peekReceive": {
          evaluate(taskQueue, ast.children[0], context, (_channel) => {
            const { channel } = _channel as ChannelValue;
            if (!taskQueue.ready(channel)) return continuation(record(taskQueue, [getAtom("err"), null]));

            const message = taskQueue.receive(channel) as RecordValue;
            const [value, callbackChannel] = message.tuple;
            taskQueue.send(callbackChannel as symbol, value);
            continuation(record(taskQueue, [getAtom("ok"), value]));
          });
          return;
        }
        case "parallel": {
          ast.children.map((child) => evaluate(taskQueue, child, { ...context }, continuation));
          return;
        }
        case "select": {
          let consumed = false;
          ast.children.map((child) =>
            evaluate(taskQueue, child, { ...context }, (arg) => {
              if (consumed) return;
              consumed = true;
              continuation(arg);
            })
          );
          return;
        }
        case "async": {
          evaluate(taskQueue, ast.children[0], context, (f) => {
            const fn = f as FunctionValue;

            continuation((arg, continuation) => {
              const _channel = channel();

              taskQueue.createTask(() =>
                fn(arg, (v) => {
                  const { channel } = _channel;
                  const callbackChannel = Symbol("async.callback");
                  const message = record(taskQueue, [v, callbackChannel]);

                  const handle = () => {
                    taskQueue.createConsumeTask(callbackChannel, handle);
                    taskQueue.createProduceTask(channel, () => message);
                  };

                  handle();
                })
              );

              continuation(_channel);
            });
          });
          return;
        }
        case "await": {
          evaluate(taskQueue, ast.children[0], context, (_channel) => {
            const { channel } = _channel as ChannelValue;
            taskQueue.createConsumeTask(channel, (_message) => {
              const message = _message as RecordValue;
              const [value, callbackChannel] = message.tuple;
              taskQueue.send(callbackChannel as symbol, value);
              continuation(value);
            });
          });
          return;
        }

        case "import": {
          evaluate(taskQueue, ast.children[0], context, async (name) => {
            const imported = await loadFile(name as string);
            if ("value" in imported) return continuation(imported.value);
            evaluate(taskQueue, imported.ast, context, continuation);
          });
          return;
        }

        case "ref": {
          evaluate(taskQueue, ast.children[0], context, (value) => {
            const _ref = ref(value);

            return continuation(_ref);
          });
          return;
        }
        case "deref": {
          evaluate(taskQueue, ast.children[0], context, (ref) => {
            const _ref = ref as ValueRef;
            return continuation(_ref.get());
          });
          return;
        }

        case "braces": {
          const [expr] = ast.children;

          const _continue = () => evaluate(taskQueue, expr, { ...context }, continuation);
          context.scope = context.scope.add("continue", { get: () => _continue });

          const _break: FunctionValue = (_expr) => evaluate(taskQueue, _expr.ast, { scope: _expr.scope }, continuation);
          context.scope = context.scope.add("break", { get: () => _break });

          return _continue();
        }

        case "free":
        case "allocate": {
          throw new Error("Not implemented");
        }

        // must be eliminated by that point
        case "importWith":
        case "export":
        case "exportAs":
        case "external":
        case "pipe":
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
      return continuation(record(taskQueue));
    }

    case "symbol": {
      return continuation(Symbol());
    }

    case "channel": {
      return continuation(channel());
    }

    case "atom": {
      return continuation(getAtom(ast.value));
    }

    case "boolean": {
      return continuation(Boolean(ast.value));
    }

    case "float":
    case "int": {
      return continuation(Number(ast.value));
    }

    case "string": {
      return continuation(String(ast.value));
    }

    case "name": {
      const identifier: ScopeEntryIdentifier =
        typeof ast.value === "number" ? { relativeIndex: ast.value } : { name: getAtom(ast.value) };
      const entry = context.scope.get(identifier);
      const value = entry?.value.get?.() ?? null;
      // console.dir(["name", context], { depth: null });

      return continuation(value);
    }

    case "placeholder":
    default:
      continuation(null);
  }
};
async function loadFile(name: string): Promise<{ ast: AbstractSyntaxTree } | { value: Value }> {
  throw new Error("Function not implemented.");
}

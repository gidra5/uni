import { isEqual } from "../utils/index.js";
import { ChannelValue, Evaluate, ExprValue, FunctionValue, RecordValue, Value } from "./types.js";
import { initialContext } from "./utils.js";
import { expr, fn, record, isRecord, channel } from "./values.js";
import { getAtom } from "./atoms.js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import type { ScopeEntryIdentifier } from "../scope.js";

export const evaluate: Evaluate = (taskQueue, ast, context = initialContext(taskQueue), continuation) => {
  const _return = (value: Value) => continuation(value);

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
  ) => evalChildren((vals) => _return(reducer(vals)), [head, ...tail], v);

  switch (ast.name) {
    case "operator": {
      switch (ast.value) {
        case "print": {
          evaluate(taskQueue, ast.children[0], context, (value) => {
            console.dir(value, { depth: null });
            _return(value);
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
            record.set(key, value);
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
          evalReturnChildren((vals) => vals.every((val) => val), ast.children);
          return;
        }
        case "or": {
          evalReturnChildren((vals) => vals.some((val) => val), ast.children);
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
          evaluate(taskQueue, ast.children[0], context, (value) => _return(!value));
          return;
        }
        case "<": {
          evalReturnChildren(([left, right]) => (left as number) < (right as number), ast.children);
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
              entry?.value.set?.(value);
              return _return(value);
            });
          });
          return;
        }

        case ":=": {
          evaluate(taskQueue, ast.children[1], context, (value) => {
            const entry = { get: () => value, set: (_value) => (value = _value) };

            evaluate(taskQueue, ast.children[0], context, (name) => {
              context.scope = context.scope.add(name as string, entry);
              console.dir(context, { depth: null });

              return _return(value);
            });
          });
          return;
        }

        case "access": {
          evaluate(taskQueue, ast.children[0], context, (value) => {
            const record = value as RecordValue;
            _return(record.get(ast.children[1].value));
          });
          return;
        }

        case "accessDynamic": {
          evalReturnChildren(([record, key]) => {
            return (record as RecordValue).get(key);
          }, ast.children);
          return;
        }

        case "negate": {
          evaluate(taskQueue, ast.children[0], context, (value) => _return(-(value as number)));
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

            taskQueue.createConsumeTask(callbackChannel, _return);
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
              _return(value);
            });
          });
          return;
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
          return;
        }
        case "peekReceive": {
          evaluate(taskQueue, ast.children[0], context, (_channel) => {
            const { channel } = _channel as ChannelValue;
            if (taskQueue.ready(channel)) {
              const message = taskQueue.receive(channel) as RecordValue;
              const [value, callbackChannel] = message.tuple;
              taskQueue.send(callbackChannel as symbol, value);
              _return(record(taskQueue, [getAtom("ok"), value]));
              return;
            }
            _return(record(taskQueue, [getAtom("err"), null]));
          });
          return;
        }
        case "parallel": {
          ast.children.map((child) => evaluate(taskQueue, child, context, continuation));
          return;
        }
        case "select": {
          let consumed = false;
          ast.children.map((child) =>
            evaluate(taskQueue, child, context, (arg) => {
              if (consumed) return;
              consumed = true;
              continuation(arg);
            })
          );
          return;
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
      return _return(record(taskQueue));
    }

    case "symbol": {
      return _return(Symbol());
    }

    case "channel": {
      return _return(channel());
    }

    case "atom": {
      return _return(getAtom(ast.value));
    }

    case "boolean": {
      return _return(Boolean(ast.value));
    }

    case "float":
    case "int": {
      return _return(Number(ast.value));
    }

    case "string": {
      return _return(String(ast.value));
    }

    case "name": {
      const identifier: ScopeEntryIdentifier =
        typeof ast.value === "number" ? { relativeIndex: ast.value } : { name: getAtom(ast.value) };
      const entry = context.scope.get(identifier);
      const value = entry?.value.get?.() ?? null;
      console.dir(["name", context], { depth: null });

      return _return(value);
    }

    case "placeholder":
    default:
      _return(null);
  }
};

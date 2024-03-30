import { AbstractSyntaxTree } from "../parser/ast.js";
import { isEqual } from "../utils/index.js";
import { ExprValue, FunctionValue, RecordValue, Value } from "./types.js";
import { initialContext, isRecord } from "./utils.js";
import { expr, fn, record } from "./values.js";
import { getAtom } from "./atoms.js";
import { TaskQueue } from "./taskQueue.js";


export const evaluate = (
  taskQueue: TaskQueue,
  ast: AbstractSyntaxTree,
  context = initialContext(taskQueue)
): symbol => {
  switch (ast.name) {
    case "operator": {
      switch (ast.value) {
        case "print": {
          const id = evaluate(taskQueue, ast.children[0], context);
          return taskQueue.createTransformTaskOutChannel(id, (val) => {
            console.dir(val, { depth: null });
            return val;
          });
        }

        case "+": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, (vals) => vals.reduce((acc: number, val) => acc + (val as number), 0));
        }
        case "*": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, (vals) => vals.reduce((acc: number, val) => acc * (val as number), 1));
        }
        case "-": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => (left as number) - (right as number));
        }
        case "/": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => (left as number) / (right as number));
        }
        case "%": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => (left as number) % (right as number));
        }
        case "^": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => Math.pow(left as number, right as number));
        }

        case "set": {
          const tuple = evaluate(taskQueue, ast.children[0], context);
          const key = evaluate(taskQueue, ast.children[1], context);
          const value = evaluate(taskQueue, ast.children[2], context);

          return taskQueue.fanIn([tuple, key, value], ([tupleVal, keyVal, valueVal]) => {
            const record = tupleVal as RecordValue;
            record.set(keyVal, valueVal);
            return record;
          });
        }
        case "push": {
          const tuple = evaluate(taskQueue, ast.children[0], context);
          const value = evaluate(taskQueue, ast.children[1], context);

          return taskQueue.fanIn([tuple, value], ([tupleVal, valueVal]) => {
            const record = tupleVal as RecordValue;
            // console.log("push", record);

            record.tuple.push(valueVal);
            return record;
          });
        }
        case "join": {
          const tuple = evaluate(taskQueue, ast.children[0], context);
          const value = evaluate(taskQueue, ast.children[1], context);

          return taskQueue.fanIn([tuple, value], ([tupleVal, valueVal]) => {
            if (!isRecord(valueVal)) return tupleVal;
            const record = tupleVal as RecordValue;
            valueVal.tuple.forEach((value) => record.tuple.push(value));
            valueVal.map.forEach((value, key) => record.map.set(key, value));
            Object.assign(record.record, valueVal.record);
            return record;
          });
        }
        case "unit": {
          return taskQueue.createProduceTaskChannel(() => record(taskQueue));
        }

        case "in": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => {
            const record = right as RecordValue;
            return record.has(left);
          });
        }
        case "and": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, (vals) => vals.every((val) => val));
        }
        case "or": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, (vals) => vals.some((val) => val));
        }
        case "==": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => left === right);
        }
        case "===": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => isEqual(left, right));
        }
        case "!": {
          return taskQueue.createTransformTaskOutChannel(evaluate(taskQueue, ast.children[0], context), (val) => !val);
        }
        case "<": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.fanIn(channels, ([left, right]) => (left as number) < (right as number));
        }

        case "macro": {
          const scope = context.scope;
          return taskQueue.createProduceTaskChannel(() => (argChannel) => {
            const outChannel = Symbol("macro.out");
            taskQueue.createConsumeTask(argChannel, (_arg) => {
              const arg = _arg as unknown as ExprValue;
              const boundScope = scope.push({ get: () => arg });

              const resultChannel = evaluate(taskQueue, ast.children[0], { scope: boundScope });
              taskQueue.pipe(resultChannel, outChannel);
            });
            return outChannel;
          });
        }

        case "fn": {
          const scope = context.scope;
          return taskQueue.createProduceTaskChannel(() => (argChannel) => {
            const outChannel = Symbol("fn.out");
            const evalArgChannel = Symbol("fnArg.out");

            taskQueue.createConsumeTask(argChannel, (_arg) => {
              const arg = _arg as unknown as ExprValue;
              const evalArg = evaluate(taskQueue, arg.ast, { scope: arg.scope });
              taskQueue.pipe(evalArg, evalArgChannel);
            });

            taskQueue.createConsumeTask(evalArgChannel, (arg) => {
              const boundScope = scope.push({ get: () => arg });

              const resultChannel = evaluate(taskQueue, ast.children[0], { scope: boundScope });
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
          const labelValue: FunctionValue = fn(taskQueue, (value) => {
            taskQueue.send(outChannel, value);
            return null;
          });
          const scope = context.scope.add(label, { get: () => labelValue });

          const result = evaluate(taskQueue, expr, { ...context, scope });
          taskQueue.pipe(result, outChannel);
          return outChannel;
        }

        case "=": {
          const value = evaluate(taskQueue, ast.children[1], context);

          if (
            ast.children[0].name !== "name" &&
            !(ast.children[0].name === "operator" && ast.children[0].value === "brackets")
          ) {
            const accessor = ast.children[0];
            const recordFieldNode = accessor.children[1];
            const record = evaluate(taskQueue, accessor.children[0], context);
            const key =
              accessor.name === "access"
                ? taskQueue.createProduceTaskChannel(() => recordFieldNode.value)
                : evaluate(taskQueue, recordFieldNode, context);

            return taskQueue.fanIn([record, key, value], ([recordVal, keyVal, valueVal]) => {
              const record = recordVal as RecordValue;
              record.set(keyVal, valueVal);
              return valueVal;
            });
          }

          const name =
            ast.children[0].name === "name"
              ? taskQueue.createProduceTaskChannel(() => ast.children[0].value)
              : evaluate(taskQueue, ast.children[0], context);

          return taskQueue.fanIn([name, value], ([nameVal, valueVal]) => {
            const entryIndex = context.scope.toIndex({ name: nameVal as string });
            const entry = context.scope.scope[entryIndex];
            entry?.value.set?.(valueVal);
            return valueVal;
          });
        }

        case ":=": {
          const value = evaluate(taskQueue, ast.children[1], context);
          const name =
            ast.children[0].name === "name"
              ? taskQueue.createProduceTaskChannel(() => ast.children[0].value)
              : evaluate(taskQueue, ast.children[0], context);

          return taskQueue.fanIn([name, value], ([nameVal, valueVal]) => {
            context.scope = context.scope.add(nameVal as string, { get: () => valueVal });
            return valueVal;
          });
        }

        case "atom": {
          return taskQueue.createProduceTaskChannel(() => getAtom(ast.children[0].value));
        }

        case "access": {
          return taskQueue.createTransformTaskOutChannel(evaluate(taskQueue, ast.children[0], context), (record) => {
            const recordValue = record as RecordValue;
            return recordValue.get(ast.children[1].value);
          });
        }

        case "accessDynamic": {
          const record = evaluate(taskQueue, ast.children[0], context);
          const key = evaluate(taskQueue, ast.children[1], context);

          return taskQueue.fanIn([record, key], ([recordVal, keyVal]) => {
            const record = recordVal as RecordValue;
            return record.get(keyVal);
          });
        }

        case "negate": {
          return taskQueue.createTransformTaskOutChannel(
            evaluate(taskQueue, ast.children[0], context),
            (val) => -(val as number)
          );
        }

        case "application": {
          const fnChannel = evaluate(taskQueue, ast.children[0], context);
          const argChannel = taskQueue.createProduceTaskChannel(() => expr(ast.children[1], context.scope));
          const outChannel = Symbol("application.out");
          taskQueue.createConsumeTask(fnChannel, (fn) => {
            const func = fn as FunctionValue;
            taskQueue.pipe(func(argChannel), outChannel);
          });
          return outChannel;
        }
        case "symbol": {
          return taskQueue.createProduceTaskChannel(() => Symbol());
        }
        case "brackets": {
          return evaluate(taskQueue, ast.children[0], context);
        }

        case "channel": {
          return taskQueue.createProduceTaskChannel(() => channel());
        }
        case "send": {
          const channel = evaluate(taskQueue, ast.children[0], context);
          const value = evaluate(taskQueue, ast.children[1], context);

          return taskQueue.fanIn([channel, value], ([channel, value]) => {
            // TODO: do blocking if channel is already full
            taskQueue.send(channel as symbol, value);
            return value;
          });
        }
        case "receive": {
          const channel = evaluate(taskQueue, ast.children[0], context);

          return taskQueue.createTransformTaskOutChannel(channel, (channel) => channel);
        }
        case "peekSend": {
          const channel = evaluate(taskQueue, ast.children[0], context);
          const value = evaluate(taskQueue, ast.children[1], context);

          return taskQueue.fanIn([channel, value], ([channel, value]) => {
            if (taskQueue.ready(channel as symbol)) return getAtom("err");
            taskQueue.send(channel as symbol, value);
            return getAtom("ok");
          });
        }
        case "peekReceive": {
          const channel = evaluate(taskQueue, ast.children[0], context);

          return taskQueue.createTransformTaskOutChannel(channel, (channel) => {
            if (taskQueue.ready(channel as symbol)) return getAtom("ok");
            return getAtom("ok");
          });
        }
        case "parallel": {
          const channels = ast.children.map((child) => evaluate(taskQueue, child, context));

          return taskQueue.createProduceTaskChannel(() => parallel(channels));
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

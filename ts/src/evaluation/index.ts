import { AbstractSyntaxTree } from "../parser/ast.js";
import { isEqual } from "../utils/index.js";
import { TaskQueueExprValue, TaskQueueFunctionValue, TaskQueueRecordValue, TaskQueueValue } from "./types.js";
import { initialTaskQueueContext, isTaskQueueRecord } from "./utils.js";
import { taskQueueExpr, taskQueueFn, taskQueueRecord } from "./values.js";
import { getAtom } from "./atoms.js";
import { TaskQueue } from "./taskQueue.js";

const taskQueueFanIn =
  (taskQueue: TaskQueue) =>
  (channels: symbol[], task: (vals: TaskQueueValue[]) => TaskQueueValue): symbol => {
    const vals: TaskQueueValue[] = [];
    const outChannel = Symbol("fanIn.out");

    // TODO: memory leak, because if any of input channels' tasks are cancelled, the outChannel will never be resolved, leaving dangling tasks
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
          return taskQueue.createProduceTaskChannel(() => (argChannel) => {
            const outChannel = Symbol("macro.out");
            taskQueue.createConsumeTask(argChannel, (_arg) => {
              const arg = _arg as unknown as TaskQueueExprValue;
              const boundScope = scope.push({ get: () => arg });

              const resultChannel = taskQueueEvaluate(taskQueue, ast.children[0], { scope: boundScope });
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
              const arg = _arg as unknown as TaskQueueExprValue;
              const evalArg = taskQueueEvaluate(taskQueue, arg.ast, { scope: arg.scope });
              taskQueue.pipe(evalArg, evalArgChannel);
            });

            taskQueue.createConsumeTask(evalArgChannel, (arg) => {
              const boundScope = scope.push({ get: () => arg });

              const resultChannel = taskQueueEvaluate(taskQueue, ast.children[0], { scope: boundScope });
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

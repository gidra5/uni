import { SystemError } from '../error.js';
import { getModule } from '../files.js';
import { getPosition, showNode } from '../parser.js';
import {
  NodeType,
  node,
  type Tree,
  sequence,
  tuple,
  fn as fnAST,
  implicitPlaceholder,
} from '../ast.js';
import {
  assert,
  eventLoopYield,
  getClosestName,
  isEqual,
  unreachable,
} from '../utils.js';
import {
  atom,
  awaitTask,
  cancelTask,
  channelStatus,
  createChannel,
  createEffect,
  createHandler,
  createRecord,
  createTask,
  type EvalFunction,
  type EvalRecord,
  type EvalTask,
  type EvalValue,
  getChannel,
  isChannel,
  isEffect,
  isPrototyped,
  isRecord,
  isTask,
  onceEvent,
  receive,
  recordDelete,
  recordGet,
  recordHas,
  recordMerge,
  recordSet,
  send,
  tryReceive,
} from '../values.js';
import { type Position } from '../position.js';
import {
  bind,
  bindContext,
  compilePattern,
  type PatternTestEnvs,
} from './patternMatching.js';
import { preludeHandlers } from '../std/prelude.js';
import { ModuleDefault } from '../module.js';
import { listPrototype } from '../std/list.js';
import { stringPrototype } from '../std/string.js';
import { CreateTaskEffect } from '../std/concurrency.js';
import { createOk, isResult } from '../std/result.js';
import {
  type CompileContext,
  type Compiler,
  type EvalContext,
  type Executable,
  forkContext,
} from './context.js';
import {
  flatMapEffect,
  handleEffects,
  mapEffect,
  MaskEffect,
  replaceEffectContext,
} from './eval.js';
import { lower } from './lower.js';

const incAssign = (position: Position, context: CompileContext) => {
  const invalidIndex = SystemError.invalidIndex(position).withFileId(
    context.fileId
  );
  const invalidName = (name: string) =>
    SystemError.invalidIncrement(name, position).withFileId(context.fileId);
  const immutableName = (name: string) =>
    SystemError.immutableVariableAssignment(name, position).withFileId(
      context.fileId
    );
  const undeclaredName = (name: string, names: string[]) =>
    SystemError.undeclaredNameAssignment(
      name,
      position,
      getClosestName(name, names)
    ).withFileId(context.fileId);
  return (envs: PatternTestEnvs, context: EvalContext) => {
    assert(envs.exports.size === 0, 'cant do exports at increment');
    assert(envs.env.size === 0, 'cant do mutable declarations at increment');

    for (const [patternKey, value] of envs.readonly.entries()) {
      if (typeof patternKey === 'symbol') {
        assert(
          !context.env.hasReadonly(patternKey),
          immutableName(patternKey.description!)
        );
        assert(
          context.env.has(patternKey),
          undeclaredName(
            patternKey.description!,
            context.env.keys().map((k) => k.description ?? String(k))
          )
        );

        const current = context.env.get(patternKey);
        assert(
          typeof current === 'number' || typeof current === 'string',
          invalidName(String(patternKey))
        );
        assert(
          typeof value === typeof current,
          invalidName(String(patternKey))
        );
        context.env.set(patternKey, (current as string) + (value as string));
      } else {
        const [patternTarget, patternKeyValue] = patternKey;
        if (Array.isArray(patternTarget)) {
          assert(typeof patternKeyValue === 'number', invalidIndex);
          const current = patternTarget[patternKeyValue];
          assert(
            typeof current === 'number',
            invalidName(String(patternKeyValue))
          );
          assert(
            typeof value === 'number',
            invalidName(String(patternKeyValue))
          );
          patternTarget[patternKeyValue] = current + value;
        } else {
          assert(isRecord(patternTarget), 'expected record');

          const current = recordGet(patternTarget, patternKeyValue);
          assert(
            typeof current === 'number',
            invalidName(String(patternKeyValue))
          );
          assert(
            typeof value === 'number',
            invalidName(String(patternKeyValue))
          );
          recordSet(patternTarget, patternKeyValue, current + value);
        }
      }
    }
  };
};

const assign = (position: Position, context: CompileContext) => {
  const invalidIndex = SystemError.invalidIndex(position).withFileId(
    context.fileId
  );
  const immutableName = (name: string) =>
    SystemError.immutableVariableAssignment(name, position).withFileId(
      context.fileId
    );
  const undeclaredName = (name: string, names: string[]) =>
    SystemError.undeclaredNameAssignment(
      name,
      position,
      getClosestName(name, names)
    ).withFileId(context.fileId);

  return (envs: PatternTestEnvs, context: EvalContext) => {
    assert(envs.exports.size === 0, 'cant do exports in at assignment');
    assert(envs.env.size === 0, 'cant do mutable declarations at assignment');

    for (const [patternKey, value] of envs.readonly.entries()) {
      if (typeof patternKey === 'symbol') {
        assert(
          !context.env.hasReadonly(patternKey),
          immutableName(patternKey.description!)
        );
        assert(
          context.env.set(patternKey, value),
          undeclaredName(
            patternKey.description!,
            context.env.keys().map((k) => k.description ?? String(k))
          )
        );
      } else {
        const [patternTarget, key] = patternKey;
        if (Array.isArray(patternTarget)) {
          assert(typeof key === 'number', invalidIndex);
          patternTarget[key] = value;
        } else {
          assert(isRecord(patternTarget), 'expected record');
          if (value === null) recordDelete(patternTarget, key);
          else recordSet(patternTarget, key, value);
        }
      }
    }
  };
};

const bindExport = (context: CompileContext) => {
  return (envs: PatternTestEnvs, exports: EvalRecord, context: EvalContext) => {
    for (const [key, value] of envs.readonly.entries()) {
      assert(typeof key === 'symbol', 'can only declare names');

      if (value === null) continue;
      assert(
        !context.env.has(key),
        'cannot declare name inside module more than once'
      );
      context.env.addReadonly(key, value);
    }

    for (const [key, value] of envs.env.entries()) {
      assert(typeof key === 'symbol', 'can only declare names');

      if (value === null) continue;
      assert(
        !context.env.has(key),
        'cannot declare name inside module more than once'
      );
      context.env.add(key, value);
    }

    for (const [key, value] of envs.exports.entries()) {
      assert(typeof key === 'symbol', 'can only declare names');
      assert(
        !context.env.has(key),
        'cannot declare name inside module more than once'
      );

      if (value === null) continue;
      context.env.addReadonly(key, value);
      recordSet(exports, key, value);
    }
  };
};

const operators = {
  [NodeType.ADD]: (lhs: EvalValue, rhs: EvalValue) => {
    assert(
      typeof lhs === 'number' || typeof lhs === 'string' || isChannel(lhs),
      'expected number, channel or string on lhs'
    );
    assert(
      typeof lhs === typeof rhs,
      'expected both lhs and rhs have the same type'
    );

    if (isChannel(rhs)) {
      assert(isChannel(lhs));
      const c = createChannel('select');
      Promise.race([receive(rhs), receive(lhs)]).then((v) => send(c, v));
      return c;
    }

    return (lhs as string) + (rhs as string);
  },
  [NodeType.SUB]: (lhs: EvalValue, rhs: EvalValue) => {
    assert(typeof lhs === 'number', 'expected number');
    assert(typeof rhs === 'number', 'expected number');
    return lhs - rhs;
  },
  [NodeType.MULT]: (lhs: EvalValue, rhs: EvalValue) => {
    assert(typeof lhs === 'number', 'expected number');
    assert(typeof rhs === 'number', 'expected number');
    return lhs * rhs;
  },
  [NodeType.DIV]: (lhs: EvalValue, rhs: EvalValue) => {
    assert(typeof lhs === 'number', 'expected number');
    assert(typeof rhs === 'number', 'expected number');
    return lhs / rhs;
  },
  [NodeType.MOD]: (lhs: EvalValue, rhs: EvalValue) => {
    assert(typeof lhs === 'number', 'expected number');
    assert(typeof rhs === 'number', 'expected number');
    return lhs % rhs;
  },
  [NodeType.POW]: (lhs: EvalValue, rhs: EvalValue) => {
    assert(typeof lhs === 'number', 'expected number');
    assert(typeof rhs === 'number', 'expected number');
    return lhs ** rhs;
  },
  [NodeType.PLUS]: (arg: EvalValue) => {
    assert(typeof arg === 'number', 'expected number');
    return +arg;
  },
  [NodeType.MINUS]: (arg: EvalValue) => {
    assert(typeof arg === 'number', 'expected number');
    return -arg;
  },

  [NodeType.EQUAL]: (left: EvalValue, right: EvalValue) => {
    return left === right;
  },
  [NodeType.NOT_EQUAL]: (left: EvalValue, right: EvalValue) => {
    return !operators[NodeType.EQUAL](left, right);
  },
  [NodeType.DEEP_EQUAL]: (left: EvalValue, right: EvalValue) => {
    return isEqual(left, right);
  },
  [NodeType.DEEP_NOT_EQUAL]: (left: EvalValue, right: EvalValue) => {
    return !operators[NodeType.DEEP_EQUAL](left, right);
  },
  [NodeType.LESS]: (left: EvalValue, right: EvalValue) => {
    assert(typeof left === 'number', 'expected number');
    assert(typeof right === 'number', 'expected number');
    return left < right;
  },
  [NodeType.LESS_EQUAL]: (left: EvalValue, right: EvalValue) => {
    return (
      operators[NodeType.LESS](left, right) ||
      operators[NodeType.EQUAL](left, right)
    );
  },
  [NodeType.GREATER]: (left: EvalValue, right: EvalValue) => {
    return !operators[NodeType.LESS_EQUAL](left, right);
  },
  [NodeType.GREATER_EQUAL]: (left: EvalValue, right: EvalValue) => {
    return !operators[NodeType.LESS](left, right);
  },
  [NodeType.NOT]: (arg: EvalValue) => {
    assert(typeof arg === 'boolean', 'expected boolean');
    return !arg;
  },
  [NodeType.AWAIT]: async (task: EvalValue) => {
    assert(isTask(task), 'expected task');
    return await awaitTask(task);
  },
  [NodeType.IN]: (key: EvalValue, value: EvalValue) => {
    if (Array.isArray(value) && typeof key === 'number') {
      const indexed = value[key];
      return indexed !== null && indexed !== undefined;
    }
    if (isRecord(value)) {
      return recordHas(value, key);
    }
    unreachable('expected record or tuple');
  },
};

const FnTryEffect = Symbol('fn try');
const lazyOperators = {
  [NodeType.IMPORT]: (ast, context) => {
    const name = ast.data.name;
    const pattern = ast.children[0];
    const importModule = async () => {
      const module = await getModule({ name, from: context.file });
      const value =
        'script' in module
          ? module.script
          : 'module' in module
            ? module.module
            : (module.buffer as unknown as EvalValue);

      return value;
    };

    if (pattern) {
      const compiledPattern = compilePattern(pattern, context);
      return async (evalContext) => {
        const value = await importModule();
        const result = await compiledPattern(value, evalContext);
        assert(result.matched, 'expected pattern to match');
        bind(result.envs, evalContext);
        return value;
      };
    }

    return importModule;
  },
  [NodeType.ASYNC]: (ast, context) => {
    const [expr] = ast.children;
    const compiled = compileBlock(expr, context);
    const exprPosition = getPosition(expr);
    return async (evalContext) => {
      const childrenTasks: EvalTask[] = [];
      const task = async () => {
        const handlers = createRecord({
          [CreateTaskEffect]: createHandler(async (cs, value) => {
            assert(Array.isArray(value), 'expected value to be an array');
            const [callback, taskFn] = value;
            assert(typeof taskFn === 'function', 'expected function');
            const _task = createTask(cs, async () => await taskFn(cs, null));
            childrenTasks.push(_task);
            assert(typeof callback === 'function', 'expected callback');
            return await callback(cs, _task);
          }),
        });
        const value = await compiled(evalContext).catch((e) => {
          if (e instanceof SystemError) e.print();
          else showNode(expr, context, e.message);
          return null;
        });

        return await handleEffects(
          handlers,
          value,
          exprPosition,
          evalContext,
          context
        );
      };
      const effect = createEffect(CreateTaskEffect, task, evalContext.env);
      return mapEffect(effect, evalContext, async (task) => {
        assert(isTask(task), 'expected task');
        const cancelEvent = task[1];
        onceEvent(cancelEvent, async (cs) => {
          for (const childTask of childrenTasks) {
            await cancelTask(cs, childTask);
          }
          return null;
        });
        return task;
      });
    };
  },

  [NodeType.PARENS]: (ast, context) => {
    const [arg] = ast.children;
    if (arg.type === NodeType.IMPLICIT_PLACEHOLDER) return async () => [];
    return compileStatement(arg, context);
  },
  [NodeType.SQUARE_BRACKETS]: (ast, context) => {
    const [arg] = ast.children;
    assert(arg.type !== NodeType.IMPLICIT_PLACEHOLDER, 'expected expression');
    const compiled = compileStatement(arg, context);
    return async (context) => {
      const key = await compiled(context);
      assert(typeof key === 'symbol', 'dynamic name must be a symbol');
      return context.env.get(key);
    };
  },

  [NodeType.INJECT]: (ast, context) => {
    const [expr, body] = ast.children;
    const compiledExpr = compileExpr(expr, context);
    const compiledBlock = compileBlock(body, context);
    const bodyPosition = getPosition(body);

    return async (evalContext) => {
      const value = await compiledExpr(evalContext);
      return await flatMapEffect(
        value,
        evalContext,
        async (value, evalContext) => {
          assert(isRecord(value), 'expected record');
          const result = await compiledBlock(evalContext);
          return await handleEffects(
            value,
            result,
            bodyPosition,
            evalContext,
            context
          );
        }
      );
    };
  },
  [NodeType.WITHOUT]: (ast, context) => {
    const [expr, body] = ast.children;
    const compiledExpr = compileExpr(expr, context);
    const compiledBlock = compileBlock(body, context);

    return async (context) => {
      let value = await compiledExpr(context);
      return await flatMapEffect(value, context, async (without, context) => {
        if (!Array.isArray(without)) without = [without];

        const result = await compiledBlock(context);
        assert(
          !isEffect(result) || !without.includes(result.effect),
          `effects from ${without.map((x) => String(x))} were disallowed`
        );
        return result;
      });
    };
  },
  [NodeType.MASK]: (ast, context) => {
    const [expr, body] = ast.children;
    const compiledExpr = compileExpr(expr, context);
    const compiledBlock = compileBlock(body, context);
    return async (context) => {
      let value = await compiledExpr(context);
      return await flatMapEffect(value, context, async (mask, context) => {
        if (!Array.isArray(mask)) mask = [mask];
        const result = await compiledBlock(context);

        const applyMask = async (result: EvalValue, context: EvalContext) => {
          if (!isEffect(result)) return result;
          if (!mask.includes(result.effect)) return result;

          return createEffect(MaskEffect, result.effect, context.env, [
            async () => result,
          ]);
        };
        return await applyMask(result, context);
      });
    };
  },

  [NodeType.IS]: (ast, context) => {
    const [value, pattern] = ast.children;
    const compiled = compileStatement(value, context);
    const compiledPattern = compilePattern(pattern, context);
    return async (context) => {
      const v = await compiled(context);
      return await flatMapEffect(v, context, async (v, context) => {
        const result = await compiledPattern(v, context);
        return result.matched;
      });
    };
  },
  [NodeType.MATCH]: (ast, context) => {
    const [expr, ...branches] = ast.children;
    const compiled = compileExpr(expr, context);
    const compiledBranches = branches.map((branch) => {
      assert(branch.type === NodeType.MATCH_CASE, 'expected match case');
      const [pattern, body] = branch.children;
      const compiledBody = compileBlock(body, context);
      const compiledPattern = compilePattern(pattern, context);
      return [compiledPattern, compiledBody] as const;
    });

    return async (context) => {
      const value = await compiled(context);
      return await flatMapEffect(value, context, async (value, context) => {
        for (const [pattern, body] of compiledBranches) {
          const result = await pattern(value, context);
          if (result.matched) {
            return await body(bindContext(result.envs, context));
          }
        }

        return null;
      });
    };
  },
  [NodeType.IF_ELSE]: (ast, context) => {
    const [condition, trueBranch, falseBranch] = ast.children;
    const compiledTrueBranch = compileBlock(trueBranch, context);
    const compiledFalseBranch = compileBlock(falseBranch, context);
    if (condition.type === NodeType.IS) {
      const [value, pattern] = condition.children;
      const compiledValue = compileStatement(value, context);
      const compiledPattern = compilePattern(pattern, context);
      return async (context) => {
        const v = await compiledValue(context);

        return await flatMapEffect(v, context, async (v, context) => {
          const result = await compiledPattern(v, context);
          if (result.matched) {
            return await compiledTrueBranch(bindContext(result.envs, context));
          }
          return await compiledFalseBranch(
            bindContext(result.notEnvs, context)
          );
        });
      };
    }
    const compiledCondition = compileExpr(condition, context);

    return async (context) => {
      const result = await compiledCondition(context);
      return await flatMapEffect(result, context, async (result, context) => {
        if (result) return await compiledTrueBranch(context);
        return await compiledFalseBranch(context);
      });
    };
  },

  [NodeType.BLOCK]: (ast, context) => {
    const [expr] = ast.children;
    if (expr.type === NodeType.IMPLICIT_PLACEHOLDER) return async () => null;

    const compiledExpr = compileBlock(expr, context);
    const exprPosition = getPosition(expr);
    const breakHandler: EvalFunction = async (_cs, v) => {
      assert(Array.isArray(v), 'expected value to be an array');
      const [_callback, value] = v;
      return value;
    };
    const continueHandler: EvalFunction = async (cs, _v) => {
      await eventLoopYield();
      return await compiled(cs[1]);
    };
    const continueAtom = atom('continue');
    const breakAtom = atom('break');
    const handlers = createRecord({
      [continueAtom]: createHandler(continueHandler),
      [breakAtom]: createHandler(breakHandler),
    });
    const compiled: Executable = async (evalContext) => {
      const value = await compiledExpr(evalContext);
      return await handleEffects(
        handlers,
        value,
        exprPosition,
        evalContext,
        context
      );
    };
    return compiled;
  },
  [NodeType.SEQUENCE]: (ast, context) => {
    const [expr, ...rest] = ast.children;
    if (expr.type === NodeType.IMPLICIT_PLACEHOLDER) return async () => null;

    const compiledExpr = compileStatement(expr, context);
    if (rest.length === 0) return compiledExpr;

    const compiledRest = compileStatement(sequence(rest), context);

    return async (context) => {
      const value = await compiledExpr(context);
      return await flatMapEffect(value, context, (_, context) =>
        compiledRest(context)
      );
    };
  },

  [NodeType.INCREMENT]: (ast, context) => {
    const [arg] = ast.children;
    assert(arg.type === NodeType.NAME, 'expected name');
    const compiledAsExpr = compileExpr(arg, context);
    const compiledAsPattern = compilePattern(arg, context);
    const argPosition = getPosition(arg);
    const compiledAssign = assign(argPosition, context);

    return async (context) => {
      const value = await compiledAsExpr(context);
      return await flatMapEffect(value, context, async (value, context) => {
        assert(typeof value === 'number', 'expected number');
        const { matched, envs } = await compiledAsPattern(value + 1, context);
        assert(matched, 'expected pattern to match');
        compiledAssign(envs, context);
        return value + 1;
      });
    };
  },
  [NodeType.DECREMENT]: (ast, context) => {
    const [arg] = ast.children;
    assert(arg.type === NodeType.NAME, 'expected name');
    const compiledAsExpr = compileExpr(arg, context);
    const compiledAsPattern = compilePattern(arg, context);
    const argPosition = getPosition(arg);
    const compiledAssign = assign(argPosition, context);

    return async (context) => {
      const value = await compiledAsExpr(context);
      return await flatMapEffect(value, context, async (value, context) => {
        assert(typeof value === 'number', 'expected number');
        const { matched, envs } = await compiledAsPattern(value - 1, context);
        assert(matched, 'expected pattern to match');
        compiledAssign(envs, context);
        return value - 1;
      });
    };
  },
  [NodeType.POST_DECREMENT]: (ast, context) => {
    const [arg] = ast.children;
    assert(arg.type === NodeType.NAME, 'expected name');
    const compiledAsExpr = compileExpr(arg, context);
    const compiledAsPattern = compilePattern(arg, context);
    const argPosition = getPosition(arg);
    const compiledAssign = assign(argPosition, context);

    return async (context) => {
      const value = await compiledAsExpr(context);
      return await flatMapEffect(value, context, async (value, context) => {
        assert(typeof value === 'number', 'expected number');
        const { matched, envs } = await compiledAsPattern(value - 1, context);
        assert(matched, 'expected pattern to match');
        compiledAssign(envs, context);
        return value;
      });
    };
  },
  [NodeType.POST_INCREMENT]: (ast, context) => {
    const [arg] = ast.children;
    assert(arg.type === NodeType.NAME, 'expected name');
    const compiledAsExpr = compileExpr(arg, context);
    const compiledAsPattern = compilePattern(arg, context);
    const argPosition = getPosition(arg);
    const compiledAssign = assign(argPosition, context);

    return async (context) => {
      const value = await compiledAsExpr(context);
      return await flatMapEffect(value, context, async (value, context) => {
        assert(typeof value === 'number', 'expected number');
        const { matched, envs } = await compiledAsPattern(value + 1, context);
        assert(matched, 'expected pattern to match');
        compiledAssign(envs, context);
        return value;
      });
    };
  },

  [NodeType.DECLARE]: (ast, context) => {
    const [pattern, expr] = ast.children;
    const compiledExpr = compileStatement(expr, context);
    const compiledPattern = compilePattern(pattern, context);

    return async (_context) => {
      const value = await compiledExpr(_context);
      return await flatMapEffect(value, _context, async (value, context) => {
        const result = await compiledPattern(value, context);
        assert(result.matched, 'expected pattern to match');
        bind(result.envs, context);
        return value;
      });
    };
  },
  [NodeType.ASSIGN]: (ast, context) => {
    const [pattern, expr] = ast.children;
    const compiledExpr = compileStatement(expr, context);
    const compiledPattern = compilePattern(pattern, context);
    const compiledAssign = assign(getPosition(pattern), context);

    return async (_context) => {
      const value = await compiledExpr(_context);
      return await flatMapEffect(value, _context, async (value, context) => {
        const { matched, envs } = await compiledPattern(value, context);
        assert(matched, 'expected pattern to match');
        compiledAssign(envs, context);
        return value;
      });
    };
  },
  [NodeType.INC_ASSIGN]: (ast, context) => {
    const [pattern, expr] = ast.children;
    const compiledExpr = compileExpr(expr, context);
    const compiledPattern = compilePattern(pattern, context);
    const patternPosition = getPosition(pattern);
    const compiledIncAssign = incAssign(patternPosition, context);

    return async (_context) => {
      const value = await compiledExpr(_context);
      return await flatMapEffect(value, _context, async (value, context) => {
        assert(
          typeof value === 'number' ||
            Array.isArray(value) ||
            typeof value === 'string'
        );
        const { matched, envs } = await compiledPattern(value, context);
        assert(matched, 'expected pattern to match');
        compiledIncAssign(envs, context);
        return value;
      });
    };
  },

  [NodeType.LABEL]: (ast, context) => {
    return compileStatement(tuple([ast]), context);
  },
  [NodeType.TUPLE]: (ast, context) => {
    const children = ast.children.slice();
    if (children.length === 0) return async () => [];
    const head = children.pop()!;
    if (head.type === NodeType.IMPLICIT_PLACEHOLDER) return async () => [];
    if (head.type === NodeType.PLACEHOLDER) return async () => [];

    const opCompiler =
      tupleOperators[head.type as keyof typeof tupleOperators] ??
      tupleOperators[NodeType.TUPLE];
    const compiledOp = opCompiler(head, context);

    if (children.length === 0) {
      return async (context) => {
        return await compiledOp([], context);
      };
    }

    const compiledTail = compileExpr(tuple(children), context);

    return async (context) => {
      const tail = await compiledTail(context);
      return await flatMapEffect(tail, context, async (tail, context) => {
        assert(
          isRecord(tail) || Array.isArray(tail),
          'expected record or tuple'
        );
        return await compiledOp(tail, context);
      });
    };
  },
  [NodeType.INDEX]: (ast, context) => {
    const [targetAst, indexAst] = ast.children;
    const compiledTarget = compileExpr(targetAst, context);
    const compiledIndex = compileExpr(indexAst, context);
    const targetPosition = getPosition(targetAst);
    const indexPosition = getPosition(indexAst);
    const invalidIndexTargetError = SystemError.invalidIndexTarget(
      targetPosition
    ).withFileId(context.fileId);

    const indexTarget = async (
      target: EvalValue,
      index: EvalValue,
      evalContext: EvalContext
    ) => {
      if (isPrototyped(target)) {
        const targetValue = target.value;

        if (isRecord(targetValue) && recordHas(targetValue, index)) {
          return recordGet(targetValue, index);
        }

        if (Array.isArray(target) && Number.isInteger(index)) {
          return target[index as number] ?? null;
        }

        for (const prototype of target.prototypes) {
          const method = await indexTarget(prototype, index, evalContext);
          if (method === null) continue;

          assert(typeof method === 'function', 'expected function');
          return await method(
            [indexPosition, evalContext, context],
            targetValue
          );
        }

        return null;
      }

      if (typeof target === 'string') {
        return await indexTarget(
          { prototypes: [stringPrototype], value: target },
          index,
          evalContext
        );
      }

      if (Array.isArray(target) && !Number.isInteger(index)) {
        return await indexTarget(
          { prototypes: [listPrototype], value: target },
          index,
          evalContext
        );
      }

      if (Array.isArray(target)) {
        return target[index as number] ?? null;
      }

      if (isRecord(target)) {
        return recordGet(target, index);
      }

      if (isChannel(target)) {
        if (index === atom('status')) return atom(channelStatus(target));
      }

      unreachable(invalidIndexTargetError);
    };

    return async (evalContext) => {
      const target = await compiledTarget(evalContext);
      return await flatMapEffect(
        target,
        evalContext,
        async (target, evalContext) => {
          const index = await compiledIndex(evalContext);

          return await flatMapEffect(
            index,
            evalContext,
            async (index) => await indexTarget(target, index, evalContext)
          );
        }
      );
    };
  },
  [NodeType.CODE_LABEL]: (ast, context) => {
    const compiledExpr = compileStatement(ast.children[0], context);
    const exprPosition = getPosition(ast.children[0]);
    const label = Symbol(ast.data.name);
    const labelHandler: EvalFunction = async (cs, v) => {
      assert(Array.isArray(v), 'expected v to be an array');
      const [_callback, value] = v;
      assert(Array.isArray(value), 'expected value to be an array');
      const [status, innerValue] = value;
      if (status === 'break') return innerValue;
      if (status === 'continue') {
        return await compiled(cs[1]);
      }
      return null;
    };
    const handlers = createRecord({
      [label]: createHandler(labelHandler),
    });
    const labelBreak: EvalFunction = async (cs, value) => {
      return createEffect(label, ['break', value], cs[1].env);
    };
    const labelContinue: EvalFunction = async (cs, value) => {
      await eventLoopYield();
      return createEffect(label, ['continue', value], cs[1].env);
    };
    const labelRecord = createRecord({
      break: labelBreak,
      continue: labelContinue,
    });
    const labelAtom = atom(ast.data.name);
    const compiled: Executable = async (evalContext) => {
      const forked = forkContext(evalContext);
      forked.env.addReadonly(labelAtom, labelRecord);

      return await handleEffects(
        handlers,
        await compiledExpr(forked),
        exprPosition,
        forked,
        context
      );
    };
    return compiled;
  },
  [NodeType.SEND]: (ast, context) => {
    const [chanAst, valueAst] = ast.children;
    const compiledExpr = compileExpr(chanAst, context);
    const compiledValue = compileExpr(valueAst, context);
    const invalidSendChannelError = SystemError.invalidSendChannel(
      getPosition(chanAst)
    ).withFileId(context.fileId);
    const channelClosedError = SystemError.channelClosed(
      getPosition(chanAst)
    ).withFileId(context.fileId);

    return async (context) => {
      const channelValue = await compiledExpr(context);
      return await flatMapEffect(
        channelValue,
        context,
        async (channelValue, context) => {
          assert(isChannel(channelValue), invalidSendChannelError);

          const channel = getChannel(channelValue);
          assert(channel, channelClosedError);

          const value = await compiledValue(context);

          return await flatMapEffect(value, context, async (value) => {
            const [_status, received] = send(channelValue, value);
            await received;
            return null;
          });
        }
      );
    };
  },
  [NodeType.RECEIVE]: (ast, context) => {
    const compiledExpr = compileExpr(ast.children[0], context);
    const invalidReceiveChannelError = SystemError.invalidReceiveChannel(
      getPosition(ast)
    ).withFileId(context.fileId);
    const channelClosedError = SystemError.channelClosed(
      getPosition(ast)
    ).withFileId(context.fileId);
    return async (context) => {
      const channelValue = await compiledExpr(context);

      return await flatMapEffect(
        channelValue,
        context,
        async (channelValue) => {
          assert(isChannel(channelValue), invalidReceiveChannelError);
          return await receive(channelValue).catch((e) => {
            assert(e !== 'channel closed', channelClosedError);
            throw e;
          });
        }
      );
    };
  },
  [NodeType.SEND_STATUS]: (ast, context) => {
    const compiledExpr = compileExpr(ast.children[0], context);
    const compiledValue = compileExpr(ast.children[1], context);
    const invalidSendChannelError = SystemError.invalidSendChannel(
      getPosition(ast)
    ).withFileId(context.fileId);
    return async (context) => {
      const channelValue = await compiledExpr(context);
      return await flatMapEffect(
        channelValue,
        context,
        async (channelValue, context) => {
          assert(isChannel(channelValue), invalidSendChannelError);

          const value = await compiledValue(context);
          return await flatMapEffect(value, context, async (value) => {
            const [status] = send(channelValue, value);
            return atom(status);
          });
        }
      );
    };
  },
  [NodeType.RECEIVE_STATUS]: (ast, context) => {
    const compiledExpr = compileExpr(ast.children[0], context);
    const invalidReceiveChannelError = SystemError.invalidReceiveChannel(
      getPosition(ast)
    ).withFileId(context.fileId);
    return async (context) => {
      const channelValue = await compiledExpr(context);

      return await flatMapEffect(
        channelValue,
        context,
        async (channelValue) => {
          assert(isChannel(channelValue), invalidReceiveChannelError);

          const [value, status] = tryReceive(channelValue);
          if (value instanceof Error) throw value;
          return [value ?? [], atom(status)];
        }
      );
    };
  },

  [NodeType.FUNCTION]: (ast, context) => {
    const [patternsAst, bodyAst] = ast.children;
    const isTopFunction = ast.data.isTopFunction ?? true;
    const patterns =
      patternsAst.type !== NodeType.TUPLE
        ? [patternsAst]
        : patternsAst.children;
    const pattern = patterns[0];
    const rest = patterns.slice(1);
    const body =
      rest.length === 0
        ? bodyAst
        : fnAST(tuple(rest), bodyAst, { isTopFunction: false });
    const bodyPosition = getPosition(bodyAst);
    const compiledBody = compileStatement(body, context);
    const compiledPattern = compilePattern(pattern, context);
    const matchError = (position: Position, fileId: number) =>
      SystemError.evaluationError(
        'expected pattern to match',
        [],
        getPosition(pattern)
      )
        .withPrimaryLabel('called here', position, fileId)
        .withFileId(context.fileId);

    if (body.type === NodeType.IMPLICIT_PLACEHOLDER) {
      return async (context) => {
        const functionContext = forkContext(context);
        return async (cs, arg) => {
          const [position, _, callerCompileContext] = cs;
          const fileId = callerCompileContext.fileId;
          const result = await compiledPattern(arg, functionContext);
          assert(result.matched, matchError(position, fileId));
          return null;
        };
      };
    }

    const returnHandler: EvalFunction = async (_cs, v) => {
      assert(Array.isArray(v), 'expected value to be an array');
      const [_callback, value] = v;
      return value;
    };
    const fnTryHandler: EvalFunction = async (cs, v) => {
      assert(Array.isArray(v), 'expected value to be an array');
      const [callback, value] = v;
      assert(typeof callback === 'function', 'expected callback');
      const result = await callback(cs, value);
      return createOk(result);
    };
    const returnAtom = atom('return');
    const handlers = createRecord({
      [returnAtom]: createHandler(returnHandler),
      [FnTryEffect]: createHandler(fnTryHandler),
    });
    const selfAtom = atom('self');
    return async (evalContext) => {
      const functionContext = forkContext(evalContext);
      const self: EvalFunction = async (cs, arg) => {
        const [position, _, callerCompileContext] = cs;
        const fileId = callerCompileContext.fileId;
        await eventLoopYield();

        const result = await compiledPattern(arg, functionContext);
        assert(result.matched, matchError(position, fileId));

        const bound = bindContext(result.envs, functionContext);
        if (isTopFunction) bound.env.addReadonly(selfAtom, self);

        return await handleEffects(
          handlers,
          await compiledBody(bound),
          bodyPosition,
          bound,
          context
        );
      };
      return self;
    };
  },
  [NodeType.APPLICATION]: (ast, context) => {
    const astPosition = getPosition(ast);
    const [fnExpr, argStmt] = ast.children;
    const fnCompiled = compileExpr(fnExpr, context);
    const argExpr =
      argStmt.type === NodeType.BLOCK
        ? fnAST(implicitPlaceholder(getPosition(argStmt)), argStmt, {
            isTopFunction: false,
          })
        : argStmt;
    const argCompiled = compileStatement(argExpr, context);

    const invalidApplicationError = SystemError.invalidApplicationExpression(
      getPosition(fnExpr)
    ).withFileId(context.fileId);

    return async (evalContext) => {
      const fnValue = await fnCompiled(evalContext);
      return await flatMapEffect(
        fnValue,
        evalContext,
        async (fnValue, evalContext) => {
          assert(typeof fnValue === 'function', invalidApplicationError);

          const argValue = await argCompiled(evalContext);
          return await flatMapEffect(
            argValue,
            evalContext,
            async (argValue, evalContext) => {
              const result = await fnValue(
                [astPosition, evalContext, context],
                argValue
              );

              return await replaceEffectContext(result, evalContext);
            }
          );
        }
      );
    };
  },

  [NodeType.TRY]: (ast, context) => {
    const compiled = compileExpr(ast.children[0], context);
    const returnAtom = atom('return');
    const errorAtom = atom('error');
    const okAtom = atom('ok');
    return async (context) => {
      const result = await compiled(context);
      return await flatMapEffect(result, context, async (result, context) => {
        if (isResult(result)) {
          const [status, value] = result.value;

          if (status === okAtom) {
            return createEffect(FnTryEffect, value, context.env);
          }

          if (status === errorAtom) {
            return createEffect(returnAtom, result, context.env);
          }
        }

        return createEffect(FnTryEffect, result, context.env);
      });
    };
  },
} satisfies Record<PropertyKey, Compiler>;

const tupleOperators = {
  [NodeType.SPREAD]: (head, context) => {
    const compiled = compileExpr(head.children[0], context);
    return async (tupleValue, context) => {
      const value = await compiled(context);
      return await flatMapEffect(value, context, async (value) => {
        if (Array.isArray(tupleValue) && Array.isArray(value)) {
          return [...tupleValue, ...value];
        }
        if (isRecord(tupleValue) && isRecord(value)) {
          return recordMerge(tupleValue, value);
        }
        unreachable('inconsistent spread types');
      });
    };
  },
  [NodeType.LABEL]: (head, context) => {
    const keyNode = head.children[0];
    const compiledKey =
      keyNode.type === NodeType.NAME
        ? async () => atom(keyNode.data.value)
        : keyNode.type === NodeType.SQUARE_BRACKETS
          ? compileExpr(keyNode.children[0], context)
          : compileExpr(keyNode, context);
    const compiledValue = compileExpr(head.children[1], context);

    return async (tupleValue, context) => {
      const key = await compiledKey(context);
      return await flatMapEffect(key, context, async (key, context) => {
        const value = await compiledValue(context);
        return await flatMapEffect(value, context, async (value) => {
          if (Array.isArray(tupleValue) && tupleValue.length === 0) {
            return createRecord([[key, value]]);
          }
          assert(isRecord(tupleValue), 'expected record');
          recordSet(tupleValue, key, value);
          return tupleValue;
        });
      });
    };
  },
  [NodeType.TUPLE]: (head, context) => {
    const compiled = compileExpr(head, context);
    return async (tupleValue, context) => {
      const value = await compiled(context);
      assert(Array.isArray(tupleValue), 'expected array');
      return await flatMapEffect(value, context, async (value) => [
        ...tupleValue,
        value,
      ]);
    };
  },
} satisfies Record<
  PropertyKey,
  (
    ast: Tree,
    context: CompileContext
  ) => (
    tupleValue: EvalValue[] | EvalRecord,
    context: EvalContext
  ) => Promise<EvalValue>
>;

export const compileStatement: Compiler = (ast, context) => {
  // TODO: should be already lowered before compilation
  const desugared = lower(ast);
  if (desugared !== ast) {
    return compileStatement(desugared, context);
  }

  if (ast.type in lazyOperators) {
    const opCompiler = lazyOperators[ast.type as keyof typeof lazyOperators];
    const compiled = opCompiler(ast, context);
    return async (context) => {
      const value = await compiled(context);
      if (value instanceof Error) throw value;
      return value;
    };
  }

  if (ast.type in operators) {
    const children = ast.children.slice();
    const first = children.pop()!;

    const firstCompiled = compileExpr(first, context);

    if (children.length === 0) {
      return async (context) =>
        await flatMapEffect(
          await firstCompiled(context),
          context,
          async (firstValue) => operators[ast.type](firstValue)
        );
    }

    if (children.length === 1) {
      const second = children.pop()!;
      const secondCompiled = compileExpr(second, context);
      return async (context) =>
        await flatMapEffect(
          await firstCompiled(context),
          context,
          async (firstValue, context) => {
            return await flatMapEffect(
              await secondCompiled(context),
              context,
              async (secondValue) =>
                operators[ast.type](secondValue, firstValue)
            );
          }
        );
    }

    const restAst = node(ast.type, { children });
    const restCompiled = compileExpr(restAst, context);
    return async (context) =>
      await flatMapEffect(
        await firstCompiled(context),
        context,
        async (firstValue, context) => {
          const restValue = await restCompiled(context);
          return await flatMapEffect(restValue, context, async (restValue) =>
            operators[ast.type](restValue, firstValue)
          );
        }
      );
  }

  switch (ast.type) {
    case NodeType.ATOM: {
      const atomValue = atom(ast.data.name);
      return async () => atomValue;
    }

    case NodeType.NAME: {
      const name = ast.data.value;
      if (name === 'true') return async () => true;
      if (name === 'false') return async () => false;
      const error = SystemError.undeclaredName(
        name,
        getPosition(ast)
      ).withFileId(context.fileId);
      const nameAtom = atom(name);
      return async (evalContext) => {
        assert(evalContext.env.has(nameAtom), error);
        return evalContext.env.get(nameAtom);
      };
    }
    case NodeType.NUMBER:
    case NodeType.STRING:
      return async () => ast.data.value;
    case NodeType.PLACEHOLDER:
      return async () => null;
    case NodeType.IMPLICIT_PLACEHOLDER:
      unreachable(
        SystemError.invalidPlaceholderExpression(getPosition(ast)).withFileId(
          context.fileId
        )
      );
    case NodeType.ERROR:
      unreachable(ast.data.cause.withFileId(context.fileId));

    case NodeType.SPREAD: {
      unreachable(
        SystemError.invalidUseOfSpread(getPosition(ast)).withFileId(
          context.fileId
        )
      );
    }
    default:
      return async () => null;
  }
};;

const compileBlock: Compiler = (ast, context) => {
  const compiled = compileStatement(ast, context);
  return async (context: EvalContext) => {
    const blockContext = forkContext(context);
    return await compiled(blockContext);
  };
};

export const compileExpr: Compiler = (ast, context) => {
  const compiled = compileStatement(ast, context);
  const error = SystemError.evaluationError(
    'expected a value',
    [],
    getPosition(ast)
  ).withFileId(context.fileId);

  return async (context) => {
    const result = await compiled(context);
    return (await flatMapEffect(result, context, async (result) => {
      assert(result !== null, error);
      return result;
    })) as Exclude<EvalValue, null>;
  };
};

export const compileScript: Compiler = (ast, context) => {
  assert(ast.type === NodeType.SCRIPT, 'expected script');
  const compiled = compileStatement(sequence(ast.children), context);
  // const getNodeSpan = (node: Tree): Position => {
  //   return mergePositions(getPosition(node), ...node.children.map(getNodeSpan));
  // };
  // const getSeparator = (left: Tree, right: Tree) => {
  //   const source = getFileSource(context.file);
  //   if (source === null) return null;
  //   const leftSpan = getNodeSpan(left);
  //   const rightSpan = getNodeSpan(right);
  //   return source.slice(leftSpan.end, rightSpan.start);
  // };
  // const compileScriptStatements = (children: Tree[]): Executable => {
  //   if (children.length === 0) return async () => null;

  //   const [head, ...rest] = children;
  //   const compiledHead = compileStatement(head, context);
  //   if (rest.length === 0) return compiledHead;

  //   const next = rest[0]!;
  //   const separator = getSeparator(head, next);
  //   const newlineCount = separator?.match(/\n/g)?.length ?? 0;
  //   if (
  //     head.type === NodeType.ASYNC &&
  //     separator !== null &&
  //     !separator.includes(';') &&
  //     newlineCount === 1
  //   ) {
  //     return compiledHead;
  //   }

  //   const compiledRest = compileScriptStatements(rest);
  //   return async (evalContext) => {
  //     const value = await compiledHead(evalContext);
  //     return await flatMapEffect(value, evalContext, async (_, evalContext) => {
  //       return await compiledRest(evalContext);
  //     });
  //   };
  // };
  // const compiled = compileScriptStatements(ast.children);
  return async (evalContext) => {
    return handleEffects(
      preludeHandlers,
      await compiled(evalContext),
      getPosition(ast),
      evalContext,
      context
    );
  };
};

export const compileModule = (
  ast: Tree,
  context: CompileContext
): ((context: EvalContext) => Promise<EvalRecord>) => {
  assert(ast.type === NodeType.MODULE, 'expected module');
  const compiledBindExport = bindExport(context);
  const compileModuleStatement = (ast: Tree) => compileStatement(ast, context);
  const defaultExportError = (position: Position) =>
    SystemError.duplicateDefaultExport(position).withFileId(context.fileId);
  const compileModuleExpr = (ast: Tree) => compileExpr(ast, context);
  const compileModulePattern = (ast: Tree) => compilePattern(ast, context);

  return async (context) => {
    const record: EvalRecord = createRecord();

    for (const child of ast.children) {
      if (child.type === NodeType.DECLARE) {
        const [pattern, expr] = child.children;
        const value = await compileModuleExpr(expr)(context);
        const { matched, envs } = await compileModulePattern(pattern)(
          value,
          context
        );
        assert(matched, 'expected pattern to match');
        compiledBindExport(envs, record, context);
      } else if (child.type === NodeType.EXPORT) {
        const value = await compileModuleExpr(child.children[0])(context);

        assert(
          !recordHas(record, ModuleDefault),
          defaultExportError(getPosition(child.children[0]))
        );

        recordSet(record, ModuleDefault, value);
      } else {
        await compileModuleStatement(child)(context);
      }
    }

    return record;
  };
};

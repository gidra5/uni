import type { CompileContext, EvalContext } from './context.js';
import { type Position } from '../position.js';
import { assert } from '../utils.js';
import {
  type CallSite,
  createEffect,
  type EvalFunction,
  type EvalRecord,
  type EvalValue,
  isEffect,
  isHandler,
  recordGet,
  recordHas,
} from '../values.js';

export const ReturnHandler = Symbol('return_handler');
export const MaskEffect = Symbol('effect mask');

export const handleEffects = async (
  handlers: EvalRecord,
  value: EvalValue,
  position: Position,
  context: EvalContext,
  compileContext: CompileContext
): Promise<EvalValue> => {
  const cs: CallSite = [position, context, compileContext];

  if (!isEffect(value)) {
    const returnHandler = recordGet(handlers, ReturnHandler);
    if (returnHandler === null) return value;
    assert(
      typeof returnHandler === 'function',
      'expected return handler to be a function'
    );
    return returnHandler(cs, value);
  }

  if (value.effect === MaskEffect && recordHas(handlers, value.value)) {
    const resumed = await runEffectContinuations(value.continuations, cs, null);
    return await mapEffect(resumed, context, async (value, context) => {
      return await handleEffects(
        handlers,
        value,
        position,
        context,
        compileContext
      );
    });
  }

  if (!recordHas(handlers, value.effect)) {
    return await mapEffect(value, context, async (value, context) => {
      return await handleEffects(
        handlers,
        value,
        position,
        context,
        compileContext
      );
    });
  }

  const env = value.env.copyUpTo(context.env);
  const callback: EvalFunction = async (cs, resumedValue) => {
    value.env.replace(env, context.env);
    const continued = await runEffectContinuations(
      value.continuations,
      cs,
      resumedValue
    );
    return await handleEffects(
      handlers,
      continued,
      position,
      context,
      compileContext
    );
  };

  const handlerValue = recordGet(handlers, value.effect);
  if (!isHandler(handlerValue)) return await callback(cs, handlerValue);

  return await handlerValue.handler(cs, [callback, value.value]);
};

export const replaceEffectContext = async (
  value: EvalValue,
  context: EvalContext
): Promise<EvalValue> => {
  if (!isEffect(value)) return value;
  const updated = createEffect(
    value.effect,
    value.value,
    context.env,
    value.continuations
  );
  return await flatMapEffect(updated, context, replaceEffectContext);
};

export const mapEffect = async (
  value: EvalValue,
  context: EvalContext,
  map: (v: EvalValue, context: EvalContext) => Promise<EvalValue>
): Promise<EvalValue> => {
  if (isEffect(value)) {
    value.continuations.push(async (_cs, v) => map(v, context));
    return value;
  }
  return await map(value, context);
};

export const flatMapEffect = async (
  value: EvalValue,
  context: EvalContext,
  map: (v: EvalValue, context: EvalContext) => Promise<EvalValue>
): Promise<EvalValue> => {
  if (isEffect(value)) {
    return await mapEffect(value, context, async (value, context) => {
      value = await replaceEffectContext(value, context);
      return await flatMapEffect(value, context, map);
    });
  }
  return await map(value, context);
};

const runEffectContinuations = async (
  continuations: EvalFunction[],
  cs: CallSite,
  value: EvalValue
) => {
  for (const continuation of continuations) {
    value = await continuation(cs, value);
  }
  return value;
};

import path from 'node:path';
import { Environment } from '../environment.js';
import { SystemError } from '../error.js';
import { getModule } from '../files.js';
import { inject, Injectable, register } from '../injector.js';
import { parseModule, parseScript } from '../parser.js';
import { parseTokens } from '../tokens.js';
import { assert, unreachable } from '../utils.js';
import { validate } from '../validate.js';
import { createRecord, type EvalRecord } from '../values.js';
import { prelude, preludeHandlers } from '../std/prelude.js';
import { compileModule, compileScript } from './compile.js';
import {
  type CompileContext,
  type EvalContext,
  type Executable,
  newCompileContext,
} from './context.js';
import { handleEffects } from './eval.js';

export * from './context.js';
export { compileExpr, compileScript, compileStatement } from './compile.js';
export { handleEffects } from './eval.js';

export const newContext = (): EvalContext => {
  const env = new Environment({ parent: prelude });
  return { env };
};

export const compileScriptString = (
  input: string,
  context: CompileContext
): Executable => {
  const tokens = parseTokens(input);
  const ast = parseScript(tokens);
  const [errors, validated] = validate(ast, context.fileId);
  if (errors.length > 0) {
    errors.forEach((e) => e.print());
    return async () => null;
  }
  // const lowered = lower(validated);
  // const compiled = compileScript(lowered, context);
  const compiled = compileScript(validated, context);

  return async (evalContext) => {
    return await compiled(evalContext).catch((e) => {
      if (e instanceof SystemError) e.print();

      return null;
    });
  };
};

export const evaluateModuleString = async (
  input: string,
  context: CompileContext,
  evalContext: EvalContext
): Promise<EvalRecord> => {
  return await compileModuleString(input, context)(evalContext);
};

const compileModuleString = (
  input: string,
  context: CompileContext
): ((context: EvalContext) => Promise<EvalRecord>) => {
  const tokens = parseTokens(input);
  const ast = parseModule(tokens);
  const [errors, validated] = validate(ast, context.fileId);

  if (errors.length > 0) {
    errors.forEach((e) => e.print());
    return async () => createRecord();
  }

  // const lowered = lower(validated);
  // const compiled = compileModule(lowered, context);
  const compiled = compileModule(validated, context);
  return async (context) => {
    return await compiled(context).catch((e) => {
      if (e instanceof SystemError) e.print();

      return createRecord();
    });
  };
};

export const evaluateEntryFile = async (file: string, argv: string[] = []) => {
  return await compileEntryFile(file)(argv);
};

const compileEntryFile = (file: string) => {
  const resolved = path.resolve(file);
  const root = path.dirname(resolved);
  const name = '/' + path.basename(resolved);
  register(Injectable.RootDir, root);
  return async (argv: string[] = []) => {
    const module = await getModule({ name });

    if ('script' in module) {
      return module.script;
    } else if ('module' in module) {
      const main = module.default;
      assert(
        typeof main === 'function',
        'default export from runnable module must be a function'
      );
      const fileId = inject(Injectable.FileMap).getFileId(file);
      const evalContext = { env: prelude };
      const context = newCompileContext(fileId, file);
      const position = { start: 0, end: 0 };
      const value = await handleEffects(
        preludeHandlers,
        await main([position, evalContext, context], argv),
        position,
        evalContext,
        context
      );
      return value;
    }

    unreachable('file must be a script or a module');
  };
};

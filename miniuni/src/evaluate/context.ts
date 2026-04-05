import { type Tree } from '../ast.js';
import { Environment } from '../environment.js';
import { type EvalValue } from '../values.js';

export type EvalContext = {
  env: Environment;
};

export type CompileContext = {
  file: string;
  fileId: number;
};

export type Executable = (env: EvalContext) => Promise<EvalValue>;
export type Compiler = (ast: Tree, context: CompileContext) => Executable;

export const forkContext = (context: EvalContext): EvalContext => {
  return { ...context, env: new Environment({ parent: context.env }) };
};

export const newCompileContext = (
  fileId: number,
  file: string
): CompileContext => {
  return { file, fileId };
};

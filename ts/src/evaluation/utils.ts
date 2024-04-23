import { Scope } from "../scope.js";
import { Context, ResolvedModule, ValueRef } from "./types";
import { getterSymbol, setterSymbol } from "./values.js";
import { TaskQueue } from "./taskQueue.js";
import path from "path";
import fsp from "fs/promises";
import { parseTokens } from "../parser/tokens.js";
import { parse } from "../parser/index.js";
import { desugar } from "../transformers/desugar.js";
import { semanticReduction } from "../transformers/semanticReduction.js";
import { evaluate } from "./index.js";

export const initialContext = (taskQueue: TaskQueue): Context => {
  const dependencyCache = new Map<string, ResolvedModule>();
  const context: Context = {
    scope: new Scope<ValueRef>({
      getter: { get: () => getterSymbol },
      setter: { get: () => setterSymbol },
    }),
    filePath: "",
    projectPath: "",
    dependencyResolver: async (name: string) => {
      if (dependencyCache.has(name)) return dependencyCache.get(name)!;

      const module = await loadFile(path.join(context.projectPath, "..", "dependencies", name), context);
      dependencyCache.set(name, module);
      return module;
    },
  };

  return context;
};

export async function loadScript(source: string, taskQueue: TaskQueue): Promise<ResolvedModule> {
  const context = initialContext(taskQueue);
  const [tokens, tokenErrors] = parseTokens(source);
  const [ast, astErrors] = parse()(tokens);
  const desugared = desugar(ast);

  return new Promise((resolve) => {
    evaluate(taskQueue, semanticReduction(desugared), context, (value) => resolve({ value }));
    taskQueue.run();
  });
}

export async function loadModule(source: string, taskQueue: TaskQueue): Promise<ResolvedModule> {
  const context = initialContext(taskQueue);
  const [tokens, tokenErrors] = parseTokens(source);
  const [ast, astErrors] = parse()(tokens);
  const desugared = desugar(ast);

  return new Promise((resolve) => {
    evaluate(taskQueue, semanticReduction(desugared), context, (value) => resolve({ value }));
    taskQueue.run();
  });
}

export async function loadFile(name: string, context: Context): Promise<ResolvedModule> {
  const resolvedPath = await resolvePath(name, context);

  if (!resolvedPath) return await context.dependencyResolver(name);

  if (resolvedPath.endsWith(".unim")) {
    const file = await fsp.readFile(resolvedPath, "utf-8");
    return await loadModule(file, new TaskQueue());
  }

  if (resolvedPath.endsWith(".uni")) {
    const file = await fsp.readFile(resolvedPath, "utf-8");
    return await loadScript(file, new TaskQueue());
  }

  const file = await fsp.readFile(resolvedPath, "binary");
  return { value: file };
}

async function resolvePath(name: string, context: Context) {
  if (name.startsWith("./")) {
    return path.resolve(context.filePath, name);
  }

  if (name.startsWith("/")) {
    return path.join(context.projectPath, name.slice(1));
  }
}

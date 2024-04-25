import { Scope } from "../scope.js";
import { Context, Value, ValueRef } from "./types";
import { TaskQueue } from "./taskQueue.js";
import path from "path";
import fsp from "fs/promises";
import { evaluate } from "./index.js";
import { parseModuleString, parseScriptString } from "../parser/string.js";

export const initialContext = (taskQueue: TaskQueue): Context => {
  const context: Context = {
    taskQueue,
    scope: new Scope<ValueRef>(),
    filePath: "",
    projectPath: "",
  };

  return context;
};

export async function loadScript(source: string, taskQueue: TaskQueue): Promise<Value> {
  const context = initialContext(taskQueue);
  return new Promise((resolve) => {
    evaluate(taskQueue, parseScriptString(source), context, resolve);
    taskQueue.run();
  });
}

export async function loadModule(source: string, taskQueue: TaskQueue): Promise<Value> {
  const context = initialContext(taskQueue);
  return new Promise((resolve) => {
    evaluate(taskQueue, parseModuleString(source), context, resolve);
    taskQueue.run();
  });
}

const MODULE_FILE_EXTENSION = ".unim";
const SCRIPT_FILE_EXTENSION = ".uni";
export async function loadFile(name: string, context: Context): Promise<Value> {
  const resolvedPath = await resolvePath(name, context);

  if (resolvedPath.endsWith(MODULE_FILE_EXTENSION)) {
    const file = await fsp.readFile(resolvedPath, "utf-8");
    return await loadModule(file, context.taskQueue);
  }

  if (resolvedPath.endsWith(SCRIPT_FILE_EXTENSION)) {
    const file = await fsp.readFile(resolvedPath, "utf-8");
    return await loadScript(file, context.taskQueue);
  }

  const file = await fsp.readFile(resolvedPath, "binary");
  return file;
}

const LOCAL_DEPENDENCIES_PATH = "dependencies";
async function resolvePath(name: string, context: Context) {
  if (name.startsWith("./")) {
    return path.resolve(context.filePath, name);
  }

  if (name.startsWith("/")) {
    return path.join(context.projectPath, name.slice(1));
  }

  return path.join(context.projectPath, "..", LOCAL_DEPENDENCIES_PATH, name);
}

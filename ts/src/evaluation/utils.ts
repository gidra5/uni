import { Scope } from "../scope.js";
import { Context, Future, ValueRef } from "./types";
import { TaskQueue } from "./taskQueue.js";
import path from "path";
import fs from "fs";
import { evaluate } from "./index.js";
import { parseModuleString, parseScriptString } from "../parser/string.js";

const LOCAL_DEPENDENCIES_PATH = "dependencies";
export const initialContext = (taskQueue: TaskQueue): Context => {
  const context: Context = {
    taskQueue,
    scope: new Scope<ValueRef>(),
    filePath: "",
    projectPath: "",
    resolveDependency: (name: string) => path.join(context.projectPath, "..", LOCAL_DEPENDENCIES_PATH, name),
  };

  return context;
};

export function loadScript(source: string, taskQueue: TaskQueue): Future {
  const context = initialContext(taskQueue);
  const parsed = parseScriptString(source);
  return (cont) => cont((_, cont) => evaluate(taskQueue, parsed, context, cont));
}

export function loadModule(source: string, taskQueue: TaskQueue): Future {
  const context = initialContext(taskQueue);
  const parsed = parseModuleString(source);
  return (cont) => evaluate(taskQueue, parsed, context, cont);
}

const MODULE_FILE_EXTENSION = ".unim";
const SCRIPT_FILE_EXTENSION = ".uni";
export function loadFile(name: string, context: Context): Future {
  const resolvedPath = resolvePath(name, context);

  if (resolvedPath.endsWith(MODULE_FILE_EXTENSION)) {
    return (cont) =>
      fs.readFile(resolvedPath, "utf-8", (err, file) => {
        if (!err) loadModule(file, context.taskQueue)(cont);
        else cont(null);
      });
  }

  if (resolvedPath.endsWith(SCRIPT_FILE_EXTENSION)) {
    return (cont) =>
      fs.readFile(resolvedPath, "utf-8", (err, file) => {
        if (!err) loadScript(file, context.taskQueue)(cont);
        else cont(null);
      });
  }

  return (cont) =>
    fs.readFile(resolvedPath, "utf-8", (err, file) => {
      if (!err) cont(file);
      else cont(null);
    });
}

function resolvePath(name: string, context: Context): string {
  if (name.startsWith("./")) {
    // limit the path to the project's directory
    // so that the user can't access files outside of the project
    const projectFilePath = context.filePath.replace(context.projectPath, "");
    return context.projectPath + path.resolve(projectFilePath, name);
  }

  if (name.startsWith("/")) {
    return path.join(context.projectPath, name.slice(1));
  }

  return context.resolveDependency(name);
}

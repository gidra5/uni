import { FileMap } from "codespan-napi";
import type { Precedence } from "../ast";
import type { Position } from "./position";
import { PhysicalType, Type } from "../analysis/types/utils";

enum Injectable {
  FileMap = "FileMap",
  RootDir = "RootDir",
  NextId = "NextId",
  PrecedenceMap = "PrecedenceMap",
  PositionMap = "PositionMap",
  TypeMap = "TypeMap",
  PhysicalTypeMap = "PhysicalTypeMap",
  ClosureVariablesMap = "ClosureVariablesMap",
  BoundVariablesMap = "BoundVariablesMap",
  NodeToVariableMap = "NodeToVariableMap",
}

type InjectableType = {
  [Injectable.FileMap]: FileMap;
  [Injectable.RootDir]: string;
  [Injectable.NextId]: number;
  [Injectable.PrecedenceMap]: Map<number, Precedence>;
  [Injectable.PositionMap]: Map<number, Position>;
  [Injectable.TypeMap]: Map<number, Type>;
  [Injectable.PhysicalTypeMap]: Map<number, PhysicalType>;
  [Injectable.ClosureVariablesMap]: Map<number, number[]>; // node id -> variable ids
  [Injectable.BoundVariablesMap]: Map<number, number[]>; // node id -> variable ids
  [Injectable.NodeToVariableMap]: Map<number, number>; // node id -> variable id
};

const registry = new Map<string, any>();

const register = <const T extends Injectable>(name: T, value: InjectableType[T]) => {
  registry.set(name, value);
};

const inject = <const T extends Injectable>(name: T): InjectableType[T] => {
  if (!registry.has(name)) {
    throw new Error(`Missing injection entry for: ${name}`);
  }

  return registry.get(name);
};

const reset = () => {
  register(Injectable.RootDir, process.cwd());
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
  register(Injectable.TypeMap, new Map());
  register(Injectable.PhysicalTypeMap, new Map());
  register(Injectable.ClosureVariablesMap, new Map());
  register(Injectable.BoundVariablesMap, new Map());
  register(Injectable.NodeToVariableMap, new Map());
};

reset();

export { reset, register, inject, Injectable };

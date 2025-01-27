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
  FreeVariablesMap = "FreeVariablesMap",
  BoundVariablesMap = "BoundVariablesMap",
}

type InjectableType = {
  [Injectable.FileMap]: FileMap;
  [Injectable.RootDir]: string;
  [Injectable.NextId]: number;
  [Injectable.PrecedenceMap]: Map<number, Precedence>;
  [Injectable.PositionMap]: Map<number, Position>;
  [Injectable.TypeMap]: Map<number, Type>;
  [Injectable.PhysicalTypeMap]: Map<number, PhysicalType>;
  [Injectable.FreeVariablesMap]: Map<number, string[]>;
  [Injectable.BoundVariablesMap]: Map<number, string[]>;
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

// Register default injectables
register(Injectable.RootDir, process.cwd());
register(Injectable.FileMap, new FileMap());
register(Injectable.NextId, 0);
register(Injectable.PrecedenceMap, new Map());
register(Injectable.PositionMap, new Map());
register(Injectable.TypeMap, new Map());

export { register, inject, Injectable };

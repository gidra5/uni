import { Iterator } from "iterator-js";
import { assert, nextId, unreachable } from "../../utils";
import { PhysicalType, physicalTypeSize } from "../../analysis/types/utils";
import { PhysicalTypeSchema, globalResolvedNames as names } from "../../analysis/types/infer";

export type LLVMModule = {
  types: LLVMGlobalType[];
  globals: LLVMGlobal[];
  functions: LLVMFunction[];
};

type LLVMGlobal = {
  attributes: string[];
  name: string;
  type: LLVMType;
  value: LLVMValue;
};

type LLVMGlobalType = {
  attributes: string[];
  name: string;
  type: LLVMType;
};

type LLVMFunction = {
  name: string;
  args: LLVMType[];
  returnType: LLVMType;
  body?: LLVMBasicBlock[];
};

type LLVMBasicBlock = {
  name: string;
  instructions: LLVMInstruction[];
};

type LLVMInstruction = {
  twine?: string;
  name: string;
  args: LLVMValue[];
};
export type LLVMValue = string;
export type LLVMValue2 = LLVMValue | ((...types: PhysicalType[]) => LLVMValue);
export type LLVMType =
  | string
  | { args: LLVMType[]; returnType: LLVMType }
  | { pointer: LLVMType; structRet?: boolean }
  | { record: LLVMType[] };

type SymbolMetadata = { name: string; id: number; value: LLVMValue };

class Builder {
  functionIndex: number = 0;
  blockIndex: number = 0;
  instructionIndex: number = 0;
  values: Map<string, LLVMValue> = new Map();
  types: Map<string, LLVMType> = new Map([["null", "ptr"]]);
  localTypes: Map<string, LLVMType> = new Map();
  symbols: Map<string, SymbolMetadata> = new Map();

  constructor(private context: Context) {}

  getTypeString(type: LLVMType): string {
    return stringifyLLVMType(type);
  }

  toLLVMType(type: PhysicalType): LLVMType {
    if (type === "void") return "void";
    if (type === "unknown") return "undef";
    if (type === "symbol") return "i64";
    if ("int" in type) return this.createIntType(type.int);
    if ("float" in type) return this.createFloatType(type.float);

    if ("fn" in type) {
      const fnArgs = type.fn.args.map((type) => this.toLLVMType(type));
      const closure = type.fn.closure.map((type) => this.toLLVMType(type));
      const returnType = this.toLLVMType(type.fn.ret);
      // const isLargeReturnType = isLargePhysicalType(type.fn.return);
      // const _returnType = isLargeReturnType ? "void" : LLVMReturnType;
      // const closureArgs = closure.length > 0 ? [this.createRecordType(closure)] : [];
      // const args = isLargeReturnType
      //   ? [{ pointer: LLVMReturnType, structRet: true }, ...closureArgs, ...fnArgs]
      //   : [...closureArgs, ...fnArgs];
      const _returnType = "void";
      const closureType = this.createRecordType(closure);
      const args = [{ pointer: returnType, structRet: true }, closureType, ...fnArgs];

      const fnType = this.createFunctionType(args, _returnType);
      return this.createRecordType([{ pointer: fnType }, closureType]);
    }

    if ("tuple" in type) {
      return this.createRecordType(type.tuple.map((t) => this.toLLVMType(t)));
    }
    if ("array" in type) {
      return this.createArrayType(this.toLLVMType(type.array), type.length);
    }
    if ("pointer" in type) {
      return { pointer: this.toLLVMType(type.pointer) };
    }

    console.log(type);

    unreachable("cant convert physical type to LLVM type");
  }

  compareTypes(a: LLVMType, b: LLVMType): boolean {
    return this.getTypeString(a) === this.getTypeString(b);
  }

  getType(value: LLVMValue): LLVMType {
    const _type = this.types.get(value) ?? this.localTypes.get(value);
    assert(_type);
    return _type;
  }

  getFreshName(prefix = ""): string {
    return prefix + nextId().toString();
  }

  getOrCreateConstant(value: LLVMValue, type: LLVMType, name?: string): LLVMValue {
    const key = `${stringifyLLVMType(type)}_${value}`;
    const _value = this.values.get(key);
    if (_value) return _value;

    name = name ?? this.getFreshName("const_");
    this.context.module.globals.push({ name, attributes: ["constant"], type, value });

    const valuePtr = `@${name}`;
    this.values.set(key, valuePtr);
    this.types.set(valuePtr, { pointer: type });

    return valuePtr;
  }

  createType(type: LLVMType, _name?: string): LLVMValue {
    if (!_name) {
      const name = this.getFreshName("type_");

      this.context.module.types.push({ name, attributes: ["type"], type });

      return `%${name}`;
    }
    const name = this.getFreshName("type_" + _name);

    this.context.module.types.push({ name, attributes: ["type"], type });

    return `%${name}`;
  }

  insertInstruction(instruction: LLVMInstruction) {
    const currentFunctionBody = this.context.module.functions[this.functionIndex].body;
    assert(currentFunctionBody);
    const instructions = currentFunctionBody[this.blockIndex].instructions;
    instructions.splice(this.instructionIndex, 0, instruction);
    this.instructionIndex++;
  }

  declareFunction(name: string, args: LLVMType[], returnType: LLVMType): LLVMValue {
    const exists = this.context.module.functions.some((f) => f.name === name);
    const value = `@${name}`;
    if (!exists) {
      this.context.module.functions.push({ name, args, returnType });
      this.types.set(value, { pointer: { args, returnType } });
    }
    return value;
  }

  createInt(value: number, size: number): LLVMValue {
    const ptr = this.getOrCreateConstant(String(value), this.createIntType(size));
    const _value = this.createLoad(ptr);
    return _value;
  }

  createFloat(value: number, size: number): LLVMValue {
    const ptr = this.getOrCreateConstant(String(value), this.createFloatType(size));
    const _value = this.createLoad(ptr);
    return _value;
  }

  createBool(value: boolean): LLVMValue {
    return this.createInt(value ? 1 : 0, 1);
  }

  createString(value: string): LLVMValue {
    const length = value.length + 1;
    return this.getOrCreateConstant(`c"${value}\\00"`, this.createConstantStringType(length));
  }

  createSymbol(name: string): LLVMValue {
    const ptr = (() => {
      if (this.symbols.has(name)) {
        return this.symbols.get(name)!.value;
      }

      const id = this.symbols.size;
      const value = this.getOrCreateConstant(String(id), "i64");

      this.symbols.set(name, { name, id, value });

      return value;
    })();

    const value = this.createLoad(ptr);
    return value;
  }

  createRecord(record: LLVMValue[]): LLVMValue {
    const type = this.createRecordType(record.map((value) => this.getType(value)));
    const location = this.createAlloca(type);
    let recordValue = this.createLoad(location);
    for (const [value, index] of Iterator.iter(record).enumerate()) {
      recordValue = this.createInsertValue(recordValue, value, index);
    }
    this.createStore(recordValue, location);
    this.types.set(recordValue, type);
    return recordValue;
  }

  createIntType(size: number): LLVMType {
    return "i" + size;
  }

  createFloatType(size: number): LLVMType {
    if (size === 32) return "float";
    if (size === 64) return "double";
    if (size === 128) return "fp128";
    unreachable("unsupported float size");
  }

  createBoolType(): LLVMType {
    return "i1";
  }

  createConstantStringType(length: number): LLVMType {
    return this.createArrayType(this.createIntType(8), length);
  }

  createCStringType(): LLVMType {
    return { pointer: this.createIntType(8) };
  }

  createArrayType(elementType: LLVMType, length: number): LLVMType {
    return `[${length} x ${stringifyLLVMType(elementType)}]`;
  }

  createFunctionType(args: LLVMType[], returnType: LLVMType): LLVMType {
    return { args, returnType };
  }

  createRecordType(record: LLVMType[]): LLVMType {
    return { record };
  }

  createInstructionVoid(name: string, args: LLVMValue[]) {
    this.insertInstruction({ name, args });
  }

  createInstruction(name: string, args: LLVMValue[], type: LLVMType, twine = this.getFreshName("var_")): LLVMValue {
    this.insertInstruction({ name, args, twine });
    const value = `%${twine}`;
    this.types.set(value, type);
    return value;
  }

  createExtractValue(record: LLVMValue, index: number | LLVMValue): LLVMValue {
    const type = this.getType(record);
    assert(typeof type === "object" && "record" in type);
    return this.createInstruction(
      "extractvalue",
      [`${stringifyLLVMType(type)} ${record}`, index.toString()],
      type.record[index]
    );
  }

  createInsertValue(record: LLVMValue, value: LLVMValue, index: number): LLVMValue {
    const type = this.getType(record);
    return this.createInstruction(
      "insertvalue",
      [`${stringifyLLVMType(type)} ${record}`, `${stringifyLLVMType(this.getType(value))} ${value}`, index.toString()],
      type
    );
  }

  createAlloca(type: LLVMType, initial?: LLVMValue): LLVMValue {
    const typeValue = stringifyLLVMType(type);
    if (initial) return this.createInstruction("alloca", [typeValue, `${typeValue} ${initial}`], { pointer: type });
    return this.createInstruction("alloca", [typeValue], { pointer: type });
  }

  createMalloc(type: PhysicalType, initial?: LLVMValue): LLVMValue {
    const typeSize = physicalTypeSize(type);
    const malloc = this.declareFunction("malloc", ["i64"], "ptr");
    const allocated = this.createCall(malloc, [this.createInt(typeSize, 64)], "ptr", ["i64"]);
    if (initial) this.createStore(initial, allocated);
    return allocated;
  }

  createLoad(value: LLVMValue): LLVMValue {
    const type = this.getType(value);
    assert(typeof type === "object");
    assert("pointer" in type);
    return this.createInstruction("load", [stringifyLLVMType(type.pointer), `ptr ${value}`], type.pointer);
  }

  createStore(value: LLVMValue, location: LLVMValue) {
    this.createInstructionVoid("store", [`${stringifyLLVMType(this.getType(value))} ${value}`, `ptr ${location}`]);
  }

  createLess(lhs: LLVMValue, rhs: LLVMValue): LLVMValue {
    let lhsType = this.getType(lhs);
    let rhsType = this.getType(rhs);
    if (typeof lhsType === "object" && "pointer" in lhsType) {
      lhs = this.createLoad(lhs);
      lhsType = lhsType.pointer;
    }
    if (typeof rhsType === "object" && "pointer" in rhsType) {
      rhs = this.createLoad(rhs);
      rhsType = rhsType.pointer;
    }
    assert(stringifyLLVMType(lhsType) === stringifyLLVMType(rhsType));
    const type = stringifyLLVMType(lhsType);
    return this.createInstruction("icmp slt", [`${type} ${lhs}`, `${type} ${rhs}`], this.createBoolType());
  }

  createAdd(lhs: LLVMValue, rhs: LLVMValue): LLVMValue {
    let lhsType = this.getType(lhs);
    let rhsType = this.getType(rhs);
    if (typeof lhsType === "object" && "pointer" in lhsType) {
      lhs = this.createLoad(lhs);
      lhsType = lhsType.pointer;
    }
    if (typeof rhsType === "object" && "pointer" in rhsType) {
      rhs = this.createLoad(rhs);
      rhsType = rhsType.pointer;
    }
    assert(stringifyLLVMType(lhsType) === stringifyLLVMType(rhsType));
    const type = stringifyLLVMType(lhsType);
    return this.createInstruction("add", [`${type} ${lhs}`, rhs], lhsType);
  }

  createMul(lhs: LLVMValue, rhs: LLVMValue): LLVMValue {
    let lhsType = this.getType(lhs);
    let rhsType = this.getType(rhs);
    if (typeof lhsType === "object" && "pointer" in lhsType) {
      lhs = this.createLoad(lhs);
      lhsType = lhsType.pointer;
    }
    if (typeof rhsType === "object" && "pointer" in rhsType) {
      rhs = this.createLoad(rhs);
      rhsType = rhsType.pointer;
    }
    assert(stringifyLLVMType(lhsType) === stringifyLLVMType(rhsType));
    const type = stringifyLLVMType(lhsType);
    return this.createInstruction("mul", [`${type} ${lhs}`, rhs], lhsType);
  }

  createCallVoid(func: LLVMValue, callArgs: LLVMValue[], argsType: LLVMType[]) {
    assert(argsType.length <= callArgs.length);
    const args = callArgs.map((arg, i) => {
      if (argsType[i] === "...") return `${stringifyLLVMType(this.getType(arg))} ${arg}`;
      const type = argsType[i];
      assert(type);
      return `${stringifyLLVMType(type)} ${arg}`;
    });
    const _args = [`void ${func}(${args.join(", ")})`];
    return this.createInstructionVoid("call", _args);
  }

  createCall(func: LLVMValue, callArgs: LLVMValue[], returnType: LLVMType, argsType: LLVMType[]): LLVMValue {
    if (returnType === "void" && typeof argsType[0] === "object" && "structRet" in argsType[0]) {
      const retType = argsType[0].pointer;
      const retValue = this.createAlloca(retType);
      this.createCallVoid(func, [retValue, ...callArgs], argsType);
      return this.createLoad(retValue);
    }

    const args = callArgs.map((arg, i) => {
      if (argsType[i] === "...") return `${stringifyLLVMType(this.getType(arg))} ${arg}`;
      return `${stringifyLLVMType(argsType[i])} ${arg}`;
    });
    const type = stringifyLLVMType(returnType);
    const _args = [`${type} ${func}(${args.join(", ")})`];
    return this.createInstruction("call", _args, returnType);
  }

  createReturn(value: LLVMValue): LLVMValue {
    this.createInstructionVoid("ret", [value]);
    return "void";
  }

  createFunction(name: string, args: LLVMType[], returnType: LLVMType, body: (...args: LLVMValue[]) => LLVMValue) {
    const value = `@${name}`;

    const exists = this.context.module.functions.some((f) => f.name === name);
    if (!exists) {
      const prevFunctionIndex = this.functionIndex;
      const functionIndex = this.context.module.functions.length;

      const argNames = args.map((_arg, i) => "%arg_" + i);
      const declarationArgs = argNames.map((name, i) => `${stringifyLLVMArgType(args[i])} ${name}`);
      const _f = { name, args: declarationArgs, returnType, body: [] };
      this.types.set(value, { pointer: { args, returnType } });

      const prevTypeMap = new Map(this.localTypes);

      this.context.module.functions.push(_f);
      this.functionIndex = functionIndex;
      argNames.forEach((name, i) => this.localTypes.set(name, args[i]));

      this.createBlock("entry", () => this.createReturn(body(...argNames)));

      this.functionIndex = prevFunctionIndex;
      this.localTypes = prevTypeMap;
    }

    const type = this.getType(value);
    assert(typeof type === "object");
    assert("pointer" in type);
    assert(typeof type.pointer === "object");
    assert("args" in type.pointer);

    return value;
  }

  createFunctionSRet(name: string, args: LLVMType[], retType: LLVMType, body: (...args: LLVMValue[]) => LLVMValue) {
    return this.createFunction(name, [{ pointer: retType, structRet: true }, ...args], "void", (ret, ...args) => {
      const value = body(...args);
      this.createStore(value, ret);
      return "void";
    });
  }

  createClosure(
    name: string,
    argsType: LLVMType[],
    closure: LLVMValue[],
    retType: LLVMType,
    body: (closure: LLVMValue[], ...args: LLVMValue[]) => LLVMValue
  ): LLVMValue {
    const closureValue = this.createRecord(closure);
    const closureType = this.getType(closureValue);
    const func = this.createFunctionSRet(name, [closureType, ...argsType], retType, (closureValue, ...args) => {
      const _closure = closure.map((_, i) => this.createExtractValue(closureValue, i));
      return body(_closure, ...args);
    });

    return this.createRecord([func, closureValue]);
  }

  createBlock(name: string, body: () => void): LLVMValue {
    const prevBlockIndex = this.blockIndex;
    const prevInstructionIndex = this.instructionIndex;
    const functionBody = this.context.module.functions[this.functionIndex].body;
    assert(functionBody);
    const blockIndex = functionBody.length;
    name = `${name}_${blockIndex}`;
    functionBody.push({ name, instructions: [] });
    this.blockIndex = blockIndex;
    this.instructionIndex = 0;
    body();
    this.blockIndex = prevBlockIndex;
    this.instructionIndex = prevInstructionIndex;
    return `%${name}`;
  }

  createBranch(...blocks: LLVMValue[]) {
    this.createInstructionVoid("br", blocks);
  }

  createSelect(condition: LLVMValue, then: LLVMValue, _else: LLVMValue) {
    return this.createInstruction(
      "select",
      [
        `${stringifyLLVMType(this.getType(condition))} ${condition}`,
        `${stringifyLLVMType(this.getType(then))} ${then}`,
        `${stringifyLLVMType(this.getType(then))} ${_else}`,
      ],
      this.getType(then)
    );
  }

  createIf(condition: LLVMValue, then: () => LLVMValue) {
    const restBlockName = this.getFreshName("if_rest");
    let thenResult: LLVMValue;
    const thenBlock = this.createBlock("then", () => {
      thenResult = then();
      this.createBranch(`label %${restBlockName}`);
    });
    this.createBranch(`i1 ${condition}`, `label ${thenBlock}`, `label %${restBlockName}`);

    const functionBody = this.context.module.functions[this.functionIndex].body;
    assert(functionBody);
    const currentBlockName = functionBody[this.blockIndex].name;
    this.blockIndex = functionBody.push({ name: restBlockName, instructions: [] }) - 1;
    this.instructionIndex = 0;

    return this.createPhi([
      [thenResult!, thenBlock],
      ["undef", `%${currentBlockName}`],
    ]);
  }

  createIfElse(condition: LLVMValue, then: () => LLVMValue, _else?: () => LLVMValue) {
    if (!_else) return this.createIf(condition, then);
    const restBlockName = this.getFreshName("if_rest");
    let thenResult: LLVMValue;
    let elseResult: LLVMValue;
    const thenBlock = this.createBlock("then", () => {
      thenResult = then();
      this.createBranch(`label %${restBlockName}`);
    });
    const elseBlock = this.createBlock("else", () => {
      elseResult = _else();
      this.createBranch(`label %${restBlockName}`);
    });
    this.createBranch(`i1 ${condition}`, `label ${thenBlock}`, `label ${elseBlock}`);

    const functionBody = this.context.module.functions[this.functionIndex].body;
    assert(functionBody);
    this.blockIndex = functionBody.push({ name: restBlockName, instructions: [] }) - 1;
    this.instructionIndex = 0;

    return this.createPhi([
      [thenResult!, thenBlock],
      [elseResult!, elseBlock],
    ]);
  }

  createPhi(incoming: [LLVMValue, LLVMValue][]) {
    const typeValue = this.getType(incoming[0][0]);

    return this.createInstruction(
      `phi ${stringifyLLVMType(typeValue)}`,
      incoming.map(([value, branch]) => `[${value}, ${branch}]`),
      typeValue
    );
  }

  createGetElementPtr(pointer: LLVMValue, index: LLVMValue) {
    return this.createInstruction(
      "getelementptr",
      [stringifyLLVMType(this.getType(pointer)), stringifyLLVMType(this.getType(index))],
      { pointer: this.getType(pointer) }
    );
  }

  physicalTypeToLLVMValue(type: PhysicalType): LLVMValue {
    switch (true) {
      case typeof type === "object" && "int" in type: {
        return this.getOrCreateConstant("", "");
      }
    }

    unreachable("cant convert physical type to LLVM type");
  }

  createLoop(initial: LLVMValue, body: (next: LLVMValue) => [LLVMValue, LLVMValue]) {
    const functionBody = this.context.module.functions[this.functionIndex].body;
    assert(functionBody);

    const startBlockName = functionBody[this.blockIndex].name;
    const restBlockName = this.getFreshName("if_rest");

    let stateVar: string;
    const loopBlock = this.createBlock("loop", () => {
      const typeValue = this.getType(initial);

      const args = [`[initial, %${startBlockName}]`];
      const state = this.createInstruction(`phi ${stringifyLLVMType(typeValue)}`, args, typeValue);
      const [condition, nextState] = body(state);
      stateVar = nextState;
      args.push(`[%${stateVar}, loopBlock]`);

      this.createBranch(`i1 ${condition}`, `label ${loopBlock}`, `label %${restBlockName}`);
    });

    this.createBranch(`label ${loopBlock}`);
    this.blockIndex = functionBody.push({ name: restBlockName, instructions: [] }) - 1;
    this.instructionIndex = 0;

    return this.createPhi([[`%${stateVar!}`, loopBlock]]);
  }
}

export class Context {
  public module: LLVMModule;
  public builder: Builder;
  public variables: Map<number, () => LLVMValue2> = new Map();

  constructor(public typeMap: PhysicalTypeSchema) {
    this.module = {
      types: [],
      globals: [],
      functions: [],
    };
    this.builder = new Builder(this);
    this.declareCRuntimeFunctions();
  }

  variablesBlock<T>(body: () => T): T {
    const currentVariables = [...this.variables.entries()];
    const result = body();
    this.variables = new Map(currentVariables);
    return result;
  }

  generateSymbolTable() {
    const symbolsCount = this.builder.symbols.size;
    const symbolMetadataType = this.builder.createRecordType([{ pointer: "i8" }]);
    const symbolsMetadata = [...this.builder.symbols.values()]
      .map(({ name }) => {
        const value = this.builder.createString(name);
        return `{ i8* } { i8* ${value} }`;
      })
      .join(", ");
    const tableType = this.builder.createArrayType(symbolMetadataType, symbolsCount);
    const array = this.builder.getOrCreateConstant(`[${symbolsMetadata}]`, tableType, "symbols_metadata_array");
    this.builder.getOrCreateConstant(array, "ptr", "symbols_metadata");
  }

  moduleString(): string {
    let source = "";
    this.module.types.forEach((global) => {
      const { name, attributes, type } = global;
      source += `${[`%${name} =`, attributes, stringifyLLVMType(type)].join(" ")}\n`;
    });

    this.module.globals.forEach((global) => {
      const { name, attributes, type, value } = global;
      source += `${[`@${name} =`, attributes, stringifyLLVMType(type), value].join(" ")}\n`;
    });

    this.module.functions.forEach(({ name, args, returnType, body }) => {
      const sig = `${stringifyLLVMType(returnType)} @${name}(${args.map(stringifyLLVMArgType).join(", ")})`;
      if (!body) {
        source += `declare ${sig}\n`;
        return;
      }
      source += `define ${sig} {\n`;
      body.forEach(({ name, instructions }) => {
        source += `  ${name}: \n`;
        instructions.forEach((instruction) => {
          source += `    `;
          if (instruction.twine) source += `%${instruction.twine} = `;
          source += `${instruction.name} ${instruction.args.join(", ")}\n`;
        });
      });
      source += "}\n";
    });

    return source;
  }

  declareCRuntimeFunctions() {
    const createClosureCall = (func: LLVMValue, args: LLVMValue[]) => {
      const fnPtr = this.builder.createExtractValue(func, 0);
      const closure = this.builder.createExtractValue(func, 1);

      const fnPtrType = this.builder.getType(fnPtr);
      assert(typeof fnPtrType === "object" && "pointer" in fnPtrType);
      const funcType = fnPtrType.pointer;
      assert(typeof funcType === "object" && "args" in funcType);

      return this.builder.createCall(fnPtr, [closure, ...args], funcType.returnType, funcType.args);
    };
    const createPrintFmtValue = (_fmt: string, value: LLVMValue) => {
      const printf = this.builder.declareFunction("printf", ["i8*", "..."], "i32");
      const fmt = this.builder.createString(_fmt);
      return this.builder.createCallVoid(printf, [fmt, value], ["i8*", "..."]);
    };
    const createPrintString = (str: string) => {
      return createPrintFmtValue("%s", this.builder.createString(str));
    };
    const createPrintWrapper = (name: string, argType: LLVMType) => () => {
      const fnPtr = this.builder.declareFunction(name, [argType], "void");
      return this.builder.createClosure(name + "_wrap", [argType], [], argType, (_closure, arg) => {
        this.builder.createCallVoid(fnPtr, [arg], [argType]);
        return arg;
      });
    };
    const wrap = (name: string, argsType: LLVMType[], returnType: LLVMType) => {
      return () => {
        const f = this.builder.declareFunction(name, argsType, returnType);
        return this.builder.createClosure(`${name}_wrap`, argsType, [], returnType, (_closure, arg1, arg2) => {
          return this.builder.createCall(f, [arg1, arg2], returnType, argsType);
        });
      };
    };

    const printTemplate = (type: PhysicalType) => {
      const llvmType = this.builder.toLLVMType(type);
      const name = `"generated_print_${stringifyPhysicalType(type)}"`;

      return this.builder.createClosure(name, [llvmType], [], llvmType, (_closure, arg) => {
        switch (true) {
          case type === "symbol": {
            const printSymbol = this.variables.get(names.get("print_symbol")!)!();
            assert(typeof printSymbol !== "function");
            createClosureCall(printSymbol, [arg]);
            break;
          }
          case typeof type === "object" && "int" in type && type.int === 1: {
            const selected = this.builder.createSelect(
              arg,
              this.builder.createString("true"),
              this.builder.createString("false")
            );
            createPrintFmtValue("%s", selected);

            break;
          }
          case typeof type === "object" && "int" in type: {
            createPrintFmtValue("%i", arg);
            break;
          }
          case typeof type === "object" && "float" in type: {
            createPrintFmtValue("%f", arg);
            break;
          }
          case typeof type === "object" &&
            "array" in type &&
            typeof type.array === "object" &&
            "int" in type.array &&
            type.array.int === 8: {
            createPrintFmtValue("%s", arg);
            break;
          }
          case typeof type === "object" && "array" in type: {
            const idx = this.builder.createInt(0, 32);

            createPrintString("[");

            this.builder.createLoop(idx, (idx) => {
              const nextIdx = this.builder.createAdd(idx, this.builder.createInt(1, 32));
              const max = this.builder.createInt(type.length, 32);
              const condition = this.builder.createLess(nextIdx, max);

              const condition2 = this.builder.createLess(this.builder.createInt(0, 32), idx);
              this.builder.createIf(condition2, () => {
                createPrintString(", ");
                return "void";
              });

              const item = this.builder.createExtractValue(arg, idx);
              const itemType = type.array;
              const printItem = printTemplate(itemType);

              createClosureCall(printItem, [item]);

              return [condition, nextIdx];
            });

            createPrintString("]");

            break;
          }
          case typeof type === "object" && "fn" in type: {
            const closureTypes = type.fn.closure;
            // const fnPtr = this.builder.createExtractValue(arg, 0);
            const closure = this.builder.createExtractValue(arg, 1);

            createPrintString("fn[");
            for (const index of Iterator.natural(closureTypes.length)) {
              if (index > 0) createPrintString(", ");

              const value = this.builder.createExtractValue(closure, index);
              const valueType = closureTypes[index];
              const printItem = printTemplate(valueType);
              createClosureCall(printItem, [value]);
            }
            createPrintString("]");
            // createPrintString("](");
            // createPrintPointer(fnPtr);
            // createPrintString(")");

            break;
          }
          case typeof type === "object" && "tuple" in type: {
            const types = type.tuple;

            createPrintString("tuple(");
            for (const index of Iterator.natural(types.length)) {
              if (index > 0) createPrintString(", ");

              const value = this.builder.createExtractValue(arg, index);
              const valueType = types[index];
              const printInstance = printTemplate(valueType);

              createClosureCall(printInstance, [value]);
            }
            createPrintString(")");

            break;
          }
          case typeof type === "object" &&
            "pointer" in type &&
            typeof type.pointer === "object" &&
            "int" in type.pointer &&
            type.pointer.int === 8: {
            createPrintFmtValue("%s", arg);
            break;
          }
          case typeof type === "object" && "pointer" in type: {
            createPrintString("ptr");
            // createPrintString("ptr(");
            // createPrintPointer(arg);
            // createPrintString(")");
            break;
          }
          case type === "unknown": {
            createPrintString("unknown");
            break;
          }
          default: {
            console.log(type);
            unreachable("cant print by type");
          }
        }

        return arg;
      });
    };

    this.variables.set(names.get("print")!, () => printTemplate);
    this.variables.set(names.get("print_symbol")!, createPrintWrapper("print_symbol", "i64"));
    this.variables.set(names.get("lh_yield")!, wrap("lh_yield", ["ptr", "i64"], "i64"));
    this.variables.set(names.get("lh_handle")!, wrap("lh_handle", ["ptr", "i64", "ptr", "i64"], "i64"));
    this.variables.set(names.get("true")!, () => this.builder.createBool(true));
    this.variables.set(names.get("false")!, () => this.builder.createBool(false));
  }
}

const stringifyLLVMArgType = (type: LLVMType): string => {
  if (typeof type === "string") return type;
  if ("pointer" in type && type.structRet) return `ptr sret(${stringifyLLVMType(type.pointer)})`;
  return stringifyLLVMType(type);
};

const stringifyLLVMType = (type: LLVMType): string => {
  if (typeof type === "string") return type;
  if ("pointer" in type) {
    if (type.pointer === "ptr") return "ptr";
    return `${stringifyLLVMType(type.pointer)}*`;
  }
  if ("record" in type) return `{ ${type.record.map(stringifyLLVMType).join(", ")} }`;
  return `${type.returnType} (${type.args.map(stringifyLLVMType).join(", ")})`;
};

const stringifyPhysicalType = (type: PhysicalType): string => {
  if (typeof type === "string") return type;
  if ("int" in type) return `i${type.int}`;
  if ("float" in type) return `f${type.float}`;
  if ("pointer" in type) return `${stringifyPhysicalType(type.pointer)}*`;
  if ("array" in type) return `${stringifyPhysicalType(type.array)}[${type.length}]`;
  if ("tuple" in type) return `(${type.tuple.map(stringifyPhysicalType).join(", ")})`;
  if ("fn" in type) {
    const ret = stringifyPhysicalType(type.fn.ret);
    const closure = type.fn.closure.map(stringifyPhysicalType).join(", ");
    const args = type.fn.args.map(stringifyPhysicalType).join(", ");
    return `${ret}[${closure}](${args})`;
  }

  unreachable("cant stringify physical type");
};

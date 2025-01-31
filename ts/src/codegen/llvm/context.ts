import { Iterator } from "iterator-js";
import { assert, nextId, unreachable } from "../../utils";
import { isLargePhysicalType, PhysicalType, physicalTypeSize } from "../../analysis/types/utils";

export type LLVMModule = {
  globals: LLVMGlobal[];
  functions: LLVMFunction[];
};

type LLVMGlobal = {
  attributes: string[];
  name: string;
  type: LLVMType;
  value: LLVMValue;
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
export type LLVMType =
  | string
  | { args: LLVMType[]; returnType: LLVMType }
  | { pointer: LLVMType; structRet?: boolean }
  | { record: LLVMType[] };

class Builder {
  functionIndex: number = 0;
  blockIndex: number = 0;
  instructionIndex: number = 0;
  values: Map<string, LLVMValue> = new Map();
  types: Map<string, LLVMType> = new Map();

  constructor(private context: Context) {}

  getTypeString(type: LLVMType): string {
    return stringifyLLVMType(type);
  }

  toLLVMType(type: PhysicalType): LLVMType {
    if (type === "void") return "void";
    if (type === "unknown") return "undef";
    if ("int" in type) return this.createIntType(type.int);
    if ("float" in type) return this.createFloatType(type.float);

    if ("fn" in type) {
      const fnArgs = type.fn.args.map((type) => this.toLLVMType(type));
      const closure = type.fn.closure.map((type) => this.toLLVMType(type));
      const LLVMReturnType = this.toLLVMType(type.fn.return);
      // const isLargeReturnType = isLargePhysicalType(type.fn.return);
      // const returnType = isLargeReturnType ? "void" : LLVMReturnType;
      // const closureArgs = closure.length > 0 ? [this.createRecordType(closure)] : [];
      // const args = isLargeReturnType
      //   ? [{ pointer: LLVMReturnType, structRet: true }, ...closureArgs, ...fnArgs]
      //   : [...closureArgs, ...fnArgs];
      const returnType = "void";
      const args = [{ pointer: LLVMReturnType, structRet: true }, this.createRecordType(closure), ...fnArgs];

      const closureType = this.createRecordType(closure);
      const fnType = this.createFunctionType(args, returnType);
      return this.createRecordType([closureType, { pointer: fnType }]);
    }
    if ("atom" in type) return this.createIntType(32);

    unreachable("cant convert physical type to LLVM type");
  }

  compareTypes(a: LLVMType, b: LLVMType): boolean {
    return this.getTypeString(a) === this.getTypeString(b);
  }

  getType(value: LLVMValue): LLVMType {
    const _type = this.types.get(value);
    if (!_type) return "i32";
    assert(_type);
    return _type;
  }

  getFreshName(prefix = ""): string {
    return prefix + nextId().toString();
  }

  getOrCreateConstant(value: LLVMValue, type: LLVMType): LLVMValue {
    const _value = this.values.get(value);
    if (_value) return _value;
    const name = this.getFreshName("const_");
    this.context.module.globals.push({ name, attributes: ["constant"], type, value });
    const __value = `@${name}`;
    this.values.set(value, __value);
    this.types.set(__value, { pointer: type });
    return __value;
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
    return this.getOrCreateConstant(String(value), this.createIntType(size));
  }

  createFloat(value: number, size: number): LLVMValue {
    return this.getOrCreateConstant(String(value), this.createFloatType(size));
  }

  createBool(value: boolean): LLVMValue {
    return this.createInt(value ? 1 : 0, 1);
  }

  createString(value: string): LLVMValue {
    const length = value.length + 1;
    return this.getOrCreateConstant(`c"${value}\\00"`, this.createConstantStringType(length));
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
    return "f" + size;
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
    return `[${length} x ${elementType}]`;
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

  createExtractValue(record: LLVMValue, index: number): LLVMValue {
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
    const args = callArgs.map((arg, i) => {
      if (argsType[i] === "...") return `${stringifyLLVMType(this.getType(arg))} ${arg}`;
      return `${stringifyLLVMType(argsType[i])} ${arg}`;
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

  createFunction(name: string, args: LLVMType[], body: (...args: LLVMValue[]) => LLVMType) {
    const exists = this.context.module.functions.some((f) => f.name === name);
    const value = `@${name}`;
    if (!exists) {
      const prevFunctionIndex = this.functionIndex;
      const functionIndex = this.context.module.functions.length;
      const argNames = args.map(() => "%" + this.getFreshName("var_"));
      const declarationArgs = argNames.map((name, i) => `${stringifyLLVMType(args[i])} ${name}`);
      const _f = { name, args: declarationArgs, returnType: "void" as LLVMType, body: [] };
      this.context.module.functions.push(_f);
      this.functionIndex = functionIndex;
      let returnType: LLVMType | undefined;
      this.createBlock("entry", () => {
        argNames.forEach((name, i) => {
          this.types.set(name, args[i]);
        });
        returnType = body(...argNames);
        argNames.forEach((name, i) => {
          this.types.delete(name);
        });
      });
      this.functionIndex = prevFunctionIndex;
      assert(returnType);
      _f.returnType = returnType;
      this.types.set(value, { pointer: { args, returnType } });
    }
    return value;
  }

  createBlock(name: string, body: () => void) {
    const prevBlockIndex = this.blockIndex;
    const prevInstructionIndex = this.instructionIndex;
    const functionBody = this.context.module.functions[this.functionIndex].body;
    assert(functionBody);
    const blockIndex = functionBody.length;
    functionBody.push({ name, instructions: [] });
    this.blockIndex = blockIndex;
    this.instructionIndex = 0;
    body();
    this.blockIndex = prevBlockIndex;
    this.instructionIndex = prevInstructionIndex;
    return name;
  }
}

export class Context {
  public module: LLVMModule;
  public builder: Builder;
  public variables: Map<number, LLVMValue> = new Map();

  constructor() {
    this.module = {
      globals: [],
      functions: [],
    };
    this.builder = new Builder(this);
  }

  moduleString(): string {
    let source = "";
    this.module.globals.forEach(({ name, attributes, type, value }) => {
      source += `${[`@${name}`, "=", attributes, stringifyLLVMType(type), value].join(" ")}\n`;
    });
    this.module.functions.forEach(({ name, args, returnType, body }) => {
      const sig = `${stringifyLLVMType(returnType)} @${name}(${args.map(stringifyLLVMType).join(", ")})`;
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
}

const stringifyLLVMType = (type: LLVMType): string => {
  if (typeof type === "string") return type;
  if ("pointer" in type && type.structRet) return `ptr sret(${stringifyLLVMType(type.pointer)})`;
  if ("pointer" in type) return `${stringifyLLVMType(type.pointer)}*`;
  if ("record" in type) return `{ ${type.record.map(stringifyLLVMType).join(", ")} }`;
  return `${type.returnType} (${type.args.map(stringifyLLVMType).join(", ")})`;
};

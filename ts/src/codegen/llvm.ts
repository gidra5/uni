import { Iterator } from "iterator-js";
import { NodeType, Tree } from "../ast.js";
import { assert, nextId, unreachable } from "../utils/index.js";

type LLVMModule = {
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
type LLVMValue = string;
type LLVMType = string | { args: LLVMType[]; returnType: LLVMType } | { pointer: LLVMType } | { record: LLVMType[] };

class Builder {
  functionIndex: number = 0;
  blockIndex: number = 0;
  values: Map<string, LLVMValue> = new Map();
  types: Map<string, LLVMType> = new Map();

  constructor(private context: Context) {}

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
    instructions.push(instruction);
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
    return this.getOrCreateConstant(`c"${value}\\00"`, this.createStringType(length));
  }

  createRecord(record: LLVMValue[]): LLVMValue {
    const type = this.createRecordType(record.map((value) => this.getType(value)));
    const location = this.createAlloca(type);
    const recordValue = this.createLoad(location);
    for (const [value, index] of Iterator.iter(record).enumerate()) {
      this.createInsertValue(recordValue, value, index);
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

  createStringType(length: number): LLVMType {
    return this.createArrayType(this.createIntType(8), length);
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

  createInstruction(name: string, args: LLVMValue[], twine = this.getFreshName("var_")): LLVMValue {
    this.insertInstruction({ name, args, twine });
    return `%${twine}`;
  }

  createExtractValue(record: LLVMValue, index: number): LLVMValue {
    return this.createInstruction("extractvalue", [
      `${stringifyLLVMType(this.getType(record))} ${record}`,
      index.toString(),
    ]);
  }

  createInsertValue(record: LLVMValue, value: LLVMValue, index: number): LLVMValue {
    return this.createInstruction("insertvalue", [
      `${stringifyLLVMType(this.getType(record))} ${record}`,
      `${stringifyLLVMType(this.getType(value))} ${value}`,
      index.toString(),
    ]);
  }

  createAlloca(type: LLVMType, initial?: LLVMValue): LLVMValue {
    const typeValue = stringifyLLVMType(type);
    return this.createInstruction("alloca", [typeValue, `${typeValue} ${initial}`]);
  }

  createLoad(value: LLVMValue): LLVMValue {
    return this.createInstruction("load", [stringifyLLVMType(this.getType(value)), `ptr ${value}`]);
  }

  createStore(value: LLVMValue, location: LLVMValue) {
    this.createInstructionVoid("store", [`${stringifyLLVMType(this.getType(value))} ${value}`, `ptr ${location}`]);
  }

  createAdd(lhs: LLVMValue, rhs: LLVMValue): LLVMValue {
    const type = stringifyLLVMType(this.getType(lhs));
    return this.createInstruction("add", [`${type} ${lhs}`, rhs]);
  }

  createMul(lhs: LLVMValue, rhs: LLVMValue): LLVMValue {
    const type = stringifyLLVMType(this.getType(lhs));
    return this.createInstruction("mul", [`${type} ${lhs}`, rhs]);
  }

  createCallVoid(callee: LLVMValue, callArgs: LLVMValue[]) {
    const args = [`${callee}(${callArgs.join(", ")})`];
    return this.createInstructionVoid("call", args);
  }

  createCall(callee: LLVMValue, callArgs: LLVMValue[], returnType: LLVMType, argsType: LLVMType[]): LLVMValue {
    const args = callArgs.map((arg, i) => {
      // return `${this.getType(arg)} ${arg}`;
      if (argsType[i] === "...") return `${this.getType(arg)} ${arg}`;
      return `${stringifyLLVMType(argsType[i])} ${arg}`;
    });
    const type = stringifyLLVMType(returnType);
    const _args = [`${type} ${callee}(${args.join(", ")})`];
    const value = this.createInstruction("call", _args);
    this.types.set(value, returnType);
    return value;
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
      const _f = { name, args, returnType: "void" as LLVMType, body: [] };
      this.context.module.functions.push(_f);
      this.functionIndex = functionIndex;
      let returnType: LLVMType | undefined;
      this.createBlock("entry", () => {
        returnType = body(...args.map((_, i) => `%${i}`));
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
    const functionBody = this.context.module.functions[this.functionIndex].body;
    assert(functionBody);
    const blockIndex = functionBody.length;
    functionBody.push({ name, instructions: [] });
    this.blockIndex = blockIndex;
    body();
    this.blockIndex = prevBlockIndex;
    return name;
  }
}

class Context {
  public module: LLVMModule;
  public builder: Builder;
  public names: Map<string, LLVMValue> = new Map();

  constructor() {
    this.module = {
      globals: [],
      functions: [],
    };
    this.builder = new Builder(this);
  }
}

const codegen = (ast: Tree, context: Context): LLVMValue => {
  switch (ast.type) {
    case NodeType.NUMBER:
      if (Number.isInteger(ast.data.value)) return context.builder.createInt(ast.data.value, 32);
      else return context.builder.createFloat(ast.data.value, 32);
    case NodeType.STRING:
      return context.builder.createString(ast.data.value);
    case NodeType.TEMPLATE: {
      const values = ast.children.map((child) => codegen(child, context));
      return values.reduce((acc, value) => context.builder.createAdd(acc, value), values[0]);
    }
    case NodeType.ADD:
      return context.builder.createAdd(codegen(ast.children[0], context), codegen(ast.children[1], context));
    case NodeType.MULT:
      return context.builder.createMul(codegen(ast.children[0], context), codegen(ast.children[1], context));
    case NodeType.PARENS:
      return codegen(ast.children[0], context);
    case NodeType.NAME: {
      if (ast.data.value === "print") {
        const name = "printf";
        const printf = context.builder.declareFunction(name, [{ pointer: "i8" }, "..."], "i32");

        context.builder.createFunction("printInt", ["i32"], (arg1) => {
          const fmt = context.builder.createString("%i\n");
          const result = context.builder.createCall(printf, [fmt, arg1], "i32", [{ pointer: "i8" }, "..."]);
          context.builder.createReturn(`i32 ${result}`);
          return "i32";
        });

        return printf;
      }
      if (ast.data.value === "true") {
        return context.builder.createBool(true);
      }
      if (ast.data.value === "false") {
        return context.builder.createBool(false);
      }
      const name = context.names.get(ast.data.value);
      assert(name);
      return name;
    }
    case NodeType.DELIMITED_APPLICATION:
    case NodeType.APPLICATION: {
      let closure: LLVMValue | null = null;
      let func = codegen(ast.children[0], context);
      let arg = codegen(ast.children[1], context);
      let argType = context.builder.getType(arg);
      let funcType = context.builder.getType(func);

      if (typeof funcType === "object" && "record" in funcType) {
        closure = context.builder.createExtractValue(func, 0);
        func = context.builder.createExtractValue(func, 1);
        funcType = funcType.record[1];
      }

      assert(typeof funcType === "object");
      assert("pointer" in funcType);
      funcType = funcType.pointer;

      assert(typeof funcType === "object");
      assert("args" in funcType);

      if (stringifyLLVMType(argType) !== stringifyLLVMType(funcType.args[0])) {
        if (typeof argType === "object" && "pointer" in argType) {
          argType = argType.pointer;
          if (stringifyLLVMType(argType) === stringifyLLVMType(funcType.args[0])) {
            arg = context.builder.createInstruction("load", [
              stringifyLLVMType(argType),
              `${stringifyLLVMType(argType)}* ${arg}`,
            ]);
          }
          // else {
          //   arg = context.builder.createInstruction("getelementptr", [
          //     stringifyLLVMType(pointerType),
          //     `${stringifyLLVMType(pointerType)}* ${arg}`,
          //     "i64 0",
          //     "i64 0",
          //   ]);
          // }
        }
      }

      if (ast.children[0].type === NodeType.NAME && ast.children[0].data.value === "print") {
        if (argType === "i32") {
          func = "@printInt";
          funcType = context.builder.getType(func);
          assert(typeof funcType === "object");
          assert("pointer" in funcType);
          funcType = funcType.pointer;

          assert(typeof funcType === "object");
          assert("args" in funcType);
        }
      }

      if (closure) {
        return context.builder.createCall(func, [closure, arg], funcType.returnType, funcType.args);
      }
      return context.builder.createCall(func, [arg], funcType.returnType, funcType.args);
    }
    case NodeType.FUNCTION: {
      const name = context.builder.getFreshName("fn_");
      const binder = ast.children[0];
      assert(binder.type === NodeType.NAME);
      const argName = ast.children[0].data.value;

      const freeVars = collectFreeVars(ast);
      assert([...context.names.keys()].every((x) => freeVars.includes(x)));

      if (freeVars.length === 0) {
        return context.builder.createFunction(name, ["i32"], (arg1) => {
          context.names.set(argName, arg1);
          const result = codegen(ast.children[1], context);
          context.names.delete(argName);
          const type = context.builder.getType(result);
          const valueType = stringifyLLVMType(type);
          context.builder.createReturn(`${valueType} ${result}`);
          return type;
        });
      }

      const closure = context.builder.createRecord(freeVars.map((name) => context.names.get(name)!));
      const closureType = context.builder.getType(closure);
      const func = context.builder.createFunction(name, [closureType, "i32"], (closure, arg) => {
        const prev: LLVMValue[] = [];
        for (const [name, index] of Iterator.iter(freeVars).enumerate()) {
          const value = context.builder.createExtractValue(closure, index);
          prev.push(context.names.get(name)!);
          context.names.set(name, value);
        }
        context.names.set(argName, arg);
        const result = codegen(ast.children[1], context);
        context.names.delete(argName);
        for (const [name, index] of Iterator.iter(freeVars).enumerate()) {
          context.names.set(name, prev[index]);
        }
        const type = context.builder.getType(result);
        const valueType = stringifyLLVMType(type);
        context.builder.createReturn(`${valueType} ${result}`);
        return type;
      });

      return context.builder.createRecord([closure, func]);
    }
    case NodeType.SEQUENCE: {
      const last = ast.children[ast.children.length - 1];
      const beforeLast = ast.children.slice(0, -1);
      beforeLast.forEach((child) => codegen(child, context));
      return codegen(last, context);
    }
    case NodeType.SCRIPT:
      ast.children.forEach((child) => codegen(child, context));
      return context.builder.createReturn("i32 0");
    default:
      unreachable();
  }
};

const generateLLVMModule = (ast: Tree): LLVMModule => {
  const context = new Context();

  switch (ast.type) {
    case "script":
      context.module.functions.push({
        name: "main",
        args: [],
        returnType: "i32",
        body: [{ name: "main", instructions: [] }],
      });
      // console.dir(ast, { depth: null });
      codegen(ast, context);

      return context.module;
    case "module":
      context.module.functions.push({
        name: "main",
        args: ["i32 %0", "ptr %1"],
        returnType: "i32",
        body: [{ name: "main", instructions: [] }],
      });
      unreachable("todo");
      return context.module;
    default:
      unreachable("can generate LLVM modules only for scripts and modules");
  }
};

const stringifyLLVMType = (type: LLVMType): string => {
  if (typeof type === "string") return type;
  if ("pointer" in type) return `${stringifyLLVMType(type.pointer)}*`;
  if ("record" in type) return `{ ${type.record.map(stringifyLLVMType).join(", ")} }`;
  return `${type.returnType} (${type.args.map(stringifyLLVMType).join(", ")})`;
};

const stringifyLLVMModule = ({ globals, functions }: LLVMModule) => {
  let source = "";
  globals.forEach(({ name, attributes, type, value }) => {
    source += `${[`@${name}`, "=", attributes, stringifyLLVMType(type), value].join(" ")}\n`;
  });
  functions.forEach(({ name, args, returnType, body }) => {
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
};

export const generateLLVMCode = (ast: Tree) => {
  const module = generateLLVMModule(ast);
  return stringifyLLVMModule(module);
};

function collectFreeVars(ast: Tree): string[] {
  switch (ast.type) {
    case NodeType.NAME:
      return [ast.data.value];
    case NodeType.FUNCTION:
      const boundNames = collectBoundNames(ast.children[0]);
      const freeVars = collectFreeVars(ast.children[1]);
      return freeVars.filter((x) => !boundNames.includes(x));
    default:
      return ast.children.flatMap((child) => collectFreeVars(child));
  }
}

function collectBoundNames(ast: Tree): string[] {
  switch (ast.type) {
    case NodeType.NAME:
      return [ast.data.value];
    default:
      return ast.children.flatMap((child) => collectBoundNames(child));
  }
}

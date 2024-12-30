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
type LLVMType = string;

class Builder {
  functionIndex: number = 0;
  blockIndex: number = 0;
  values: Map<string, LLVMValue> = new Map();
  types: Map<string, LLVMType> = new Map();

  constructor(private context: Context) {}

  getType(value: LLVMValue): LLVMType {
    const _type = this.types.get(value);
    assert(_type);
    return _type;
  }

  getFreshName(prefix = ""): string {
    return prefix + nextId().toString();
  }

  getOrCreateConstant(value: string, type: LLVMType): LLVMValue {
    const _value = this.values.get(value);
    if (_value) return _value;
    const name = this.getFreshName("const_");
    this.context.module.globals.push({ name, attributes: ["constant"], type, value });
    const __value = `@${name}`;
    this.values.set(value, __value);
    this.types.set(__value, type);
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
      this.types.set(value, returnType);
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

  createInstructionVoid(name: string, args: LLVMValue[]) {
    this.insertInstruction({ name, args });
  }

  createInstruction(name: string, args: LLVMValue[], twine = this.getFreshName("var_")): LLVMValue {
    this.insertInstruction({ name, args, twine });
    return `%${twine}`;
  }

  createAdd(lhs: LLVMValue, rhs: LLVMValue): LLVMValue {
    return this.createInstruction("add", [lhs, rhs]);
  }

  createCallVoid(callee: LLVMValue, callArgs: LLVMValue[]) {
    const args = [`${callee}(${callArgs.join(", ")})`];
    return this.createInstructionVoid("call", args);
  }

  createCall(callee: LLVMValue, callArgs: LLVMValue[]): LLVMValue {
    const args = [`${callee}(${callArgs.join(", ")})`];
    return this.createInstruction("call", args);
  }

  createReturn(value: LLVMValue): LLVMValue {
    this.createInstructionVoid("ret", [value]);
    return "void";
  }

  createFunction(name: string, args: LLVMType[], returnType: LLVMType, body: () => LLVMValue) {
    const prevFunctionIndex = this.functionIndex;
    const functionIndex = this.context.module.functions.length;
    this.context.module.functions.push({ name, args, returnType, body: [] });
    this.functionIndex = functionIndex;
    const result = body();
    this.functionIndex = prevFunctionIndex;
    return result;
  }

  createBlock(name: string, body: () => LLVMValue) {
    const prevBlockIndex = this.blockIndex;
    const functionBody = this.context.module.functions[this.functionIndex].body;
    assert(functionBody);
    const blockIndex = functionBody.length;
    functionBody.push({ name, instructions: [] });
    this.blockIndex = blockIndex;
    const result = body();
    this.blockIndex = prevBlockIndex;
    return result;
  }
}

class Context {
  public module: LLVMModule;
  public builder: Builder;

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
    case NodeType.TEMPLATE:
      const values = ast.children.map((child) => codegen(child, context));
      return values.reduce((acc, value) => context.builder.createAdd(acc, value), values[0]);
    case NodeType.NAME:
      if (ast.data.value === "print") {
        const name = "puts";
        return context.builder.declareFunction(name, ["i8*"], "i32");
      }
      if (ast.data.value === "true") {
        return context.builder.createBool(true);
      }
      if (ast.data.value === "false") {
        return context.builder.createBool(false);
      }
      return "";
    case NodeType.APPLICATION:
      const callee = codegen(ast.children[0], context);
      const arg = codegen(ast.children[1], context);
      const argType = context.builder.getType(arg);
      const calleeType = context.builder.getType(callee);
      const casted = context.builder.createInstruction("getelementptr", [
        argType,
        `${argType}* ${arg}`,
        "i64 0",
        "i64 0",
      ]);
      return context.builder.createCall(`${calleeType} ${callee}`, [`i8* ${casted}`]);
    case NodeType.FUNCTION:
      return "";
    case NodeType.SEQUENCE:
      const last = ast.children[ast.children.length - 1];
      const beforeLast = ast.children.slice(0, -1);
      beforeLast.forEach((child) => codegen(child, context));
      return codegen(last, context);
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
      codegen(ast, context);
      // console.dir(ast, { depth: null });

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

const stringifyLLVMModule = ({ globals, functions }: LLVMModule) => {
  let source = "";
  globals.forEach(({ name, attributes, type, value }) => {
    source += `${[`@${name}`, "=", attributes, type, value].join(" ")}\n`;
  });
  functions.forEach(({ name, args, returnType, body }) => {
    if (!body) {
      source += `declare ${returnType} @${name}(${args.join(", ")})\n`;
      return;
    }
    source += `define ${returnType} @${name}(${args.join(", ")}) {\n`;
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

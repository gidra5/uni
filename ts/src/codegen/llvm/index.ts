import { Iterator } from "iterator-js";
import { NodeType, Tree } from "../../ast.js";
import { assert, unreachable } from "../../utils/index.js";
import { Context, LLVMValue } from "./context.js";
import { inject, Injectable } from "../../utils/injector.js";
import { PhysicalTypeSchema } from "../../analysis/types/infer.js";

const codegen = (ast: Tree, context: Context): LLVMValue => {
  switch (ast.type) {
    case NodeType.NUMBER:
      if (Number.isInteger(ast.data.value)) return context.builder.createInt(ast.data.value, 32);
      else return context.builder.createFloat(ast.data.value, 32);
    case NodeType.STRING:
      return context.builder.createString(ast.data.value);
    case NodeType.TEMPLATE: {
      const values = ast.children.map((child) => codegen(child, context));
      return values.reduce((acc, value) => context.builder.createAdd(acc, value));
    }
    case NodeType.DEREF: {
      const value = codegen(ast.children[0], context);
      const type = context.typeMap.get(ast.children[0].id)!;
      assert(typeof type === "object");
      assert("pointer" in type);
      return context.builder.createLoad(value);
    }
    case NodeType.TUPLE_SET: {
      const tuple = codegen(ast.children[0], context);
      // const key = codegen(ast.children[1], context);
      const value = codegen(ast.children[2], context);
      const tupleType = context.typeMap.get(ast.children[0].id)!;
      assert(typeof tupleType === "object");
      assert("tuple" in tupleType);
      const innerValues = tupleType.tuple.map((_, i) => context.builder.createExtractValue(tuple, i));
      return context.builder.createRecord([...innerValues, value]);
    }
    case NodeType.TUPLE_PUSH: {
      const tuple = codegen(ast.children[0], context);
      const value = codegen(ast.children[1], context);
      const tupleType = context.typeMap.get(ast.children[0].id)!;
      assert(typeof tupleType === "object");
      assert("tuple" in tupleType);
      const innerValues = tupleType.tuple.map((_, i) => context.builder.createExtractValue(tuple, i));
      return context.builder.createRecord([...innerValues, value]);
    }
    case NodeType.TUPLE: {
      const value = codegen(ast.children[0], context);
      return context.builder.createRecord([value]);
    }
    case NodeType.ADD: {
      const values = ast.children.map((child) => codegen(child, context));
      return values.reduce((acc, value) => context.builder.createAdd(acc, value));
    }
    case NodeType.MULT: {
      const values = ast.children.map((child) => codegen(child, context));
      return values.reduce((acc, value) => context.builder.createMul(acc, value));
    }
    case NodeType.NAME: {
      const variable = inject(Injectable.NodeToVariableMap).get(ast.id)!;
      const name = context.variables.get(variable);

      assert(name);
      const value = name();
      if (typeof value === "function") {
        const types = ast.data.types;
        return value(...types);
      }
      return value;
    }
    case NodeType.APPLICATION: {
      const func = codegen(ast.children[0], context);
      const args = ast.children.slice(1).map((arg) => codegen(arg, context));
      const fnPtr = context.builder.createExtractValue(func, 0);
      const closure = context.builder.createExtractValue(func, 1);

      const fnPtrType = context.builder.getType(fnPtr);
      assert(typeof fnPtrType === "object" && "pointer" in fnPtrType);
      const funcType = fnPtrType.pointer;
      assert(typeof funcType === "object" && "args" in funcType);

      return context.builder.createCall(fnPtr, [closure, ...args], funcType.returnType, funcType.args);
    }
    case NodeType.FUNCTION: {
      const body = ast.children[ast.children.length - 1];
      const name = context.builder.getFreshName("fn_");
      const type = context.typeMap.get(ast.id)!;
      assert(typeof type === "object" && "fn" in type);

      const freeVars = inject(Injectable.ClosureVariablesMap).get(ast.id)!;
      const boundVariables = inject(Injectable.BoundVariablesMap).get(body.id)!;
      const llvmType = context.builder.toLLVMType(type);
      const retType = context.builder.toLLVMType(type.fn.ret);
      assert(typeof llvmType === "object" && "record" in llvmType);
      // console.dir({ ast, type, llvmType }, { depth: null });

      const fnTypePtr = llvmType.record[0];
      assert(typeof fnTypePtr === "object" && "pointer" in fnTypePtr);
      const fnType = fnTypePtr.pointer;
      assert(typeof fnType === "object" && "args" in fnType);
      const argsType = fnType.args.slice(2);

      const closureValues = freeVars.map((name) => context.variables.get(name)!());
      assert(closureValues.every((value) => typeof value !== "function"));

      return context.builder.createClosure(name, argsType, closureValues, retType, (closure, ...args) => {
        for (const [name, value] of Iterator.zip(freeVars, closure)) {
          context.variables.set(name, () => value);
        }
        for (const [name, arg] of Iterator.zip(boundVariables, args)) {
          context.variables.set(name, () => arg);
        }

        const result = codegen(body, context);

        for (const name of boundVariables) context.variables.delete(name);
        for (const name of freeVars) context.variables.delete(name);
        return result;
      });
    }
    case NodeType.SEQUENCE: {
      const last = ast.children[ast.children.length - 1];
      const beforeLast = ast.children.slice(0, -1);
      beforeLast.forEach((child) => codegen(child, context));
      return codegen(last, context);
    }
    case NodeType.BLOCK: {
      return context.variablesBlock(() => codegen(ast.children[0], context));
    }
    case NodeType.ASSIGN:
    case NodeType.DECLARE: {
      const variable = inject(Injectable.NodeToVariableMap).get(ast.children[0].id)!;
      const value = codegen(ast.children[1], context);
      context.variables.set(variable, () => value);
      return value;
    }
    case NodeType.IF: {
      const condition = codegen(ast.children[0], context);
      if (ast.children[2]) {
        return context.builder.createIfElse(
          condition,
          () => codegen(ast.children[1], context),
          () => codegen(ast.children[2], context)
        );
      }
      return context.builder.createIf(condition, () => codegen(ast.children[1], context));
    }
    case NodeType.ATOM: {
      return context.builder.createSymbol(ast.data.name);
    }
    // case NodeType.INJECT: {
    //   const value = codegen(ast.children[0], context);
    //   const body = codegen(ast.children[1], context);
    // }
    case NodeType.SCRIPT: {
      ast.children.forEach((child) => codegen(child, context));
      return context.builder.createReturn("i32 0");
    }
    default:
      console.log(ast);

      unreachable();
  }
};

const generateLLVM = (ast: Tree, typeMap: PhysicalTypeSchema): Context => {
  const context = new Context(typeMap);

  switch (ast.type) {
    case "script":
      context.module.functions.push({
        name: "main",
        args: [],
        returnType: "i32",
        body: [{ name: "main", instructions: [] }],
      });
      // try {
      codegen(ast, context);
      // } catch (e) {
      //   console.log(e);
      // }

      return context;
    case "module":
      context.module.functions.push({
        name: "main",
        args: ["i32 %0", "ptr %1"],
        returnType: "i32",
        body: [{ name: "main", instructions: [] }],
      });
      unreachable("todo");
      return context;
    default:
      unreachable("can generate LLVM modules only for scripts and modules");
  }
};

export const generateLLVMCode = (ast: Tree, typeMap: PhysicalTypeSchema) => {
  const ctx = generateLLVM(ast, typeMap);
  ctx.generateSymbolTable();
  return ctx.moduleString();
};

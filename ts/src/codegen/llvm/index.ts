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
    case NodeType.ADD: {
      const values = ast.children.map((child) => codegen(child, context));
      return values.reduce((acc, value) => context.builder.createAdd(acc, value));
    }
    case NodeType.MULT: {
      const values = ast.children.map((child) => codegen(child, context));
      return values.reduce((acc, value) => context.builder.createMul(acc, value));
    }
    case NodeType.NAME: {
      if (ast.data.value === "print_symbol") {
        return context.wrapFnPointer("print_symbol", ["i64"], "i64");
      }
      if (ast.data.value === "print_float") {
        return context.wrapFnPointer("print_float", ["f64"], "f64");
      }
      if (ast.data.value === "print_string") {
        return context.wrapFnPointer("print_string", [{ pointer: "i8" }], { pointer: "i8" });
      }
      if (ast.data.value === "print_int") {
        return context.wrapFnPointer("print_int", ["i32"], "i32");
      }
      if (ast.data.value === "true") {
        return context.builder.createBool(true);
      }
      if (ast.data.value === "false") {
        return context.builder.createBool(false);
      }
      const variable = inject(Injectable.NodeToVariableMap).get(ast.id)!;
      const name = context.variables.get(variable);

      assert(name);
      return name;
    }
    case NodeType.DELIMITED_APPLICATION:
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
      const freeVars = inject(Injectable.ClosureVariablesMap).get(ast.id)!;
      const boundVariables = inject(Injectable.BoundVariablesMap).get(body.id)!;
      const llvmType = context.builder.toLLVMType(type);
      // console.dir({ ast, type, llvmType }, { depth: null });

      assert(typeof type === "object" && "fn" in type);
      assert(typeof llvmType === "object" && "record" in llvmType);

      const fnTypePtr = llvmType.record[0];
      assert(typeof fnTypePtr === "object" && "pointer" in fnTypePtr);
      const fnType = fnTypePtr.pointer;
      assert(typeof fnType === "object" && "args" in fnType);
      const argsType = fnType.args;

      const closure = context.builder.createRecord(freeVars.map((name) => context.variables.get(name)!));
      const func = context.builder.createFunction(name, argsType, (retValue, closure, ...args) => {
        for (const [name, index] of Iterator.iter(freeVars).enumerate()) {
          const value = context.builder.createExtractValue(closure, index);
          context.variables.set(name, value);
        }
        for (const [name, arg] of Iterator.iter(boundVariables).zip(args)) {
          context.variables.set(name, arg);
        }

        const result = codegen(body, context);

        for (const name of boundVariables) context.variables.delete(name);
        for (const name of freeVars) context.variables.delete(name);

        context.builder.createStore(result, retValue);
        context.builder.createReturn("void");
        return "void";
      });

      return context.builder.createRecord([func, closure]);
    }
    case NodeType.SEQUENCE: {
      const last = ast.children[ast.children.length - 1];
      const beforeLast = ast.children.slice(0, -1);
      beforeLast.forEach((child) => codegen(child, context));
      return codegen(last, context);
    }
    case NodeType.BLOCK: {
      const expr = ast.children[0];
      const currentVariables = [...context.variables.entries()];
      const result = codegen(expr, context);
      context.variables = new Map(currentVariables);
      return result;
    }
    case NodeType.ASSIGN:
    case NodeType.DECLARE: {
      const variable = inject(Injectable.NodeToVariableMap).get(ast.children[0].id)!;
      const value = codegen(ast.children[1], context);
      context.variables.set(variable, value);
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
    case NodeType.SCRIPT: {
      ast.children.forEach((child) => codegen(child, context));
      return context.builder.createReturn("i32 0");
    }
    default:
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
      // console.dir(ast, { depth: null });
      codegen(ast, context);

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

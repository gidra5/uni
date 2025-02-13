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
      if (ast.data.value === "print") {
        const printf = context.builder.declareFunction("printf", [{ pointer: "i8" }, "..."], "i32");
        const types = context.typeMap;
        const type = types.get(ast.id);

        assert(typeof type === "object");
        assert("fn" in type);
        assert(type.fn.args.length === 1);
        const arg = type.fn.args[0];
        if (typeof arg === "object" && "int" in arg) {
          const printInt = context.builder.createFunction(
            "printInt",
            [{ pointer: "i32", structRet: true }, "{ }", "i32"],
            (ret, _closure, arg1) => {
              const fmt = context.builder.createString("%i\n");
              const result = context.builder.createCall(printf, [fmt, arg1], "i32", [{ pointer: "i8" }, "..."]);

              context.builder.createStore(result, ret);
              context.builder.createReturn("void");
              return "void";
            }
          );
          return context.builder.createRecord([printInt, context.builder.createRecord([])]);
        }

        const printString = context.builder.createFunction(
          "printString",
          [{ pointer: "i32", structRet: true }, "{ }", "ptr"],
          (ret, _closure, arg1) => {
            const result = context.builder.createCall(printf, [arg1], "i32", [{ pointer: "i8" }, "..."]);

            context.builder.createStore(result, ret);
            context.builder.createReturn("void");
            return "void";
          }
        );

        return context.builder.createRecord([printString, context.builder.createRecord([])]);
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
    case NodeType.SCRIPT:
      ast.children.forEach((child) => codegen(child, context));
      return context.builder.createReturn("i32 0");
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
  return ctx.moduleString();
};

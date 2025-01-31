import { Iterator } from "iterator-js";
import { NodeType, Tree } from "../../ast.js";
import { assert, unreachable } from "../../utils/index.js";
import { Context, LLVMValue } from "./context.js";
import { inject, Injectable } from "../../utils/injector.js";

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
        const types = inject(Injectable.PhysicalTypeMap);
        const type = types.get(ast.id);

        assert(typeof type === "object");
        assert("fn" in type);
        assert(type.fn.args.length === 1);
        const arg = type.fn.args[0];
        if (typeof arg === "object" && "int" in arg) {
          const printInt = context.builder.createFunction(
            "printInt",
            [{ pointer: "i32", structRet: true }, "ptr", "i32"],
            (ret, _ptr, arg1) => {
              const fmt = context.builder.createString("%i\n");
              const result = context.builder.createCall(printf, [fmt, arg1], "i32", [{ pointer: "i8" }, "..."]);

              context.builder.createStore(result, ret);
              context.builder.createReturn("void");
              return "void";
            }
          );
          return context.builder.createRecord([printInt, "null"]);
        }

        const printString = context.builder.createFunction(
          "printString",
          [{ pointer: "i32", structRet: true }, "ptr", "ptr"],
          (ret, _ptr, arg1) => {
            const result = context.builder.createCall(printf, [arg1], "i32", [{ pointer: "i8" }, "..."]);

            context.builder.createStore(result, ret);
            context.builder.createReturn("void");
            return "void";
          }
        );

        return context.builder.createRecord([printString, "null"]);
      }
      if (ast.data.value === "true") {
        return context.builder.createBool(true);
      }
      if (ast.data.value === "false") {
        return context.builder.createBool(false);
      }
      const name = context.variables.get(ast.data.value);
      assert(name);
      return name;
    }
    case NodeType.DELIMITED_APPLICATION:
    case NodeType.APPLICATION: {
      const func = codegen(ast.children[0], context);
      const arg = codegen(ast.children[1], context);
      const fnPtr = context.builder.createExtractValue(func, 0);
      const closurePtr = context.builder.createExtractValue(func, 1);

      const fnPtrType = context.builder.getType(fnPtr);
      assert(typeof fnPtrType === "object" && "pointer" in fnPtrType);
      const funcType = fnPtrType.pointer;
      assert(typeof funcType === "object" && "args" in funcType);

      return context.builder.createCall(fnPtr, [closurePtr, arg], funcType.returnType, funcType.args);
    }
    case NodeType.FUNCTION: {
      const name = context.builder.getFreshName("fn_");
      const type = inject(Injectable.PhysicalTypeMap).get(ast.id)!;
      const freeVars = inject(Injectable.ClosureVariablesMap).get(ast.id)!;
      const boundVariables = inject(Injectable.BoundVariablesMap).get(ast.id)!;
      const llvmType = context.builder.toLLVMType(type);
      assert(typeof type === "object" && "fn" in type);
      assert(typeof llvmType === "object" && "record" in llvmType);

      const fnType = llvmType.record[1];
      assert(typeof fnType === "object" && "args" in fnType);
      const argsType = fnType.args;

      const closurePtr = context.builder.createMalloc({ tuple: type.fn.closure });
      const closure = context.builder.createRecord(freeVars.map((name) => context.variables.get(name)!));
      context.builder.createStore(closure, closurePtr);
      const func = context.builder.createFunction(name, argsType, (retValue, closurePtr, ...args) => {
        const closure = context.builder.createLoad(closurePtr);
        for (const [name, index] of Iterator.iter(freeVars).enumerate()) {
          const value = context.builder.createExtractValue(closure, index);
          context.variables.set(name, value);
        }
        for (const [name, arg] of Iterator.iter(boundVariables).zip(args)) {
          context.variables.set(name, arg);
        }

        const result = codegen(ast.children[1], context);

        for (const name of boundVariables) context.variables.delete(name);
        for (const name of freeVars) context.variables.delete(name);

        context.builder.createStore(result, retValue);
        context.builder.createReturn("void");
        return "void";
      });

      return context.builder.createRecord([func, closurePtr]);
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

const generateLLVM = (ast: Tree): Context => {
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

export const generateLLVMCode = (ast: Tree) => {
  const ctx = generateLLVM(ast);
  return ctx.moduleString();
};

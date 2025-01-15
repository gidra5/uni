import { Iterator } from "iterator-js";
import { NodeType, Tree } from "../../ast.js";
import { assert, unreachable } from "../../utils/index.js";
import { Context, LLVMType, LLVMValue } from "./context.js";

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

        assert(typeof ast.data.type === "object");
        assert("fn" in ast.data.type);
        if (ast.data.type.fn.arg === "int") {
          return context.builder.createFunction("printInt", ["i32"], (arg1) => {
            const fmt = context.builder.createString("%i\n");
            const result = context.builder.createCall(printf, [fmt, arg1], "i32", [{ pointer: "i8" }, "..."]);
            context.builder.createReturn(`i32 ${result}`);
            return "i32";
          });
        }

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
      let funcArgType: LLVMType;

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
      if (closure) {
        funcArgType =
          typeof funcType.args[0] === "object" && "structRet" in funcType.args[0] ? funcType.args[2] : funcType.args[1];
      } else {
        funcArgType =
          typeof funcType.args[0] === "object" && "structRet" in funcType.args[0] ? funcType.args[1] : funcType.args[0];
      }

      if (!context.builder.compareTypes(argType, funcArgType)) {
        if (typeof argType === "object" && "pointer" in argType) {
          if (context.builder.compareTypes(argType.pointer, funcArgType)) {
            argType = argType.pointer;
            arg = context.builder.createLoad(arg);
          }
        }
      }

      if (closure) {
        return context.builder.createCall(func, [closure, arg], funcType.returnType, funcType.args);
      }
      return context.builder.createCall(func, [arg], funcType.returnType, funcType.args);
    }
    case NodeType.FUNCTION: {
      const name = context.builder.getFreshName("fn_");
      const funcType = context.builder.toLLVMType(ast.data.type);
      assert(typeof funcType === "object");
      assert("args" in funcType);
      const argName = ast.children[0].data.value;

      const freeVars = collectFreeVars(ast);
      assert([...context.names.keys()].every((x) => freeVars.includes(x)));
      const argTypes: LLVMType[] = funcType.args;

      function x(result: LLVMValue) {
        const type = context.builder.getType(result);
        const funcIndex = context.builder.functionIndex;
        const funcDecl = context.module.functions[funcIndex];
        if (typeof type === "object" && "record" in type) {
          const retValue = "%" + context.builder.getFreshName("var_");
          context.builder.types.set(retValue, type);
          const valueType = context.builder.getTypeString(type);
          funcDecl.args.unshift(`ptr sret(${valueType}) ${retValue}`);
          argTypes.unshift({ pointer: type, structRet: true });
          context.builder.createStore(result, retValue);
          context.builder.createReturn("void");
          return "void";
        } else {
          const valueType = context.builder.getTypeString(type);
          context.builder.createReturn(`${valueType} ${result}`);
          return type;
        }
      }

      if (freeVars.length === 0) {
        return context.builder.createFunction(name, argTypes, (arg1) => {
          context.names.set(argName, arg1);
          const result = codegen(ast.children[1], context);
          context.names.delete(argName);
          return x(result);
        });
      }

      const closure = context.builder.createRecord(freeVars.map((name) => context.names.get(name)!));
      const closureType = context.builder.getType(closure);
      argTypes.unshift(closureType);
      const func = context.builder.createFunction(name, argTypes, (closure, arg) => {
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
        return x(result);
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

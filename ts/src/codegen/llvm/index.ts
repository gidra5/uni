import { Iterator } from "iterator-js";
import { NodeType, Tree } from "../../ast.js";
import { assert, unreachable } from "../../utils/index.js";
import { Context, LLVMValue } from "./context.js";
import { inject, Injectable } from "../../utils/injector.js";
import { PhysicalTypeSchema } from "../../analysis/types/infer.js";

const codegen = (ast: Tree, context: Context): LLVMValue => {
  switch (ast.type) {
    case NodeType.NUMBER:
      const type = context.typeMap.get(ast.id)!;
      const value = ast.data.value;
      assert(typeof type === "object");
      if ("int" in type) return context.builder.createInt(value, type.int);
      if ("float" in type) return context.builder.createFloat(value, type.float);
      unreachable("cant generate LLVM value");
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
      if (ast.data.ref) {
        return context.builder.createRecordRef([value]);
      }
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
      assert(variable !== undefined);
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

      // console.log(ast, type);

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

      const closureValues = freeVars.map((name) => {
        assert(name !== undefined);
        const x = context.variables.get(name);
        // console.log(name, x, context.variables);

        return x!();
      });
      assert(closureValues.every((value) => typeof value !== "function"));

      return context.builder.createClosure(name, argsType, closureValues, retType, (closure, ...args) => {
        for (const [name, value] of Iterator.zip(freeVars, closure)) {
          assert(name !== undefined);
          context.variables.set(name, () => value);
        }
        for (const [name, arg] of Iterator.zip(boundVariables, args)) {
          assert(name !== undefined);
          context.variables.set(name, () => arg);
        }

        const result = codegen(body, context);
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
      assert(variable !== undefined);
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
    case NodeType.INJECT: {
      const type = context.typeMap.get(ast.id)!;
      const llvmType = context.builder.toLLVMType(type);
      const fn = context.builder.createFunctionSRet("handleable_" + ast.id, [], llvmType, () =>
        codegen(ast.children[1], context)
      );
      const retHandler = context.builder.createFunction(
        "identity_ret_handler",
        ["i64", "i64"],
        "i64",
        (local, arg) => arg
      );

      const handlerSymbol = context.builder.createConstantSymbol("handler_" + ast.data.name);
      const action = context.builder.createConstantRecord(handlerSymbol, context.builder.createConstantInt(0, 64));
      const handlerFn = context.builder.createFunction(
        `handler_${ast.data.name}`,
        ["ptr", "i64", "i64"],
        "i64",
        (cont, local, arg) => {
          const closure = codegen(ast.children[0], context);
          return context.builder.createClosureCall(closure, [cont, local, arg]);
        }
      );
      const handlerActions = context.builder.createConstantArray(
        context.builder.createConstantRecord(context.builder.createConstantInt(7, 32), action, handlerFn),
        "zeroinitializer"
      );
      const handlerDefRef = context.builder.createRecordRef([
        handlerSymbol,
        "null",
        "null",
        retHandler,
        handlerActions,
      ]);
      const out = context.builder.createAlloca(llvmType);
      const _int = context.builder.createPtrToInt(out);
      const _handle = context.builder.declareFunction("lh_handle", ["ptr", "i64", "ptr", "i64"], "i64");
      context.builder.createCallVoid(
        _handle,
        [handlerDefRef, context.builder.createConstantInt(0, 64), fn, _int],
        ["ptr", "i64", "ptr", "i64"]
      );
      return context.builder.createLoad(out);
    }
    case NodeType.SCRIPT: {
      ast.children.forEach((child) => codegen(child, context));
      return context.builder.createReturn(context.builder.createConstantInt(0, 32));
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

import { beforeAll, beforeEach, describe, expect } from "vitest";
import { test } from "@fast-check/vitest";
import { generateLLVMCode } from "../src/codegen/llvm";
import { exec } from "child_process";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { globalResolvedNamesArray, PhysicalTypeSchema } from "../src/analysis/types/infer";
import { NodeType, Tree } from "../src/ast";
import { assert, nextId } from "../src/utils";
import { resolve } from "../src/analysis/scope";
import { PhysicalType } from "../src/analysis/types/utils";
import path from "path";

const _exec = async (command: string, input?: string) => {
  const cmd = exec(command);

  const stdout: any[] = [];
  const stderr: any[] = [];
  cmd.stdout?.on("data", (data) => stdout.push(data));
  cmd.stderr?.on("data", (data) => stderr.push(data));

  if (input) {
    cmd.stdin?.write(input);
    cmd.stdin?.end();
  }

  await new Promise((resolve) => cmd.on("exit", resolve));
  return { stdout, stderr };
};
const RUNTIME_PATH = path.resolve(__dirname, "../../runtime/");
const C_RUNTIME_PATH = RUNTIME_PATH + "/build/c-runtime.so";
const NV_RUNTIME_PATH = RUNTIME_PATH + "/build/nv-runtime.so";

beforeAll(async () => {
  await _exec(RUNTIME_PATH + "/compile-shared.sh");
});

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.NextId, globalResolvedNamesArray.length);
  register(Injectable.PositionMap, new Map());
  register(Injectable.TypeMap, new Map());
  register(Injectable.PhysicalTypeMap, new Map());
  register(Injectable.ClosureVariablesMap, new Map());
  register(Injectable.BoundVariablesMap, new Map());
  register(Injectable.NodeToVariableMap, new Map());
});

const build = async (compiled: string, out: string) => {
  return await _exec(
    `clang-18 -O3 ${C_RUNTIME_PATH} -x ir - -o ${out} -Wno-override-module`,
    // `clang-18 -O3 ${C_RUNTIME_PATH} ${NV_RUNTIME_PATH} -x ir - -o ${out} -Wno-override-module`,
    compiled
  );
};

const testCase = async (ast: Tree, typeSchema: PhysicalTypeSchema) => {
  resolve(ast, globalResolvedNamesArray);
  const compiled = generateLLVMCode(ast, typeSchema);
  expect.soft(compiled).toMatchSnapshot("compiled");

  const file = "./test";
  const compileOutput = await build(compiled, file);
  const runOutput = await _exec(file);
  await _exec(`rm ${file}`);

  const stdout = compileOutput.stdout.concat(runOutput.stdout);
  const stderr = compileOutput.stderr.concat(runOutput.stderr);

  // stderr.forEach((line) => console.log(line));
  // stdout.forEach((line) => console.log(line));

  expect(stdout).toMatchSnapshot("stdout");
  expect(stderr).toMatchSnapshot("stderr");
};

class Builder {
  private fnStack: { symbol: symbol; closure: Set<PhysicalType> }[] = [];
  constructor(public typeSchema = new Map<number, PhysicalType>()) {}

  node(nodeType: NodeType, type: PhysicalType, data: any, children: Tree[]): Tree {
    const id = nextId();
    this.typeSchema.set(id, type);
    return {
      type: nodeType,
      id,
      children,
      data,
    };
  }

  printInt() {
    return this.name(Builder.fnType([{ int: 32 }], { int: 32 }, []), "print_int");
  }

  printString() {
    return this.name(Builder.fnType([{ pointer: { int: 8 } }], { pointer: { int: 8 } }, []), "print_string");
  }

  printSymbol() {
    return this.name(Builder.fnType([{ int: 64 }], { int: 64 }, []), "print_symbol");
  }

  printBoolean() {
    return this.printInstance({ int: 1 });
  }

  printTuple(ast: Tree) {
    return this.print(ast);
  }

  printInstance(type: PhysicalType) {
    return this.templateName(Builder.fnType([type], type, []), "print", [type]);
  }

  print(ast: Tree) {
    const type: PhysicalType = this.typeSchema.get(ast.id)!;
    const fn = this.printInstance(type);
    return this.app(fn, ast);
  }

  declare(name: string, value: Tree) {
    const type = this.typeSchema.get(value.id)!;
    const nameNode = this.name(type, name);
    return this.node(NodeType.DECLARE, type, {}, [nameNode, value]);
  }

  assign(name: string, value: Tree) {
    const type = this.typeSchema.get(value.id)!;
    const nameNode = this.name(type, name);
    return this.node(NodeType.ASSIGN, type, {}, [nameNode, value]);
  }

  script(...children: Tree[]) {
    const last = children[children.length - 1];
    const type = this.typeSchema.get(last.id)!;
    return this.node(NodeType.SCRIPT, type, {}, children);
  }

  sequence(...children: Tree[]) {
    const last = children[children.length - 1];
    const type = this.typeSchema.get(last.id)!;
    return this.node(NodeType.SEQUENCE, type, {}, children);
  }

  block(...children: Tree[]) {
    const seq = this.sequence(...children);
    const type = this.typeSchema.get(seq.id)!;
    return this.node(NodeType.BLOCK, type, {}, [seq]);
  }

  if(condition: Tree, then: Tree, _else?: Tree) {
    const type = this.typeSchema.get(then.id)!;
    then = this.block(then);
    if (_else) _else = this.block(_else);
    if (_else) return this.node(NodeType.IF, type, {}, [condition, then, _else]);
    return this.node(NodeType.IF, type, {}, [condition, then]);
  }

  app(f: Tree, ...x: Tree[]) {
    const fType = this.typeSchema.get(f.id)!;
    assert(typeof fType === "object");
    assert("fn" in fType);
    return this.node(NodeType.APPLICATION, fType.fn.ret, {}, [f, ...x]);
  }

  fn(x: Tree[], f: (...args: (() => Tree)[]) => Tree) {
    const closure = new Set<PhysicalType>();
    const symbol = Symbol();
    const _args = x.map((arg) => () => {
      const type = this.typeSchema.get(arg.id)!;
      const index = this.fnStack.findIndex((s) => s.symbol === symbol);
      const closures = this.fnStack.slice(index + 1).map((s) => s.closure);
      for (const closure of closures) closure.add(type);
      return this.name(type, arg.data.value);
    });

    this.fnStack.push({ symbol, closure });
    const _f = f(..._args);
    this.fnStack.pop();

    const argsType = x.map((arg) => this.typeSchema.get(arg.id)!);
    const retType = this.typeSchema.get(_f.id)!;
    const type = Builder.fnType(argsType, retType, [...closure]);
    return this.node(NodeType.FUNCTION, type, {}, [...x, _f]);
  }

  templateName(type: PhysicalType, value: string, types: PhysicalType[]) {
    return this.node(NodeType.NAME, type, { value, types }, []);
  }

  name(type: PhysicalType, value: string) {
    return this.node(NodeType.NAME, type, { value }, []);
  }

  pointer(value: Tree) {
    const type = this.typeSchema.get(value.id)!;
    return this.node(NodeType.REF, { pointer: type }, {}, [value]);
  }

  symbol(value?: string) {
    if (!value) value = String(nextId());
    const name = `symbol_${value}`;
    return this.node(NodeType.ATOM, "symbol", { name }, []);
  }

  atom(value: string) {
    const name = `atom_${value}`;
    return this.node(NodeType.ATOM, "symbol", { name }, []);
  }

  unit() {
    return this.node(NodeType.ATOM, "symbol", { name: "unit" }, []);
  }

  int(value: number) {
    return this.node(NodeType.NUMBER, { int: 32 }, { value }, []);
  }

  float(value: number) {
    return this.node(NodeType.NUMBER, { float: 32 }, { value }, []);
  }

  string(value: string) {
    return this.node(NodeType.STRING, { pointer: { int: 8 } }, { value }, []);
  }

  bool(value: boolean) {
    return this.name({ int: 1 }, value ? "true" : "false");
  }

  tuplePush(tuple: Tree, value: Tree) {
    const tupleType = this.typeSchema.get(tuple.id)!;
    const valueType = this.typeSchema.get(value.id)!;
    assert(typeof tupleType === "object");
    assert("tuple" in tupleType);
    const type = { tuple: [...tupleType.tuple, valueType] };
    return this.node(NodeType.TUPLE_PUSH, type, {}, [tuple, value]);
  }

  tupleJoin(tuple1: Tree, tuple2: Tree) {
    const tuple1Type = this.typeSchema.get(tuple1.id)!;
    const tuple2Type = this.typeSchema.get(tuple2.id)!;
    assert(typeof tuple1Type === "object");
    assert("tuple" in tuple1Type);
    assert(typeof tuple2Type === "object");
    assert("tuple" in tuple2Type);
    const type = { tuple: [...tuple1Type.tuple, ...tuple2Type.tuple] };
    return this.node(NodeType.TUPLE_JOIN, type, {}, [tuple1, tuple2]);
  }

  tuple(...args: Tree[]) {
    const argTypes = args.map((node) => this.typeSchema.get(node.id)!);
    let tuple = this.node(NodeType.TUPLE, { tuple: [argTypes[0]] }, {}, [args[0]]);
    for (let i = 1; i < args.length; i++) {
      tuple = this.tuplePush(tuple, args[i]);
    }
    return tuple;
  }

  add(...args: Tree[]) {
    return this.node(NodeType.ADD, { int: 32 }, {}, args);
  }

  mult(...args: Tree[]) {
    return this.node(NodeType.MULT, { int: 32 }, {}, args);
  }

  static fnType(args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]): PhysicalType {
    return { fn: { args, ret: returnType, closure } };
  }
}

describe("simply typed lambda calc compilation", () => {
  test("either", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            app(
              app(
                fn([name({ int: 32 }, "x")], (x) =>
                  fn([name(fnType([{ int: 32 }], { int: 32 }, []), "m")], (m) =>
                    fn([name(fnType([{ int: 32 }], { int: 32 }, []), "n")], (n) => app(m(), x()))
                  )
                ),
                int(1)
              ),
              fn([name({ int: 32 }, "x")], (x) => x())
            ),
            fn([name({ int: 32 }, "x")], (x) => x())
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("either 2", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            fn(
              [
                name({ int: 32 }, "x"),
                name(fnType([{ int: 32 }], { int: 32 }, []), "m"),
                name(fnType([{ int: 32 }], { int: 32 }, []), "n"),
              ],
              (x, m, n) => app(m(), x())
            ),
            int(1),
            fn([name({ int: 32 }, "x")], (x) => x()),
            fn([name({ int: 32 }, "x")], (x) => x())
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("apply", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            app(
              fn([name(fnType([{ int: 32 }], { int: 32 }, []), "f")], (f) =>
                fn([name({ int: 32 }, "x")], (x) => app(f(), x()))
              ),
              fn([name({ int: 32 }, "x")], (x) => x())
            ),
            int(2)
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("church tuple", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            app(
              app(
                fn([name({ int: 32 }, "x")], (x) =>
                  fn([name({ int: 32 }, "y")], (y) =>
                    fn([name(fnType([{ int: 32 }], fnType([{ int: 32 }], { int: 32 }, [{ int: 32 }]), []), "m")], (m) =>
                      app(app(m(), x()), y())
                    )
                  )
                ),
                int(1)
              ),
              int(2)
            ),
            fn([name({ int: 32 }, "x")], (x) => fn([name({ int: 32 }, "y")], (y) => x()))
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("church tuple 2", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            fn(
              [
                name({ int: 32 }, "x"),
                name({ int: 32 }, "y"),
                name(fnType([{ int: 32 }, { int: 32 }], { int: 32 }, []), "m"),
              ],
              (x, y, m) => app(m(), x(), y())
            ),
            int(1),
            int(2),
            fn([name({ int: 32 }, "x")], (x) => x())
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("function closure", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const add = (...args: Tree[]) => builder.add(...args);
    const mult = (...args: Tree[]) => builder.mult(...args);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            app(
              fn([name({ int: 32 }, "x")], (x) => fn([name({ int: 32 }, "y")], (y) => add(y(), mult(int(2), x())))),
              int(1)
            ),
            int(2)
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("function multiple args", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const add = (...args: Tree[]) => builder.add(...args);
    const mult = (...args: Tree[]) => builder.mult(...args);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            fn([name({ int: 32 }, "x"), name({ int: 32 }, "y")], (x, y) => add(y(), mult(int(2), x()))),
            int(1),
            int(2)
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("function deep closure", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const add = (...args: Tree[]) => builder.add(...args);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            app(
              app(
                fn([name({ int: 32 }, "x")], (x) =>
                  fn([name({ int: 32 }, "y")], (y) => fn([name({ int: 32 }, "z")], (z) => add(x(), add(y(), z()))))
                ),
                int(1)
              ),
              int(3)
            ),
            int(5)
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("function application and literal print", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const add = (...args: Tree[]) => builder.add(...args);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          app(
            fn([name({ int: 32 }, "x")], (x) => add(x(), x())),
            int(2)
          )
        )
      ),
      builder.typeSchema
    );
  });

  test("print number", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const int = (value: number) => builder.int(value);

    await testCase(builder.script(app(builder.printInt(), int(1))), builder.typeSchema);
  });

  test("hello world", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const string = (value: string) => builder.string(value);

    await testCase(builder.script(app(builder.printString(), string("hello world!"))), builder.typeSchema);
  });

  test("hello world string", async () => {
    const builder = new Builder();
    const string = (value: string) => builder.string(value);

    await testCase(builder.script(string("hello world!")), builder.typeSchema);
  });
});

describe("structured programming compilation", () => {
  test("hello world twice", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const string = (value: string) => builder.string(value);

    await testCase(
      builder.script(
        app(builder.printString(), string("hello world!")),
        app(builder.printString(), string("hello world!"))
      ),
      builder.typeSchema
    );
  });

  test("two prints", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const string = (value: string) => builder.string(value);

    await testCase(
      builder.script(
        app(builder.printString(), string("hello world!")),
        app(builder.printString(), string("hello world 2!"))
      ),
      builder.typeSchema
    );
  });

  test("sequence", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const int = (value: number) => builder.int(value);
    const sequence = (...args: Tree[]) => builder.sequence(...args);

    await testCase(
      builder.script(app(builder.printInt(), sequence(int(123), int(234), int(345), int(456)))),
      builder.typeSchema
    );
  });

  test("block", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const int = (value: number) => builder.int(value);
    const block = (...args: Tree[]) => builder.block(...args);

    await testCase(
      builder.script(app(builder.printInt(), block(int(123), int(234), int(345), int(456)))),
      builder.typeSchema
    );
  });

  test("block variable declaration", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const declare = (name: string, value: Tree) => builder.declare(name, value);
    const int = (value: number) => builder.int(value);
    const block = (...args: Tree[]) => builder.block(...args);

    await testCase(
      builder.script(app(builder.printInt(), block(declare("x", int(123)), name({ int: 32 }, "x")))),
      builder.typeSchema
    );
  });

  test("block variable shadowing", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const declare = (name: string, value: Tree) => builder.declare(name, value);
    const int = (value: number) => builder.int(value);
    const block = (...args: Tree[]) => builder.block(...args);

    await testCase(
      builder.script(
        app(builder.printInt(), block(declare("x", int(123)), declare("x", int(234)), name({ int: 32 }, "x")))
      ),
      builder.typeSchema
    );
  });

  test("block variable assingment", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const declare = (name: string, value: Tree) => builder.declare(name, value);
    const assign = (name: string, value: Tree) => builder.assign(name, value);
    const add = (lhs: Tree, rhs: Tree) => builder.add(lhs, rhs);
    const int = (value: number) => builder.int(value);
    const block = (...args: Tree[]) => builder.block(...args);

    await testCase(
      builder.script(
        app(
          builder.printInt(),
          block(declare("x", int(123)), assign("x", add(name({ int: 32 }, "x"), int(1))), name({ int: 32 }, "x"))
        )
      ),
      builder.typeSchema
    );
  });

  test("if-then", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const int = (value: number) => builder.int(value);
    const _true = () => builder.name({ int: 1 }, "true");
    const _if = (condition: Tree, then: Tree, _else?: Tree) => builder.if(condition, then, _else);

    await testCase(builder.script(app(builder.printInt(), _if(_true(), int(123)))), builder.typeSchema);
  });

  test("if-then-else", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const int = (value: number) => builder.int(value);
    const _false = () => builder.name({ int: 1 }, "false");
    const _if = (condition: Tree, then: Tree, _else?: Tree) => builder.if(condition, then, _else);

    await testCase(builder.script(app(builder.printInt(), _if(_false(), int(123), int(456)))), builder.typeSchema);
  });
});

describe("data structures compilation", () => {
  test("unit", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const _unit = () => builder.unit();

    await testCase(builder.script(app(builder.printSymbol(), _unit())), builder.typeSchema);
  });

  test("atom (global symbol)", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const atom = (name: string) => builder.atom(name);

    await testCase(builder.script(app(builder.printSymbol(), atom("a"))), builder.typeSchema);
  });

  test("symbol", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const symbol = (name: string) => builder.symbol(name);

    await testCase(builder.script(app(builder.printSymbol(), symbol("ab"))), builder.typeSchema);
  });

  test("boolean true", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);

    await testCase(builder.script(app(builder.printBoolean(), builder.bool(true))), builder.typeSchema);
  });

  test("boolean false", async () => {
    const builder = new Builder();
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);

    await testCase(builder.script(app(builder.printBoolean(), builder.bool(false))), builder.typeSchema);
  });

  test("tuple", async () => {
    const builder = new Builder();
    const tuple = (...args: Tree[]) => builder.tuple(...args);
    const int = (value: number) => builder.int(value);
    const string = (value: string) => builder.string(value);

    await testCase(builder.script(builder.printTuple(tuple(int(1), string("ab")))), builder.typeSchema);
  });

  // test.only("fn print", async () => {
  //   const builder = new Builder();
  //   const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);

  //   const tupleAst = tuple(int(1), string("ab"));
  //   await testCase(builder.script(app(builder.printTuple(), tupleAst)), builder.typeSchema);
  // });

  // it("channel", async () => {
  //   const input = `channel "name"`;
  //   const result = await evaluate(input);
  //   expect(isChannel(result)).toBe(true);
  // });

  // it("record", async () => {
  //   const input = `a: 1, b: 2`;
  //   const result = await evaluate(input);
  //   expect(result).toStrictEqual(createRecord({ a: 1, b: 2 }));
  // });

  // it("dictionary", async () => {
  //   const input = `[1]: 2, [3]: 4`;
  //   const result = await evaluate(input);
  //   expect(result).toStrictEqual(
  //     createRecord([
  //       [1, 2],
  //       [3, 4],
  //     ])
  //   );
  // });

  // it("field access static", async () => {
  //   const input = `record := a: 1, b: 2; record.a`;
  //   const result = await evaluate(input);
  //   expect(result).toBe(1);
  // });

  // it("field access dynamic", async () => {
  //   const input = `map := "some string": 1, b: 2; map["some string"]`;
  //   const result = await evaluate(input);
  //   expect(result).toBe(1);
  // });
});

test("generic print", async () => {
  const builder = new Builder();
  const name = (type: PhysicalType, value: string) => builder.name(type, value);
  const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn(x, f);
  const tuple = (...args: Tree[]) => builder.tuple(...args);
  const int = (value: number) => builder.int(value);
  const float = (value: number) => builder.float(value);
  const string = (value: string) => builder.string(value);

  await testCase(
    builder.script(
      builder.print(fn([name({ int: 32 }, "x")], (x) => x())),
      builder.print(string("\n")),
      builder.print(
        builder.app(
          fn([name({ int: 32 }, "x")], (x) => fn([name({ int: 32 }, "y")], (y) => x())),
          int(1)
        )
      ),
      builder.print(string("\n")),
      builder.print(fn([name({ int: 32 }, "x"), name({ int: 32 }, "y")], (x, y) => x())),
      builder.print(string("\n")),
      builder.print(tuple(int(1), string("ab"))),
      builder.print(string("\n")),
      builder.print(int(1)),
      builder.print(string("\n")),
      builder.print(float(1.25)),
      builder.print(string("\n")),
      builder.print(string("ab")),
      builder.print(string("\n")),
      builder.print(builder.bool(true)),
      builder.print(string("\n")),
      builder.print(builder.bool(false)),
      builder.print(string("\n")),
      builder.print(builder.unit()),
      builder.print(string("\n")),
      builder.print(builder.atom("atom_a")),
      builder.print(string("\n")),
      builder.print(builder.symbol("symbol_a"))
      // builder.print(string("\n")),
      // builder.print(builder.pointer(builder.int(1)))
    ),
    builder.typeSchema
  );
});

// describe("process calc compilation", () => {
//   // test("channel send", () => testCase(`c <- 123`));
//   // test("channel receive", () => testCase(`<- c`));
//   // test("channel try send", () => testCase(`c <-? 123`));
//   // test("channel try receive", () => testCase(`<-? c`));
//   // test("try receive with assignment", () => testCase(`status := <-?numbers`));
//   // test("superposition value", () => testCase(`123 & 456`));
//   // test("parallel value", () => testCase(`123 | 456`));
//   // test("prefix parallel with code after", () => testCase(`| { };numbers := channel()`));
//   // test("parallel with channels", () => testCase(`c <- 123 | <- c`));
//   // test("select channels", () => testCase(`c1 + c2`));
//   // test("async", () => testCase(`async f x`));
//   // test("await", () => testCase(`await x + 1`));
// });

// describe("gpu kernel compilation", () => {
//   // test("channel send", () => testCase(`c <- 123`));
//   // test("channel receive", () => testCase(`<- c`));
//   // test("channel try send", () => testCase(`c <-? 123`));
//   // test("channel try receive", () => testCase(`<-? c`));
//   // test("try receive with assignment", () => testCase(`status := <-?numbers`));
//   // test("superposition value", () => testCase(`123 & 456`));
//   // test("parallel value", () => testCase(`123 | 456`));
//   // test("prefix parallel with code after", () => testCase(`| { };numbers := channel()`));
//   // test("parallel with channels", () => testCase(`c <- 123 | <- c`));
//   // test("select channels", () => testCase(`c1 + c2`));
//   // test("async", () => testCase(`async f x`));
//   // test("await", () => testCase(`await x + 1`));
// });

// describe("effect handlers compilation", () => {});

// describe("macros compilation", () => {});

// describe("dependent types compilation", () => {});

// describe("modules compilation", () => {});

// // is type operator
// describe("reflection compilation", () => {});

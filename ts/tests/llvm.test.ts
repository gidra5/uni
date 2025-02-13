import { beforeEach, describe, expect } from "vitest";
import { test } from "@fast-check/vitest";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { parseScript } from "../src/parser/parser";
import { generateLLVMCode } from "../src/codegen/llvm";
import { exec } from "child_process";
import { Injectable, register } from "../src/utils/injector";
import { FileMap } from "codespan-napi";
import { globalResolvedNames, inferPhysical, inferTypes, PhysicalTypeSchema } from "../src/analysis/types/infer";
import { desugar } from "../src/analysis/desugar";
import dedent from "dedent";
import { NodeType, Tree } from "../src/ast";
import { assert, nextId } from "../src/utils";
import { resolve } from "../src/analysis/scope";
import { PhysicalType } from "../src/analysis/types/utils";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.NextId, 0);
  register(Injectable.PositionMap, new Map());
  register(Injectable.TypeMap, new Map());
  register(Injectable.PhysicalTypeMap, new Map());
  register(Injectable.ClosureVariablesMap, new Map());
  register(Injectable.BoundVariablesMap, new Map());
  register(Injectable.NodeToVariableMap, new Map());
});

const testCase = async (src: string) => {
  const tokens = parseTokenGroups(src);
  const ast = parseScript(tokens);
  const desugared = desugar(ast);
  // console.dir(desugared, { depth: null });

  const typeSchema = inferTypes(desugared);
  const physicalTypeSchema = inferPhysical(typeSchema);
  testCase2(desugared, physicalTypeSchema);
};

const testCase2 = async (ast: Tree, typeSchema: PhysicalTypeSchema) => {
  resolve(ast, globalResolvedNames);
  const compiled = generateLLVMCode(ast, typeSchema);
  expect(compiled).toMatchSnapshot("compiled");

  // const optimized: any[] = [];
  const stdout: any[] = [];
  const stderr: any[] = [];
  const interpreter = exec("lli-18");
  const optimizer = exec(`opt-18 -f -S -O3`);
  interpreter.stdout?.on("data", (data) => stdout.push(data));
  interpreter.stderr?.on("data", (data) => stderr.push(data));
  optimizer.stderr?.on("data", (data) => stderr.push(data));
  optimizer.stdout?.pipe(interpreter.stdin!);
  // optimizer.stdout?.on("data", (data) => optimized.push(data));
  optimizer.stdin?.write(compiled);
  optimizer.stdin?.end();

  await new Promise((resolve) => interpreter.on("exit", resolve));

  // expect(optimized.join("")).toMatchSnapshot("optimized");
  expect(stdout).toMatchSnapshot("stdout");
  expect(stderr).toMatchSnapshot("stderr");
};

describe.skip("compilation", () => {
  test.todo("either", async () => {
    await testCase(dedent`
      print(
        (
          (
            (
              fn (x: int) -> 
              fn (m: int -> int) -> 
              fn (n: int -> int) -> 
                m x
            )
            1
          )
          (fn (x: int) -> x)
        )
        (fn (x: int) -> x)
      )`);
  });

  test.todo("apply", async () => {
    await testCase(dedent`
      print(
        (
          (fn f -> fn x -> f x) fn x -> x
        ) 2
      )`);
  });

  test.todo("wrapper", async () => {
    await testCase(dedent`
      print(
        (
          (fn x -> fn m -> m x) 2
        ) fn x -> x
      )`);
  });

  test.todo("church tuple", async () => {
    await testCase(dedent`
      print(
        (
          (fn x -> fn y -> fn m -> m x y)
          1 2
        )
        fn x -> fn _ -> x
      )`);
  });

  test.todo("function closure", async () => await testCase(`print((fn x -> fn y -> y + 2 * x) 1 2)`));
  test.todo("function deep closure", async () => await testCase(`print((fn x -> fn y -> fn z -> x + y + z) 1 3 5)`));
  test.only("function application and literal print", async () => await testCase(`print((fn (x: int) -> x + x) 2)`));
  test("print number", async () => await testCase(`print 1`));
  test("hello world", async () => await testCase(`print "hello world!"`));
  test("hello world twice", async () => await testCase(`print "hello world!"; print "hello world!"`));
  test("two prints", async () => await testCase(`print "hello world!"; print "hello world 2!"`));
  test("hello world string", async () => await testCase(`"hello world!"`));
});

class Builder {
  s: { s: symbol; closure: Set<PhysicalType> }[] = [];
  constructor(public typeSchema: PhysicalTypeSchema) {}

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

  script(...children: Tree[]) {
    const last = children[children.length - 1];
    const type = this.typeSchema.get(last.id)!;
    return this.node(NodeType.SCRIPT, type, {}, children);
  }

  app(f: Tree, ...x: Tree[]) {
    const fType = this.typeSchema.get(f.id)!;
    assert(typeof fType === "object");
    assert("fn" in fType);
    return this.node(NodeType.APPLICATION, fType.fn.return, {}, [f, ...x]);
  }

  fn(closure: PhysicalType[], x: Tree, f: Tree) {
    const argType = this.typeSchema.get(x.id)!;
    let argsType: PhysicalType[] = [argType];
    if (typeof argType === "object" && "tuple" in argType) {
      argsType = argType.tuple;
    }
    const retType = this.typeSchema.get(f.id)!;
    const type = Builder.fnType(argsType, retType, closure);
    return this.node(NodeType.FUNCTION, type, {}, [x, f]);
  }

  fn2(x: Tree[], f: (...args: (() => Tree)[]) => Tree) {
    const arg = x.length === 1 ? x[0] : this.tuple(...x);
    const closure = new Set<PhysicalType>();
    const y = Symbol();
    const _args = x.map((arg) => () => {
      const type = this.typeSchema.get(arg.id)!;
      const index = this.s.findIndex((s) => s.s === y);
      const closures = this.s.slice(index + 1).map((s) => s.closure);
      for (const closure of closures) closure.add(type);
      return this.name(type, arg.data.value);
    });
    this.s.push({ s: y, closure });
    const _f = f(..._args);
    this.s.pop();
    return this.fn([...closure], arg, _f);
  }

  name(type: PhysicalType, value: string) {
    return this.node(NodeType.NAME, type, { value }, []);
  }

  int(value: number) {
    return this.node(NodeType.NUMBER, { int: 32 }, { value }, []);
  }

  string(value: string) {
    return this.node(NodeType.STRING, { array: { int: 8 }, length: value.length }, { value }, []);
  }

  tuple(...args: Tree[]) {
    return this.node(NodeType.TUPLE, { tuple: args.map((node) => this.typeSchema.get(node.id)!) }, {}, args);
  }

  add(...args: Tree[]) {
    return this.node(NodeType.ADD, { int: 32 }, {}, args);
  }

  mult(...args: Tree[]) {
    return this.node(NodeType.MULT, { int: 32 }, {}, args);
  }

  static fnType(args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) {
    return { fn: { args, return: returnType, closure } };
  }
}

describe.only("compilation 2", () => {
  test("either", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn2(x, f);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
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
      typeSchema
    );
  });

  test.todo("either 2", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (closure: PhysicalType[], x: Tree, f: Tree) => builder.fn(closure, x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const tuple = (...args: Tree[]) => builder.tuple(...args);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
          app(
            fn(
              [],
              tuple(
                name({ int: 32 }, "x"),
                name(fnType([{ int: 32 }], { int: 32 }, []), "m"),
                name(fnType([{ int: 32 }], { int: 32 }, []), "n")
              ),
              app(name(fnType([{ int: 32 }], { int: 32 }, []), "m"), name({ int: 32 }, "x"))
            ),
            int(1),
            fn([], name({ int: 32 }, "x"), name({ int: 32 }, "x")),
            fn([], name({ int: 32 }, "x"), name({ int: 32 }, "x"))
          )
        )
      ),
      typeSchema
    );
  });

  test("apply", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn2(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
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
      typeSchema
    );
  });

  test("church tuple", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn2(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
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
      typeSchema
    );
  });

  test.todo("church tuple 2", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (closure: PhysicalType[], x: Tree, f: Tree) => builder.fn(closure, x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);
    const tuple = (...args: Tree[]) => builder.tuple(...args);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
          app(
            fn(
              [],
              tuple(
                name({ int: 32 }, "x"),
                name({ int: 32 }, "y"),
                name(fnType([{ int: 32 }, { int: 32 }], { int: 32 }, []), "m")
              ),
              app(
                name(fnType([{ int: 32 }, { int: 32 }], { int: 32 }, []), "m"),
                name({ int: 32 }, "x"),
                name({ int: 32 }, "y")
              )
            ),
            int(1),
            int(2),
            fn([], name({ int: 32 }, "x"), name({ int: 32 }, "x"))
          )
        )
      ),
      typeSchema
    );
    // await testCase2(dedent`
    //   print(
    //     (
    //       (fn x -> fn y -> fn m -> m x y)
    //       1 2
    //     )
    //     fn x -> fn _ -> x
    //   )`);
  });

  test("function closure", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn2(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const add = (...args: Tree[]) => builder.add(...args);
    const mult = (...args: Tree[]) => builder.mult(...args);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
          app(
            app(
              fn([name({ int: 32 }, "x")], (x) => fn([name({ int: 32 }, "y")], (y) => add(y(), mult(int(2), x())))),
              int(1)
            ),
            int(2)
          )
        )
      ),
      typeSchema
    );
  });

  test.todo("function multiple args", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (closure: PhysicalType[], x: Tree, f: Tree) => builder.fn(closure, x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const add = (...args: Tree[]) => builder.add(...args);
    const mult = (...args: Tree[]) => builder.mult(...args);
    const tuple = (...args: Tree[]) => builder.tuple(...args);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
          app(
            fn(
              [],
              tuple(name({ int: 32 }, "x"), name({ int: 32 }, "y")),
              add(name({ int: 32 }, "y"), mult(int(2), name({ int: 32 }, "x")))
            ),
            int(1),
            int(2)
          )
        )
      ),
      typeSchema
    );
  });

  test("function deep closure", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn2(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const add = (...args: Tree[]) => builder.add(...args);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
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
      typeSchema
    );
  });

  test("function application and literal print", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const fn = (x: Tree[], f: (...args: (() => Tree)[]) => Tree) => builder.fn2(x, f);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);
    const add = (...args: Tree[]) => builder.add(...args);

    await testCase2(
      builder.script(
        app(
          name(fnType([{ int: 32 }], { int: 32 }, []), "print"),
          app(
            fn([name({ int: 32 }, "x")], (x) => add(x(), x())),
            int(2)
          )
        )
      ),
      typeSchema
    );
  });

  test("print number", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const int = (value: number) => builder.int(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(builder.script(app(name(fnType([{ int: 32 }], { int: 32 }, []), "print"), int(1))), typeSchema);
  });

  test("hello world", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const string = (value: string) => builder.string(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(name(fnType([{ pointer: { int: 8 } }], { pointer: { int: 8 } }, []), "print"), string("hello world!"))
      ),
      typeSchema
    );
  });

  test("hello world twice", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const string = (value: string) => builder.string(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(name(fnType([{ pointer: { int: 8 } }], { pointer: { int: 8 } }, []), "print"), string("hello world!")),
        app(name(fnType([{ pointer: { int: 8 } }], { pointer: { int: 8 } }, []), "print"), string("hello world!"))
      ),
      typeSchema
    );
  });

  test("two prints", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const app = (f: Tree, ...x: Tree[]) => builder.app(f, ...x);
    const name = (type: PhysicalType, value: string) => builder.name(type, value);
    const string = (value: string) => builder.string(value);
    const fnType = (args: PhysicalType[], returnType: PhysicalType, closure: PhysicalType[]) =>
      Builder.fnType(args, returnType, closure);

    await testCase2(
      builder.script(
        app(name(fnType([{ pointer: { int: 8 } }], { pointer: { int: 8 } }, []), "print"), string("hello world!")),
        app(name(fnType([{ pointer: { int: 8 } }], { pointer: { int: 8 } }, []), "print"), string("hello world 2!"))
      ),
      typeSchema
    );
  });

  test("hello world string", async () => {
    const typeSchema = new Map<number, PhysicalType>();
    const builder = new Builder(typeSchema);
    const string = (value: string) => builder.string(value);

    await testCase2(builder.script(string("hello world!")), typeSchema);
  });
});

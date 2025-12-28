import { beforeEach, describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";

import { parseTokenGroups } from "../src/parser/tokenGroups.ts";
import { parseModule, parseScript } from "../src/parser/parser.ts";
import { Injectable, register } from "../src/utils/injector.ts";
import { Tree } from "../src/ast.ts";
import { FileMap } from "codespan-napi";
import { validateTokenGroups } from "../src/analysis/validate.ts";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
});

it.todo.prop([fc.string().map(parseTokenGroups)])("module parsing never throws", (tokens) => {
  try {
    const [, validated] = validateTokenGroups(tokens);
    parseModule(validated);
  } catch (e) {
    const msg = e instanceof Error ? e.stack : e;
    expect.unreachable(msg as string);
  }
});

// TODO: fix these cases
// { seed: -1098499559, path: "19:15:15:14:21", endOnFailure: true }
// { seed: -1964660655, path: "11:2:11:11:12:11:17:25:15", endOnFailure: true }
it.prop([fc.string().map(parseTokenGroups)])("script parsing never throws", (tokens) => {
  try {
    const [, validated] = validateTokenGroups(tokens);
    parseScript(validated);
  } catch (e) {
    const msg = e instanceof Error ? e.stack : e;
    expect.unreachable(msg as string);
  }
});

it.prop([fc.string().map(parseTokenGroups)])("module is always flat sequence", (tokens) => {
  const [, validated] = validateTokenGroups(tokens);
  let ast = parseModule(validated);
  expect(ast.children.every((node) => (node as Tree).type !== "sequence")).toBe(true);
});

it.prop([fc.string().map(parseTokenGroups)])("script is always flat sequence", (tokens) => {
  const [, validated] = validateTokenGroups(tokens);
  let ast = parseScript(validated);
  expect(ast.children.every((node) => (node as Tree).type !== "sequence")).toBe(true);
});

function clearIds(ast: Tree) {
  if (ast.children.length > 0) {
    ast.children.forEach(clearIds);
  }
  delete (ast as any).id;
  return ast;
}

const testCase = (input: string) => {
  const tokens = parseTokenGroups(input);
  const [, validatedTokens] = validateTokenGroups(tokens);
  const ast = parseScript(validatedTokens);

  expect(clearIds(ast)).toMatchSnapshot();
};

const testCaseModule = (input: string) => {
  const tokens = parseTokenGroups(input);
  const [, validatedTokens] = validateTokenGroups(tokens);
  const ast = parseModule(validatedTokens);

  expect(clearIds(ast)).toMatchSnapshot();
};

describe("advent of code 1 single file", () => {
  it("variable", () =>
    testCase(`
      // https://adventofcode.com/2023/day/1

      /* take first and last digit on line, concat into two-digit number
        * and sum all numbers in document
        */
      document := """
        1abc2
        pqr3stu8vwx
        a1b2c3d4e5f
        treb7uchet
      """
    `));

  it("split lines", () =>
    testCase(`
        lines := {
          lines := split document "\\n"
          lines = (map lines) (replace "\\w+" "") 
          lines = filter lines fn line: line != ""
        }
      `));

  it("parse numbers", () =>
    testCase(`
        numbers := flat_map lines fn line {
          digits := ()
  
          while line != "" {
            if (char_at line 0).matchRegexp "\d" {
              digit := number(char_at line 0)
              if !digits[0]: digits[0] = digit
              digits[1] = digit
            }
            (_, ...line) = line
          }
  
          digits[0], digits[1] * 10
        }
      `));

  it("fn multiple args", () => testCase(`fn acc, item -> ()`));

  it("flat map list reducer", () => testCase(`fn acc, item -> (...acc, ...mapper item)`));

  it("flat map list impl", () =>
    testCase(`
        flat_map := fn list, mapper {
          (reduce list fn acc, item { (...acc, ...mapper item) } fn first, second { (...first, ...second) }) ()
        }
      `));

  it("reduce list", () =>
    testCase(`
        reduce := fn list, reducer, merge, initial {
          len := length list
          if len == 0: return initial
        
          midpoint := floor(len / 2)
          item := list[midpoint]
          first, second := all(
            | (reduce slice(list, 0, midpoint) reducer merge initial)
            | (reduce slice(list, midpoint + 1) reducer merge initial)
          )
        
          merge (reducer first item) second
        }
      `));
});

/* one test per example of a language construct  */

describe("expressions", () => {
  describe("values", () => {
    it("integer", () => testCase(`123`));
    it("float", () => testCase(`123.456`));
    it("string", () => testCase(`"string"`));
    it("string template", () => testCase(`"string \\(1) string"`));
    it("atom", () => testCase(`$atom`));
  });

  describe("arithmetics", () => {
    it("order of application", () => testCase(`1 + 2^-3 * 4 - 5 / 6 % 7`));
    it("-(a+b)", () => testCase(`-(a+b)`));

    it("complex", () => testCase(`(2^2-5+7)-(-i)+ (j)/0 - 1*(1*f)+(27-x )/q + send(-(2+7)/A,j, i, 127.0 ) + 1/1`));
  });

  describe("boolean expressions", () => {
    it("not", () => testCase(`!123`));
    it('"and", "or" and "not" associativity', () => testCase(`a and b and c or d or !e and f and g or not h or i`));
    it("in operator", () => testCase(`$key in x and y`));
    // it.todo("ranges 1", () => testCase(`123 < 456 < 789`));
  });

  // TODO: make parens around incoming arguments required
  describe("function expressions", () => {
    it("function block body", () => testCase(`fn x, y { x + y }`));
    it("function multiple params", () => testCase(`fn x, y -> x + y`));
    it("fn no parameters", () => testCase(`fn -> 123`));
    it("fn no parameters block", () => testCase(`fn { 123 }`));
    it("arrow function", () => testCase(`x -> x`));
    it("arrow function with parameter type", () => testCase(`x: number -> x`));
    it("fn increment", () => testCase(`fn -> line_handled_count++`));
    it("function with return type", () => testCase(`fn x, y -> number { x + y }`));
    // TODO: dilemma types
    // TODO: recursive functions shorthand for named functions
    it("function with parameter types", () => testCase(`fn (x: number, y: string) -> number { x + y }`));
    it.todo("named function", () => testCase(`fn sum(x: number, y: number) -> number { x + y }`));
    it("function with placeholder arg", () => testCase(`_ -> #0`));
    it("function with no arg", () => testCase(`fn -> #0`));
    it("function with shadowed name access", () => testCase(`fn a -> fn a -> #a`));
    it("function with deep shadowed name access", () => testCase(`fn a -> fn a -> fn a -> ##a`));
    it("function with named params from local scope expression", () => testCase(`%x + %y / %x`));
    it.todo("function with unnamed params from local scope expression", () => testCase(`%1 + %2 / %1`));
    it.todo("function with mixed params from local scope expression", () => testCase(`%1 + %x / %1`));

    describe("application", () => {
      it("function call", () => testCase(`f x`));
      it("function call multiple args", () => testCase(`f x y`));
      it("function call param with field", () => testCase(`f x.y`));
      it("send((1+2), 3)", () => testCase(`send((1+2), 3)`));
      it("send(2, 3)", () => testCase(`send(2, 3)`));
      it("(send)(2, 3)", () => testCase(`(send)(2, 3)`));
      it("(send 1)(2, 3)", () => testCase(`(send 1)(2, 3)`));
      it("(send 1 2)(2, 3)", () => testCase(`(send 1 2)(2, 3)`));
      it("send 1 + 2", () => testCase(`send 1 + 2`));
      it("a + send (2, 3)", () => testCase(`a + send (2, 3)`));
      it("send a (2, 3)", () => testCase(`send a (2, 3)`));
      it("send 1 (2, 3)", () => testCase(`send 1 (2, 3)`));
      it("a + send 1 + 2", () => testCase(`a + send 1 + 2`));
      it("methods chaining", () => testCase(`math.floor(1).multiply(2)`));
      it("function as last arg", () => testCase(`open "file" file -> write file "yolo"`));
      it("block as last arg", () => testCase(`open "file" { write "yolo" }`));
      it("pipe", () => testCase(`1 |> fn x { x + 1 } |> fn y { y * 2 }`));
    });

    describe("delimited application", () => {
      it("delimited args", () => testCase(`f(x, y)`));
      it("named args", () => testCase(`f(x: 1, 3, y: 2)`));
      it("placeholder arg", () => testCase(`f(_, y)`));
      it("placeholder args", () => testCase(`f(_, y, _)`));
      it("spread args", () => testCase(`f(...x, y)`));
    });

    describe("function forms", () => {
      it("immediate form", () => testCase(`fn: x; y`));
      it("block form", () => testCase(`fn { x }`));
      it("rest form", () => testCase(`fn -> x; y`));
    });
  });

  describe("macro expressions", () => {
    it.todo("macro block body", () => testCase(`macro (x, y), env { eval x env + eval y env }`));
    it.todo("macro multiple params", () => testCase(`macro (x, y), env -> eval x env + eval y env`));
    it.todo("macro block body no env", () => testCase(`macro (x, y) { eval x + eval y }`));
    it.todo("macro multiple params no env", () => testCase(`macro (x, y) -> eval x + eval y`));
    it.todo("macro no parameters", () => testCase(`macro -> 123`));
    it.todo("macro no parameters block", () => testCase(`macro { 123 }`));
    it.todo("macro with return type", () => testCase(`macro (x, y), env -> number { x + y }`));
    it.todo("macro with parameter types", () =>
      testCase(`macro (x: Expr<number>, y: Expr<string>), env: Env -> number { x + y }`)
    );
    it.todo("macro with no arg", () => testCase(`macro -> #0`));

    describe("function forms", () => {
      it.todo("immediate form", () => testCase(`macro: x; y`));
      it.todo("block form", () => testCase(`macro { x }`));
      it.todo("rest form", () => testCase(`macro -> x; y`));
    });

    // ast is transparent to parentheses
  });

  describe("annotations", () => {
    it.todo("annotate declaration", () => testCase(`x := macro (expr): eval expr`));
    it.todo("annotate expression", () => testCase(`@x 123`));
    it.todo("annotate expression with delimited args", () => testCase(`@x(1, 2) 123`));
    it.todo("annotate in composite expression", () => testCase(`@x(1, 2) 123 + 456`));
    it.todo("annotate whole composite expression", () => testCase(`@x(1, 2) (123 + 456)`));
  });

  describe("database expressions", () => {
    it.todo("empty database", () => testCase(`database {  }`));
    it.todo("query scope", () => testCase(`query db { x := select x from x }`));

    describe("transaction", () => {
      it.todo("basic", () => testCase(`transaction {  }`));
      it.todo("with abort", () => testCase(`transaction { throw 123 }`));
      it.todo("with commit", () => testCase(`transaction { return 123 }`));
    });

    describe("tables", () => {
      // https://www.postgresql.org/docs/current/ddl.html
      it.todo("declare type", () => testCase(`database { x := type { a: number, b: string } }`));
      it.todo("declare type with defaults", () => testCase(`database { x := type { a: number = 1, b: string } }`));
      it.todo("primary field", () => testCase(`database { x := type { primary id: number, b: string } }`));
      it.todo("generated field", () => testCase(`database { x := type { a: number, b = a + 1 } }`));
      // id is pointer value
      // ...
    });

    describe("query", () => {
      // https://www.postgresql.org/docs/current/sql-merge.html

      describe("select", () => {
        it.todo("basic", () => testCase(`query db select x from x`));
        it.todo("fields", () => testCase(`query db select x.a, x.b from x`));
        it.todo("expression", () => testCase(`query db select record { f: x.a + 1, g: x.b - 1 } from x`));
        it.todo("with where", () => testCase(`query db select x from x: Table where x.a = 1`));
        it.todo("with limit", () => testCase(`query db select x from x: Table limit 1`));
        it.todo("with order by", () => testCase(`query db select x from x: Table order by x.a`));
        it.todo("with order by with", () => testCase(`query db select * from x: Table order by x.a with f`));
        it.todo("with order by desc", () => testCase(`query db select * from x: Table order by x.a desc`));
        it.todo("with join", () => testCase(`query db select x from x: Table join y: Table`));
        it.todo("with join on", () => testCase(`query db select x from x: Table join y: Table on x.a = y.b`));

        // https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-AGGREGATES
        describe("aggregate", () => {
          it.todo("basic", () => testCase(`query db select aggregate count(x) from x: Table`));
          it.todo("where", () => testCase(`query db select aggregate array(x) where x < 10 from x: Table`));
          it.todo("distinct", () => testCase(`query db select aggregate array(distinct x) from x: Table`));
          it.todo("order by", () => testCase(`query db select aggregate array(x) order by x.a from x: Table`));
          it.todo("full", () =>
            testCase(`
              query db
                select
                  aggregate array(distinct x)
                  order by x.a
                  where x.b = 1
                from x: Table
            `)
          );
        });

        it.todo("with group by", () => testCase(`query db select x from x: Table group by x.a`));
        it.todo("with distinct", () => testCase(`query db select distinct x.a from x: Table`));
        it.todo("with distinct with", () => testCase(`query db select distinct x.a with f from x: Table`));

        // https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS
        describe("windowing", () => {
          it.todo("partition", () => testCase(`query db select count(x.a) over (partition by x.b) from x: Table`));
          it.todo("order by", () => testCase(`query db select count(x.a) over (order by x.c) from x: Table`));
          describe("frame", () => {
            it.todo("range", () => testCase(`query db select count(x.a) over (frame range current) from x: Table`));
            it.todo("rows", () => testCase(`query db select count(x.a) over (frame rows current) from x: Table`));
            it.todo("groups", () => testCase(`query db select count(x.a) over (frame groups current) from x: Table`));
            it.todo("range preceding", () =>
              testCase(`query db select count(x.a) over (frame range 1 preceding) from x: Table`)
            );
            it.todo("range following", () =>
              testCase(`query db select count(x.a) over (frame range 1 following) from x: Table`)
            );
            it.todo("range following unbounded", () =>
              testCase(`query db select count(x.a) over (frame range all following) from x: Table`)
            );
            it.todo("range between", () =>
              testCase(`query db select count(x.a) over (frame range between (1, 2)) from x: Table`)
            );
            it.todo("range exclude current", () =>
              testCase(`query db select count(x.a) over (frame range between (1, 2) exclude current) from x: Table`)
            );
            it.todo("range exclude group", () =>
              testCase(`query db select count(x.a) over (frame range between (1, 2) exclude group) from x: Table`)
            );
            it.todo("range exclude ties", () =>
              testCase(`query db select count(x.a) over (frame range between (1, 2) exclude ties) from x: Table`)
            );
          });
          it.todo("full", () =>
            testCase(`
              query db
                select
                  count(x.a) over (
                    partition by x.b
                    order by x.c
                    frame range
                      between (1, 2)
                      exclude ties
                    )
                from x: Table
            `)
          );
        });
      });

      describe("insert", () => {
        // insert generated field - derive source field through unification?
        it.todo("basic", () => testCase(`query db insert (a, b) into Table`));
        it.todo("insert multiple", () => testCase(`query db insert (a,b), (c,d) into Table`));
        it.todo("insert select", () => testCase(`query db insert select (a,b) from y: Table2 into Table`));
        it.todo("returning", () => testCase(`query db insert (a, b) into x: Table returning x`));
      });

      describe("delete", () => {
        it.todo("basic", () => testCase(`query db delete x: Table where x.a = 1`));
        it.todo("returning", () => testCase(`query db delete x: Table where x.a = 1 returning x`));
      });

      describe("update", () => {
        it.todo("basic", () => testCase(`query db update (x[0], x[1]+1) in x: Table where x[0] = 1`));
        it.todo("returning", () => testCase(`query db update (x[0], x[1]+1) in x: Table where x[0] = 1 returning x`));
        it.todo("returning old and new", () =>
          testCase(`query db update (x[0], x[1]+1) as new in x: Table returning (new, x)`)
        );
      });
    });

    describe("permissions", () => {
      // select, insert, update, delete
      // can be used instead of db in queries
      it.todo("grant select", () => testCase(`grant db for select from Table`));
      it.todo("grant insert", () => testCase(`grant db for insert into Table`));
      it.todo("grant update", () => testCase(`grant db for update on Table`));
      it.todo("grant delete", () => testCase(`grant db for delete from Table`));
      it.todo("grant where", () => testCase(`grant db for select from x: Table where x.a = 1`));
      it.todo("grant columns", () => testCase(`grant db for select from Table.a, Table.b`));
      it.todo("grant generic", () => testCase(`grant db for select`));
      it.todo("revoke", () => testCase(`revoke permission`));
      it.todo("and", () => testCase(`grant db for select from Table and grant db for insert into Table`));
      it.todo("or", () => testCase(`grant db for select from Table or grant db for insert into Table`));
      it.todo("not", () => testCase(`not grant db for insert into Table`));
    });

    describe("constraints", () => {
      // https://www.postgresql.org/docs/current/ddl-constraints.html
      it.todo("uniqueness", () =>
        testCase(`
            database { 
              Table := type { a: number, b: string }
              
              for x: Table not exists y: Table where x.a = y.a
            }
          `)
      );
      it.todo("foreign key", () =>
        testCase(`
            database { 
              Table1 := type { a: number, b: string }
              Table2 := type { a: number, b: string }
              
              for x: Table1 constrain exists y: Table2 where x.a = y.a
            }
          `)
      );

      // ?
      it.todo("foreign key on delete", () =>
        testCase(`
            database { 
              Table1 := type { a: number, b: string }
              Table2 := type { a: number, b: string }
              
              for x: Table1 constrain exists y: Table2 where x.a = y.a
              on delete cascade // restrict, no action, set default / on update
            }
          `)
      );

      it.todo("check", () =>
        testCase(`
            database { 
              Table := type { a: number, b: string }
              
              for x: Table constrain x.a > 0
            }
          `)
      );
      it.todo("check immediate", () =>
        testCase(`
            database { 
              Table := type { a: number, b: string }
              
              immediate for x: Table constrain x.a > 0
            }
          `)
      );
      it.todo("check two fields", () =>
        testCase(`
            database { 
              Table := type { a: number, b: string }
              
              for x: Table constrain x.a > x.b
            }
          `)
      );
    });

    describe("views", () => {
      // https://www.postgresql.org/docs/current/rules-views.html
      it.todo("basic", () =>
        testCase(`
            database { 
              Table := type { a: number, b: string }
              View := type { a: number, b: string }
              
              View { a, b } := select a, b from x: Table
            }
          `)
      );
    });
  });

  describe("logic programming", () => {
    describe("propositional logic", () => {
      // if we can express any boolean function, it is a propositional logic
      it.todo("and", () => testCase(`database { P := boolean; Q := boolean; p and q }`));
      it.todo("not", () => testCase(`database { P := boolean; Q := boolean; p and not q }`));
      it.todo("or", () => testCase(`database { P := boolean; Q := boolean; p or q }`));
      it.todo("implication", () => testCase(`database { P := boolean; Q := boolean; if p then q }`));
      it.todo("equivalence", () => testCase(`database { P := boolean; Q := boolean; p iff q }`));
    });

    describe("first order logic", () => {
      it.todo("predicate instance", () => testCase(`database { P := nominal number; P 1 }`));
      it.todo("existential over predicate instances", () =>
        testCase(`database { P := nominal number; exists x where P x = 1 }`)
      );
      it.todo("universal over predicate instances", () =>
        testCase(`database { P := nominal number; for x constrain P x }`)
      );
      it.todo("universal over predicate instances with implication", () =>
        testCase(`database { P := nominal number; Q := nominal number; for x constrain if P x then Q x }`)
      );
      it.todo("nested quantification", () =>
        testCase(`database { P := nominal number, number; for x constrain exists y where P(x, y) }`)
      );
      it.todo("quantified variable reuse", () =>
        testCase(`database { P := nominal number, number; for x constrain exists y where P(x, y) and P(y, x) }`)
      );
    });
    describe("higher order logic", () => {
      it.todo("higher order quantification", () => testCase(`database { exists P where for x constrain P x }`));
      it.todo("higher order types", () => testCase(`database { P := { a: number, b: Type }; }`));
      it.todo("universal over predicates", () => testCase(`database { for P constrain P 1 }`));
      it.todo("transitive relations", () =>
        testCase(`database { 
          for Edge if Transitive(Edge) then for x, y, z constrain
            if Edge(x, y) and Edge(y, z) then Edge(x, z)
        }`)
      );
      it.todo("transitive closure", () =>
        testCase(`database { 
            Reachable(x, y) := for P constrain
              for u, v constrain if Edge(u, v) then P(u, v)
              and if for u, v, w constrain P(u, v) and if P(v, w) then P(u, w) 
                then P(x, y)
          }`)
      );
    });

    describe("modal logic", () => {
      describe("least fixed point", () => {});
      describe("greatest fixed point", () => {});
      describe("Kripke modal logic", () => {});
      describe("temporal logic", () => {});
      describe("dynamic logic", () => {});
      describe("hybrid logic", () => {});
    });
    describe("substructural logic", () => {});
    describe("bayesian logic", () => {});
    describe("graded logic", () => {});
    describe("separation logic", () => {});
  });

  describe("state machine expressions", () => {
    it.todo("state machine", () => testCase(`state {}`));
    it.todo("state declaration", () => testCase(`state { a := nominal () }`));
    it.todo("parametric state declaration", () => testCase(`state { a := nominal number }`));
    it.todo("state transition", () =>
      testCase(`state {
        a := nominal ()
        b := nominal ()
        a -> b
      }`)
    );
    it.todo("nondet state transition", () =>
      testCase(`state {
        a := nominal ()
        b := nominal ()
        c := nominal ()
        a -> b
        a -> c
      }`)
    );
    it.todo("parametric state transition", () =>
      testCase(`state {
        a := nominal number
        b := nominal number
        a(x) -> b(x+1)
        a(1) -> b(0)
      }`)
    );
    it.todo("input state transition", () =>
      testCase(`state {
        a := nominal ()
        b := nominal number
        a with x -> b(x+1)
      }`)
    );

    // when transitioning into a nested state machine, it replaces the current state machine
    // until the linked state is reached
    // once it is reached, the nested instance is discarded and
    // the current state machine is resumed in the linked state
    it.todo("nested state machine", () =>
      testCase(`state {
        a := nominal ()
        b := nominal ()
        machine.a -> b
        a -> machine.b
      }`)
    );

    it.todo("initial state selection", () => testCase(`machine.a`));
    it.todo("state transition", () => testCase(`transition instance`));
    it.todo("state transition input", () => testCase(`transition instance with x`));

    it.todo("state inspection", () => testCase(`instance.current`));
    it.todo("state next transition", () => testCase(`<- instance.transition`));
  });

  describe("dataflow expressions", () => {
    it.todo("empty dataflow", () => testCase(`dataflow {  }`));
    it.todo("dataflow input", () => testCase(`dataflow { in x; f := x + 1 }`));
    it.todo("dataflow output", () => testCase(`dataflow { in x; out f := x + 1 }`));
    it.todo("dataflow signal", () => testCase(`dataflow { x := 1 }`));
    it.todo("dataflow derived", () => testCase(`dataflow { in x; f := x + 1 }`));
    it.todo("dataflow fan-out", () =>
      testCase(`dataflow { 
        in x
        out f := x + 1
        out g := x + 2
      }`)
    );
    it.todo("dataflow fan-in", () =>
      testCase(`dataflow { 
        in x, y
        out f := (x, y)
      }`)
    );
    it.todo("dataflow cyclic signals", () =>
      testCase(`dataflow { 
        x := !x
      }`)
    );
    it.todo("dataflow indirect cyclic signals", () =>
      testCase(`dataflow { 
        x := !y
        y := x
      }`)
    );
    it.todo("dataflow effect", () =>
      testCase(`dataflow { 
        out x := false
        { log x }
      }`)
    );
    it.todo("dataflow guarded cyclic effect", () =>
      testCase(`dataflow { 
        out x := false
        { if !x: x = true }
      }`)
    );
    it.todo("dataflow unguarded cyclic effect", () =>
      testCase(`dataflow { 
        out x := 0
        { x = x + 1; }
      }`)
    );
    it.todo("nested dataflow effect", () =>
      testCase(`dataflow { 
        out x := false
        { 
          nested := dataflow { 
            in x
            { if !x: x = true }
          }
          nested.x <- x
        }
      }`)
    );
    it.todo("nested dataflow effect cleanup", () =>
      testCase(`dataflow { 
        out x := false
        { 
          a := alloc 4;
          
          nested := dataflow { 
            in y
            { if !y: x = true }
          }
          nested.y <- x

          () -> free a
        }
      }`)
    );

    it.todo("dataflow pipe", () =>
      testCase(`
        dataflow { 
          in out x
          in out y

          x = 2 * y
        }
      `)
    );
  });

  describe("reactive programming", () => {
    it.todo("signal", () => testCase(`x := signal 1`));
    it.todo("derived", () => testCase(`x := derived { x + 1 }`));
    it.todo("watch", () => testCase(`watch { log x + 1 }`));
  });

  describe("folds", () => {
    it.todo("map", () => testCase(`for x in y { x + 1 }`));
    it.todo("filter", () => testCase(`for x in y { if x > 0: x + 1 }`));
    it.todo("reduce", () => testCase(`for x in y with acc { acc + x }`));

    it.todo("fold premap", () => testCase(`fold node in tree { v := node + 1; recurse node.child; v }`));
    it.todo("fold postmap", () => testCase(`fold node in tree { recurse node.child; node + 1 }`));
    it.todo("fold filter", () => testCase(`fold node in tree { if node > 0: node + 1 }`));
    it.todo("fold reduce", () => testCase(`fold node in tree with acc { acc + recurse node.child }`));

    // fn f(x) -> channel c { c <- x; c <<- f x+1 }
    it.todo("generator", () => testCase(`gen f(x) { yield x; yield* f x+1 }`));
    // fn f(x) -> channel c { c <- (f x+1, f x+2) }
    it.todo("unfold generator", () => testCase(`gen f(x) { yield (f x+1, f x+2) }`));
  });

  describe("structured programming", () => {
    it("complex 1", () =>
      testCase(`
        y := {
          x := 25
          loop if x < 0: break x else {
            y := x
            x = x - 1
            if y == 19: continue 69
            y
          }
        }
      `));

    it("if-then", () => testCase(`if true: 123`));
    it("if-then-else", () => testCase(`if true: 123 else 456`));
    it("if-then-elseif-then-else", () => testCase(`if true: 123 else if false: 789 else 456`));
    it("sequence", () => testCase(`123; 234; 345; 456`));
    it("block sequence", () => testCase(`{ 123; 234; 345; 456 }`));
    it("parens sequence", () => testCase(`(123; 234; 345; 456)`));
    it("block", () => testCase(`{ 123 }`));
    it("for loop", () => testCase(`for x in (1, 2, 3): x`));
    it("while loop", () => testCase(`while true: 123`));
    it("loop", () => testCase(`loop 123`));
    it("loop scope", () => testCase(`loop { x }`));
    it("labeled expression", () => testCase(`label::123`));
    it("semicolon at the end", () => testCase(`1;`));
    it("increment", () => testCase(`++x`));
    it("post increment", () => testCase(`x++`));
    it.todo("try operator", () => testCase(`try f()`));

    describe("statement forms", () => {
      it("immediate form", () => testCase(`if true: 123; 456`));
      it("block form", () => testCase(`if true { 123 }`));
      it("rest form", () => testCase(`if true -> 123; 456`));
    });
  });

  describe("concurrent programming", () => {
    it("channel send", () => testCase(`c <- 123`));
    it("channel receive", () => testCase(`<- c`));
    it("channel try send", () => testCase(`c <-? 123`));
    it("channel try receive", () => testCase(`<-? c`));
    // channel c { c <<- c2 } === c2
    // c <-<-! c2 === c <<- c2
    it.todo("channel forward", () => testCase(`c1 <<- c2`));
    // c <-> c2 === c <<- c2; c2 <<- c
    it.todo("channel link", () => testCase(`c1 <-> c2`));
    it("try receive with assignment", () => testCase(`status := <-?numbers`));
    // all have semantics like
    // (f | g) h = f h | g h
    // f (g | h) = f g | f h
    // but different for binary
    // (f | g) (h | i) = (f h) | (g i)
    // (f & g) (h & i) = (f h) & (f i) & (g h) & (g i)
    it("superposition (multiset product) value", () => testCase(`123 & 456`));
    it("parallel (SIMD vector) value", () => testCase(`123 | 456`));
    it("nondet race (multiset union) value", () => testCase(`123 ? 456`));
    it.todo("vectorize multiset value", () => testCase(`vector 123 & 456`));
    it.todo("race vector value", () => testCase(`race 123 | 456`));
    it.todo("collect parallel value", () => testCase(`collect 123 ? 456`));
    it("prefix parallel with code after", () => testCase(`| { };numbers := channel()`));
    it("parallel with channels", () => testCase(`c <- 123 | <- c`));
    it("sum of channels", () => testCase(`c1 + c2`));
    it.todo("channel swap", () => testCase(`c <-> 123`));
    it.todo("channel form 1", () => testCase(`channel c -> c <- 123; 234`));
    it.todo("channel form 2", () => testCase(`channel c: c <- 123; 234`));
    it.todo("channel form 3", () => testCase(`channel c { c <- 123; 234 }`));
    it.todo("shared channel", () =>
      testCase(`
        channel c {
          | { c <- 123; 234 }
          | { <- c; 345 }
        }`)
    );
    it.todo("select", () =>
      testCase(`
        choose { 
          c <- 123: x, 
          <- c as y: z 
        }`)
    );
    it.todo("channel choice", () => testCase(`match <- c { 1 -> 123, 2 -> 234 }`));

    // subscribe to any communication on the channel and fork new process/cc
    it.todo("channel replicated receive (subscribe)", () => testCase(`x := <-! c`));
    // send values continuously to the channel.
    // Forks new process/cc on each successful send, matching the subscriber's process
    // c now becomes private copy of the original channel?
    it.todo("channel replicated send (source events)", () => testCase(`c <-! 123`));

    it.todo("dispatch", () =>
      testCase(`dispatch 256, 16, 16 with id { data[id[0]][id[1]][id[2]] = data[id[0]][id[1]][id[2]] + 1 }`)
    );
    // handle each n-dimensional element x in list in parallel
    it.todo("dispatch list", () => testCase(`dispatch n for x in list { x + 1 }`));
    it.todo("dispatch swap", () =>
      testCase(`dispatch 256, 16, 16 with id { 
        data[id[0]][id[1]][id[2]] = swap (1, 0) id[0]
      }`)
    );

    it("async", () => testCase(`async f x`));
    it("async index", () => testCase(`async f.a`));
    it("await async", () => testCase(`await async f x`));
    it("await", () => testCase(`await x + 1`));
  });

  describe("data structures", () => {
    it("unit", () => testCase(`()`));
    it("tuple", () => testCase(`list, reducer, merge, initial`));
    it("record single", () => testCase(`record { a: 1 }`));
    it("record", () => testCase(`record { a: 1, b: 2 }`));
    it("record dynamic", () => testCase(`record { ["a"]: 1, b: 2 }`));
    it("(-(2+7)/A,j, i, 127.0 )", () => testCase(`(-(2+7)/A,j, i, 127.0 )`));
    it("period operator", () => testCase(`math.floor`));
    it("index", () => testCase(`x[0]`));
    it("field assignment", () => testCase(`x.y = 123`));
    it("field assignment dynamic", () => testCase(`x[y] = 123`));

    describe("optics", () => {});
  });

  describe("effect handlers", () => {
    it("inject", () => testCase(`inject record { a: 1, b: 2 } { 1 }`));
    it("mask", () => testCase(`mask $a, $b { 1 }`));
    it("without", () => testCase(`without $a, $b { 1 }`));
    it("complex", () =>
      testCase(`
        inject record { a: 1, b: 2 } ->
        { a, b } := handlers
         
        inject record { a: a+1, b: b+2 } ->
        mask $a ->
        without $b ->

        { a } := handlers
        a + 1
      `));
  });

  describe("first-class patterns", () => {
    it.todo("pattern value", () => testCase(`pattern x, xs, v: (x, ...xs) = v`));
    it.todo("pattern value binding access", () => testCase(`(pattern x, xs, v: (x, ...xs) = v),x`));
    it.todo("pattern elimination", () => testCase(`eliminate (pattern x, xs, v: (x, ...xs) = v).v (1, 2, 3)`));
    it.todo("pattern link", () =>
      testCase(`link (pattern x, xs, v: (x, ...xs) = v).v (pattern x, xs, v: (x, ...xs) = v).xs`)
    );
    it.todo("pattern link", () =>
      testCase(`link (pattern x, xs, v: (x, ...xs) = v).v (pattern x, xs, v: (x, ...xs) = v).xs`)
    );
    it.todo("pattern in function", () => testCase(`fn %pattern.v -> x + y`));
  });

  describe("first-class types", () => {
    it.todo("type value", () => testCase(`type number`));
  });
});

describe("pattern matching", () => {
  it("match", () => testCase(`match a { 1 -> 2; 2 -> 3; _ -> 4 }`));

  it("in function parameters", () => testCase(`(x, y) -> x + y`));
  it("declare record pattern", () => testCase(`{ a, b } := handlers`));
  it("with 'is' operator", () => testCase(`x is (a, b)`));
  it("with placeholder", () => testCase(`x is (_, b)`));
  it("with pin", () => testCase(`x is (^a, b)`));
  it("with pin expression", () => testCase(`x is (^(a + b), b)`));
  it("with constant value", () => testCase(`x is (1, b)`));
  it("with rest value", () => testCase(`x is (a, ...b)`));
  it("with rest value first", () => testCase(`x is (...b, a)`));
  it("with record pattern", () => testCase(`x is { a, b }`));
  it("with record pattern rename", () => testCase(`x is { a @ c, b }`));
  it("with record pattern key", () => testCase(`x is { [a + b] @ c, b }`));
  it("with record pattern nested", () => testCase(`x is { a @ (c, d), b }`));
  it("with default value", () => testCase(`x is (b = 4, a)`));
  it("with default value second", () => testCase(`x is (a, b = 4)`));
  it("with default value parens", () => testCase(`x is ((b = 4), a)`));
  it("with record default value", () => testCase(`x is { b = 4, a }`));
  it("with rename", () => testCase(`x is (a @ b, c)`));
  it("with name for match", () => testCase(`x is ((a, b) @ c)`));
  it("with like pattern", () => testCase(`x is like { a, b }`));
  it("with strict pattern", () => testCase(`x is like (a, strict { b })`));
  it("with nested value", () => testCase(`x is a.b and a.b == x`));
  it("with merging nested value", () => testCase(`x is (a.b and a.c) and a.b == x and a.c == x`));
  it("with dynamically nested value", () => testCase(`x is a[b] and a[b] == x`));
  it("with dynamic name", () => testCase(`x is [$a] and [$a] == x`));
  it("with matcher", () => testCase(`x is some(a)`));
  it.todo("with matcher 2", () => testCase(`x is some a and a == 1`));
  it("with parens matcher", () => testCase(`x is (some a)`));

  it("binding visible in scope where it is true", () => testCase(`x is (a, b) and a == b + 1`));

  describe("set-theoretic patterns", () => {
    test("pattern union", () => testCase(`({ x, y } or { y, z }) -> y`));
    test("pattern intersection", () => testCase(`({ x, y } and { z }) -> x + y + z`));
    test("pattern negation", () => testCase(`(not { x, y }) -> x + y + z`));
  });

  test.todo("with type", () => testCase(`x is a: number`));
  test("tuple pattern with type", () => testCase(`x is (a: number, b)`));
  test("record pattern with type", () => testCase(`x is { a: number, b }`));
  test("value is of type", () => testCase(`x is type number`));
});

describe("types", () => {
  it("declaration with type", () => testCase("x: number := 1"));
  it("typeof", () => testCase("typeof x"));
  it("typeof value is type", () => testCase(`typeof x == number`));
  it("type cast", () => testCase("x as number"));
  it("type coalesce", () => testCase("x :> number"));

  describe("functions", () => {
    it.todo("function type", () => testCase('x: (number -> string) := fn: "1"'));
    it.todo("function type with multiple args", () => testCase('x: fn number, string -> string := fn: "1"'));
    it.todo("function type with named args", () => testCase('x: fn (x: number, y: string) -> string := fn: "1"'));
    it.todo("parametric function type", () => testCase('x: fn (x: infer y) -> y or number := fn: "1"'));
  });
});

describe("programs", () => {
  it.todo("export declaration as", () => testCase(`export x as y := 123`));
  it.todo("export expr as", () => testCase(`export x+1 as y`));
  it.todo("external variable", () => testCase(`external y`));

  describe("import descriptor", () => {
    it.todo("import dependency", () => testCase(`import depName`));
    it.todo("import project absolute", () => testCase(`import /path/to/folder`));
    it.todo("import project relative", () => testCase(`import ./relative/path/to/folder`));
    it.todo("import project root", () => testCase(`import /`));
    it.todo("import project file", () => testCase(`import /path/to/file.extension`));
    it.todo("import project relative complex", () => testCase(`import ../relative/.././path/to/folder`));
    it.todo("import quotes", () => testCase(`import "../relative/.././path/to/folder"`));
    it.todo("import segment quotes", () => testCase(`import ../relative/.././"path"/to/folder`));
  });

  it("import", () => testCase(`import "a" as b`));
  it.todo("import with", () => testCase(`import a as b with x`));

  describe("script", () => {
    it("dynamic import", () => testCase(`b := import a`));
    it("dynamic async import", () => testCase(`b := async import a`));
    it.todo("dynamic import with", () => testCase(`b := import a with x`));
  });

  describe("module", () => {
    it("export declaration", () => testCaseModule(`export x := 123`));
    it("export default", () => testCaseModule(`export fn args -> 1`));
    // it.todo("operator", () => testCase(`operator _+_ := fn x, y -> x + y`));
    // it.todo("operator with precedence", () => testCase(`operator _+_ precedence 1 := fn x, y -> x + y`));
    // it.todo("operator with tuple precedence", () => testCase(`operator _+_ precedence 1, 2 := fn x, y -> x + y`));
    // it.todo("namespace", () => testCase(`namespace a { x := 123 }`));
  });
});

describe("newline handling", () => {
  it("for loop newline", () => testCase(`for x in 1, 2, 3:\n x`));
  it("parallel parens", () => testCase(`(\n| 1\n| 2\n)`));
  it("parallel", () => testCase(`| 1\n| 2`));
  it("chaining", () => testCase(`a\n.b`));
  it("parens", () => testCase(`(\n1 +\n2\n+ 3\n)`));
  it("no parens", () => testCase(`1 +\n2\n+ 3`));
  it("prefix", () => testCase(`!\na`));
  it("infix-prefix", () => testCase(`b :=\n !\na`));
  it("infix-infix", () => testCase(`b +\nc +\nd`));
  it("if else separate lines", () => testCase(`if a:\n 1\n else\n 2`));
  it("if-then newline", () => testCase(`if true:\n 123`));
  it("if-then newline-else", () => testCase(`if true:\n 123 else 456`));
  it("if-then newline-else newline", () => testCase(`if true:\n 123 else\n 456`));
  it("if-then post newline", () => testCase(`if true: 123\nelse 456`));
  it("if-then post newline block", () => testCase(`if true { 123 }\nelse 456`));
  it("block newline in the middle", () => testCase(`{ a := 1\n b := 2 }`));
  it("block newline at the end", () => testCase(`{ a := 1\n b := 2\n }`));
  it("block newline at the beginning", () => testCase(`{\n a := 1\n b := 2 }`));
  it("block semicolon newline", () => testCase(`{ a := 1;\n b := 2 }`));
  it("block semicolon newline at the end", () => testCase(`{ a := 1;\n b := 2;\n }`));
  it("newline at the end", () => testCase(`1\n`));
  it("semicolon-newline at the end", () => testCase(`1;\n`));
  it("empty switch with newline", () => testCase(`match a { \n }`));
  it.todo("application-newline-increment", () => testCase(`f a\n ++b`));
  it("pipe", () => testCase(`1 \n|> fn x { x + 1 } \n|> fn y { y * 2 }`));
});

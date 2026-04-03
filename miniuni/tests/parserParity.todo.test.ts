import { describe, it, test } from 'vitest';

const compact = (input: string) => input.replace(/\s+/g, ' ').trim();

describe('ts parser parity TODOs', () => {
  describe('parser invariants', () => {
    it.todo('module parsing never throws');
    it.todo('script parsing never throws');
    it.todo('module is always flat sequence');
    it.todo('script is always flat sequence');
    it.todo('application-newline-increment');
  });

  describe('function syntax gaps', () => {
    it.todo(
      `named function :: ${compact(
        `fn sum(x: number, y: number) -> number { x + y }`
      )}`
    );
    it.todo(
      `function with unnamed params from local scope expression :: ${compact(
        `%1 + %2 / %1`
      )}`
    );
    it.todo(
      `function with mixed params from local scope expression :: ${compact(
        `%1 + %x / %1`
      )}`
    );
  });

  describe('macro expressions', () => {
    it.todo(
      `macro block body :: ${compact(
        `macro (x, y), env { eval x env + eval y env }`
      )}`
    );
    it.todo(
      `macro multiple params :: ${compact(
        `macro (x, y), env -> eval x env + eval y env`
      )}`
    );
    it.todo(
      `macro block body no env :: ${compact(`macro (x, y) { eval x + eval y }`)}`
    );
    it.todo(
      `macro multiple params no env :: ${compact(
        `macro (x, y) -> eval x + eval y`
      )}`
    );
    it.todo(`macro no parameters :: ${compact(`macro -> 123`)}`);
    it.todo(`macro no parameters block :: ${compact(`macro { 123 }`)}`);
    it.todo(
      `macro with return type :: ${compact(
        `macro (x, y), env -> number { x + y }`
      )}`
    );
    it.todo(
      `macro with parameter types :: ${compact(
        `macro (x: Expr<number>, y: Expr<string>), env: Env -> number { x + y }`
      )}`
    );
    it.todo(`macro with no arg :: ${compact(`macro -> #0`)}`);
    it.todo(`macro immediate form :: ${compact(`macro: x; y`)}`);
    it.todo(`macro block form :: ${compact(`macro { x }`)}`);
    it.todo(`macro rest form :: ${compact(`macro -> x; y`)}`);
  });

  describe('annotations', () => {
    it.todo(
      `annotate declaration :: ${compact(`x := macro (expr): eval expr`)}`
    );
    it.todo(`annotate expression :: ${compact(`@x 123`)}`);
    it.todo(
      `annotate expression with delimited args :: ${compact(`@x(1, 2) 123`)}`
    );
    it.todo(
      `annotate in composite expression :: ${compact(`@x(1, 2) 123 + 456`)}`
    );
    it.todo(
      `annotate whole composite expression :: ${compact(
        `@x(1, 2) (123 + 456)`
      )}`
    );
  });

  describe('database expressions', () => {
    it.todo('empty database');
    it.todo('query scope');
    it.todo('transaction basic');
    it.todo('transaction with abort');
    it.todo('transaction with commit');
    it.todo('tables declare type');
    it.todo('tables declare type with defaults');
    it.todo('tables primary field');
    it.todo('tables generated field');
    it.todo('query select basic');
    it.todo('query select fields');
    it.todo('query select expression');
    it.todo('query select with where');
    it.todo('query select with limit');
    it.todo('query select with order by');
    it.todo('query select with order by with');
    it.todo('query select with order by desc');
    it.todo('query select with join');
    it.todo('query select with join on');
    it.todo('query aggregate basic');
    it.todo('query aggregate where');
    it.todo('query aggregate distinct');
    it.todo('query aggregate order by');
    it.todo('query aggregate full');
    it.todo('query with group by');
    it.todo('query with distinct');
    it.todo('query with distinct with');
    it.todo('query window partition');
    it.todo('query window order by');
    it.todo('query window frame range');
    it.todo('query window frame rows');
    it.todo('query window frame groups');
    it.todo('query window frame range preceding');
    it.todo('query window frame range following');
    it.todo('query window frame range following unbounded');
    it.todo('query window frame range between');
    it.todo('query window frame range exclude current');
    it.todo('query window frame range exclude group');
    it.todo('query window frame range exclude ties');
    it.todo('query window full');
    it.todo('insert basic');
    it.todo('insert multiple');
    it.todo('insert select');
    it.todo('insert returning');
    it.todo('delete basic');
    it.todo('delete returning');
    it.todo('update basic');
    it.todo('update returning');
    it.todo('update returning old and new');
    it.todo('permissions grant select');
    it.todo('permissions grant insert');
    it.todo('permissions grant update');
    it.todo('permissions grant delete');
    it.todo('permissions grant where');
    it.todo('permissions grant columns');
    it.todo('permissions grant generic');
    it.todo('permissions revoke');
    it.todo('permissions and');
    it.todo('permissions or');
    it.todo('permissions not');
    it.todo('constraints uniqueness');
    it.todo('constraints foreign key');
    it.todo('constraints foreign key on delete');
    it.todo('constraints check');
    it.todo('constraints check immediate');
    it.todo('constraints check two fields');
    it.todo('views basic');
  });

  describe('logic programming', () => {
    it.todo('propositional logic and');
    it.todo('propositional logic not');
    it.todo('propositional logic or');
    it.todo('propositional logic implication');
    it.todo('propositional logic equivalence');
    it.todo('first order logic predicate instance');
    it.todo('first order logic existential over predicate instances');
    it.todo('first order logic universal over predicate instances');
    it.todo('first order logic universal over predicate instances with implication');
    it.todo('first order logic nested quantification');
    it.todo('first order logic quantified variable reuse');
    it.todo('higher order logic higher order quantification');
    it.todo('higher order logic higher order types');
    it.todo('higher order logic universal over predicates');
    it.todo('higher order logic transitive relations');
    it.todo('higher order logic transitive closure');
  });

  describe('state machine expressions', () => {
    it.todo('state machine');
    it.todo('state declaration');
    it.todo('parametric state declaration');
    it.todo('state transition');
    it.todo('nondet state transition');
    it.todo('parametric state transition');
    it.todo('input state transition');
    it.todo('nested state machine');
    it.todo('initial state selection');
    it.todo('state transition value');
    it.todo('state transition input');
    it.todo('state inspection');
    it.todo('state next transition');
  });

  describe('dataflow expressions', () => {
    it.todo('empty dataflow');
    it.todo('dataflow input');
    it.todo('dataflow output');
    it.todo('dataflow signal');
    it.todo('dataflow derived');
    it.todo('dataflow fan-out');
    it.todo('dataflow fan-in');
    it.todo('dataflow cyclic signals');
    it.todo('dataflow indirect cyclic signals');
    it.todo('dataflow effect');
    it.todo('dataflow guarded cyclic effect');
    it.todo('dataflow unguarded cyclic effect');
    it.todo('nested dataflow effect');
    it.todo('nested dataflow effect cleanup');
    it.todo('dataflow pipe');
  });

  describe('reactive programming', () => {
    it.todo(`signal :: ${compact(`x := signal 1`)}`);
    it.todo(`derived :: ${compact(`x := derived { x + 1 }`)}`);
    it.todo(`watch :: ${compact(`derived { log x + 1 }`)}`);
  });

  describe('folds', () => {
    it.todo(`map :: ${compact(`for x in y { x + 1 }`)}`);
    it.todo(`filter :: ${compact(`for x in y { if x > 0: x + 1 }`)}`);
    it.todo(`reduce :: ${compact(`for x in y with acc { acc + x }`)}`);
    it.todo(
      `fold premap :: ${compact(
        `fold node in tree { v := node + 1; recurse node.child; v }`
      )}`
    );
    it.todo(
      `fold postmap :: ${compact(
        `fold node in tree { recurse node.child; node + 1 }`
      )}`
    );
    it.todo(
      `fold filter :: ${compact(`fold node in tree { if node > 0: node + 1 }`)}`
    );
    it.todo(
      `fold reduce :: ${compact(
        `fold node in tree with acc { acc + recurse node.child }`
      )}`
    );
    it.todo(`generator :: ${compact(`gen f(x) { yield x; yield* f x+1 }`)}`);
    it.todo(
      `unfold generator :: ${compact(`gen f(x) { yield (f x+1, f x+2) }`)}`
    );
  });

  describe('concurrency gaps', () => {
    it.todo(`try operator :: ${compact(`try f()`)}`);
    it.todo(`channel forward :: ${compact(`c1 <<- c2`)}`);
    it.todo(`channel link :: ${compact(`c1 <-> c2`)}`);
    it.todo(
      `nondet race (multiset union) value :: ${compact(`123 ? 456`)}`
    );
    it.todo(
      `vectorize multiset value :: ${compact(`vector 123 & 456`)}`
    );
    it.todo(`race vector value :: ${compact(`race 123 | 456`)}`);
    it.todo(`collect parallel value :: ${compact(`collect 123 ? 456`)}`);
    it.todo(`channel swap :: ${compact(`c <-> x`)}`);
    it.todo(`channel form 1 :: ${compact(`channel c -> c <- 123; 234`)}`);
    it.todo(`channel form 2 :: ${compact(`channel c: c <- 123; 234`)}`);
    it.todo(`channel form 3 :: ${compact(`channel c { c <- 123; 234 }`)}`);
    it.todo('shared channel');
    it.todo('select');
    it.todo(
      `channel choice :: ${compact(`match <- c { 1 -> 123, 2 -> 234 }`)}`
    );
    it.todo(
      `channel replicated receive (subscribe) :: ${compact(`x := <-! c`)}`
    );
    it.todo(
      `channel replicated send (source events) :: ${compact(`c <-! 123`)}`
    );
    it.todo('dispatch');
    it.todo(
      `dispatch list :: ${compact(`dispatch n for x in list { x + 1 }`)}`
    );
    it.todo('dispatch swap');
  });

  describe('first-class patterns and types', () => {
    it.todo('pattern value');
    it.todo('pattern value binding access');
    it.todo('pattern elimination');
    it.todo('pattern link');
    it.todo('pattern in function');
    it.todo(`type value :: ${compact(`type number`)}`);
  });

  describe('pattern matching gaps', () => {
    it.todo(`with matcher 2 :: ${compact(`x is some a and a == 1`)}`);
    it.todo(`with pointer :: ${compact(`x is *a`)}`);
    it.todo(`with ref :: ${compact(`x is &a`)}`);
    it.todo(`with type :: ${compact(`x is a: number`)}`);
    test.todo('pattern union');
    test.todo('pattern intersection');
    test.todo('pattern negation');
  });

  describe('types', () => {
    it.todo(`declaration with type :: ${compact(`x: number := 1`)}`);
    it.todo(`typeof :: ${compact(`typeof x`)}`);
    it.todo(`typeof value is type :: ${compact(`typeof x == number`)}`);
    it.todo(`type cast :: ${compact(`x as number`)}`);
    it.todo(`type coalesce :: ${compact(`x :> number`)}`);
    it.todo(`function type :: ${compact(`x: (number -> string) := fn: "1"`)}`);
    it.todo(
      `function type with multiple args :: ${compact(
        `x: fn number, string -> string := fn: "1"`
      )}`
    );
    it.todo(
      `function type with named args :: ${compact(
        `x: fn (x: number, y: string) -> string := fn: "1"`
      )}`
    );
    it.todo(
      `parametric function type :: ${compact(
        `x: fn (x: infer y) -> y or number := fn: "1"`
      )}`
    );
  });

  describe('programs', () => {
    it.todo(`export declaration as :: ${compact(`export x as y := 123`)}`);
    it.todo(`export expr as :: ${compact(`export x+1 as y`)}`);
    it.todo(`external variable :: ${compact(`external y`)}`);
    it.todo(
      `import quotes :: ${compact(`import "../relative/.././path/to/folder"`)}`
    );
    it.todo(
      `import segment quotes :: ${compact(`import ../relative/.././"path"/to/folder`)}`
    );
    it.todo(`import with :: ${compact(`import a as b with x`)}`);
    it.todo(`dynamic import :: ${compact(`b := import a`)}`);
    it.todo(`dynamic async import :: ${compact(`b := async import a`)}`);
    it.todo(`dynamic import with :: ${compact(`b := import a with x`)}`);
    it.todo(
      `dynamic quotes import with :: ${compact(`b := import "a" with x`)}`
    );
    it.todo(`operator :: ${compact(`operator _+_ := fn x, y -> x + y`)}`);
    it.todo(
      `operator with precedence :: ${compact(
        `operator _+_ precedence 1 := fn x, y -> x + y`
      )}`
    );
    it.todo(
      `operator with tuple precedence :: ${compact(
        `operator _+_ precedence 1, 2 := fn x, y -> x + y`
      )}`
    );
    it.todo(`namespace :: ${compact(`namespace a { x := 123 }`)}`);
  });
});

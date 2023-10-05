import { describe, expect } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import {
  Term,
  eraseBlocks,
  eraseFunctionWithArgs,
  eraseNames,
  erasePatterns,
  evaluate,
  insertContext,
  parse,
} from "../src/lambda";

const f = (src: string, context: Term[] = []) => {
  const [parsed, errors] = parse(src);
  const erasedPatterns = erasePatterns(parsed);
  const erasedBlocks = eraseBlocks(erasedPatterns);
  const erasedFnArgs = eraseFunctionWithArgs(erasedBlocks);
  const erasedNames = eraseNames(erasedFnArgs);
  const withEnv = insertContext(erasedNames, context);
  const evaluated = evaluate(withEnv);
  return [withEnv, evaluated, errors] as const;
};

const env = {
  id: "fn x->x",
  true: "fn->fn-> #1",
  false: "fn->fn-> #0",
  succ: "fn predecessor -> fn successorMatch, zeroMatch -> successorMatch predecessor",
  zero: "fn successorMatch, zeroMatch -> zeroMatch",
  is_zero: "fn n -> n false true",
  pass_self: "fn -> #0 #0",
  fix: `fn -> pass_self (fn -> #1 (pass_self #0))`,
  tuple_n_rev: `{ 
    tuple_n = fn n -> n (fn pred -> fn x -> tuple_n pred x) ();
    fn n -> tuple_n (succ n)
  }`,
  reverse:
    "fn tuple, n -> n (fn pred -> append (reverse (tail tuple n) pred) (head tuple n)) ()",
  tuple_n:
    "fn n -> (fix fn tuple_c -> fn m, acc -> (sub n m) (fn x -> tuple_c (succ m) (cons x acc)) (listToTuple acc)) 0 nil",
  tuple: "tuple_n 2",
  append: "fn tuple, x -> fn match -> (tuple match) x",
  prepend: "fn x, tuple -> fn match -> tuple (match x)",
  drop: "fix fn drop -> fn n -> n (fn pred -> fn -> drop pred) id", // drop n args and ret x
  pick: "fn n, m -> drop m (fn x -> drop (n-m-1) x)", // pick mth arg out of n args
  nth: "fn tuple, size, n -> tuple (pick size n)", // get nth item in tuple
  swap: "fn -> fn x, y -> #2 y x",
  swap_tuple: "fn tuple, match -> tuple (swap match)",
  dec: `fn n -> n id zero`,
  sub: `fn n, m -> m (fn pred -> sub pred (dec m)) n`,
  add: `fn n, m -> n (fn pred -> add pred (succ m)) m`,
  mul: `fn n, m -> n (fn pred -> add m (mul pred m)) zero`,
  div: `fn n, m -> succ (div (sub n m) m)`,
  rem: `fn n, m -> (sub n m) (fn -> rem (sub n m) m) n`,
  lte: `fn n, m -> (sub n m) (fn -> false) true`, // n less-than-equal m
  and: "fn -> fn -> #1 #0 false",
  not: "fn -> #0 false true",
  eq: `fn n, m -> and (lte n m) (lte m n)`, // n equal m
  tail: `fn tuple, n -> tuple (fn -> tuple_n (n-1))`,
  head: `fn tuple, n -> nth tuple n 0`,
  insert: `fix fn insert -> fn tuple, size, n, x -> n 
    (fn pred -> {
      head = head tuple size;
      tail = tail tuple size;
      new_tail = insert tail (dec size) pred x;
      prepend head new_tail
    })
    (prepend x tuple)`,
  cons: `fn x, tail -> fn matchCons, matchNil -> matchCons x tail`,
  nil: `fn matchCons, matchNil -> matchNil`,
  tupleToList: `fix fn tupleToList -> fn tuple, size -> 
  size 
      (fn pred -> cons (head tuple size) tupleToList (tail tuple size) pred) 
      nil`,
  listToTuple: `fix fn listToTuple -> fn list -> 
    list 
      (fn x, tail -> prepend x (listToTuple tail)) 
      id`,
};

const examples = [
  "{ true= #1;false= #1; true }",
  "{ (true, false) = (#1, #0); true }",
  `{ 
    rec tuple_n = fn n -> n (fn pred -> fn x -> tuple_n pred x) ();
    tuple_n
  }`,
  `{
    rec (even, odd) = (
      fn n -> if n = 0 then true else odd (n - 1),
      fn n -> even (n - 1)
    )
    (even, odd)
  }`,
  `{
    flatmapOption = fn map, value -> value mapper none
    with flatmapOption {
      x = some 1;
      y = some 2;
      z = none;
      some(x + y)
    }
  }`,
];

test.prop([fc.string().filter((s) => !s.includes("\\") && !s.includes('"'))])(
  "env",
  (value) => {
    const src = `"${value}"`;
    const startIndex = 0;
    const expectedToken = { type: "string", src, value };
    const expectedIndex = value.length + 2;
    const expectedErrors = [];

    const [index, token, errors] = parseToken(src, startIndex);

    expect(index).toBe(expectedIndex);
    expect(token).toEqual(expectedToken);
    expect(errors).toEqual(expectedErrors);
  }
);

// Test case: Parsing a number token
describe("parseToken - number token", () => {
  it.prop([fc.stringMatching(/^\d+\.\d+$/)])("float literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number(src) };
    const expectedIndex = src.length;
    const expectedErrors = [];

    const [index, token, errors] = parseToken(src, startIndex);

    expect(token).toEqual(expectedToken);
    expect(errors).toEqual(expectedErrors);
    expect(index).toBe(expectedIndex);
  });

  it.prop([fc.stringMatching(/^\d+$/)])("int literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number(src) };
    const expectedIndex = src.length;
    const expectedErrors = [];

    const [index, token, errors] = parseToken(src, startIndex);

    expect(token).toEqual(expectedToken);
    expect(errors).toEqual(expectedErrors);
    expect(index).toBe(expectedIndex);
  });

  it.prop([fc.stringMatching(/^\d+\.$/)])("trailing dot literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number(src + "0") };
    const expectedIndex = src.length;
    const expectedErrors = [];

    const [index, token, errors] = parseToken(src, startIndex);

    expect(token).toEqual(expectedToken);
    expect(errors).toEqual(expectedErrors);
    expect(index).toBe(expectedIndex);
  });

  it.prop([fc.stringMatching(/^\.\d+$/)])("prefix dot literals", (src) => {
    const startIndex = 0;
    const expectedToken = { type: "number", src, value: Number("0" + src) };
    const expectedIndex = src.length;
    const expectedErrors = [];

    const [index, token, errors] = parseToken(src, startIndex);

    expect(token).toEqual(expectedToken);
    expect(errors).toEqual(expectedErrors);
    expect(index).toBe(expectedIndex);
  });

  it.prop([fc.stringMatching(/^(\d+_*)*\d+\.(\d+_*)*\d+$/)])(
    "literals with spacers",
    (src) => {
      const startIndex = 0;
      const expectedToken = {
        type: "number",
        src,
        value: Number(src.replace(/_/g, "")),
      };
      const expectedIndex = src.length;
      const expectedErrors = [];

      const [index, token, errors] = parseToken(src, startIndex);

      expect(token).toEqual(expectedToken);
      expect(errors).toEqual(expectedErrors);
      expect(index).toBe(expectedIndex);
    }
  );
});

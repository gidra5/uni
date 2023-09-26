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

const examples = [
  "fn x->x", // id, ()
  "fn->fn-> #1", // true
  "fn->fn-> #0", // false
  "{ true= #1;false= #1; true }",
  "{ (true, false) = (#1, #0); true }",
  "fn predecessor -> fn successorMatch, zeroMatch -> successorMatch predecessor", // succ n constructor
  "fn successorMatch, zeroMatch -> zeroMatch", // zero
  "fn n -> n false true", // isZero
  "fix fn tuple_n -> fn n -> n (fn pred -> fn x -> tuple_n pred x) ()", // tuple_n
  `{ 
    tuple_n = fn n -> n (fn pred -> fn x -> tuple_n pred x) ();
    tuple_n
  }`, // tuple_n 2
  "fn tuple, x -> fn match -> (tuple match) x", // append
  "fn x, tuple -> fn match -> tuple (match x)", // prepend
  "fn n, x -> n (fn pred -> fn -> drop pred x) x", // drop n args and ret x
  "fn n, m -> drop m (fn x -> drop (n-m-1) x)", // pick mth arg out of n args
  "fn tuple, size, n -> tuple (pick size n)", // get nth item in tuple
  `{ dec = fn n -> n id zero; dec }`,
  `{ sub = fn n, m -> n (fn pred -> sub pred (dec m)) m; sub }`,
  `{ add = fn n, m -> n (fn pred -> add pred (succ m)) m; add }`,
  `{ mul = fn n, m -> n (fn pred -> add m (mul pred m)) zero; add }`,
  `{ div = fn n, m -> succ (div (sub n m) m); add }`,
  `{ rem = fn n, m -> (sub n m) (fn -> rem (sub n m) m) n; add }`,
  `{ lte = fn n, m -> (sub n m) (fn -> false) true; lte }`, // n less-than-equal m
  `{ eq = fn n, m -> n (fn predN -> m (fn predM -> eq predN predM) false) (m (fn predM -> false) true); eq }`, // n equal m
  `{ tail = fn tuple, n -> tuple (fn _ -> tuple_n (n-1)); tail }`,
  `{ head = fn tuple, n -> nth tuple n 0; head }`,
  `{ insert = fn tuple, size, n, x -> n (fn pred -> prepend (head tuple size) (insert (tail tuple size) (dec size) pred x)) (prepend x tuple); insert }`,
  `{ 
    cons = fn x, tail -> fn matchCons, matchNil -> matchCons x tail;
    nil  =               fn matchCons, matchNil -> matchNil;
    tupleToList = fn tuple, n -> 
      n 
        (fn pred -> cons (head tuple n) tupleToList (tail tuple n)) 
        nil;
    listToTuple = fn list -> 
      list 
        (fn x, tail -> prepend x (listToTuple tail)) 
        ();
    (cons, nil, tupleToList, listToTuple)
  }`,
  `{
    rec (even, odd) = (
      fn n -> if n = 0 then true else odd (n - 1),
      fn n -> even (n - 1)
    )
    (even, odd)
  }`,
  `{
    flatmapOption = fn map, value -> option mapper none
    with flatmapOption {
      x = some 1;
      y = some 2;
      z = none;
      some(x + y)
    }
  }`,
];

test.prop([fc.string().filter((s) => !s.includes("\\") && !s.includes('"'))])(
  "parseToken - string token",
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

test.prop([fc.string({ maxLength: 1, minLength: 1 })])(
  "parseToken - string token escape",
  (value) => {
    const src = `"\\${value}"`;
    const startIndex = 0;
    const expectedToken = { type: "string", src, value };
    const expectedIndex = 4;
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

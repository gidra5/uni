import { expect, it } from "vitest";
import { parseExprString, parseProgramString } from "../../src/parser/string";
import { inferType } from "../../src/typechecker/inferType";

export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseExprString(src);
    expect(errors).toEqual(expectedErrors);
  });

export const exampleInferTestCase = (src, expectedType?, scope = {}) => {
  const [tree, errors] = parseProgramString(src, scope);
  const typedTree = inferType(tree);
  // console.dir(typedTree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedType) expect(typedTree.data.type).toEqual(expectedType);
  expect(typedTree.data.type).toMatchSnapshot();
};

export const treeInferTestCase = (src, expectedType?, scope = {}) => {
  const [tree, errors] = parseExprString(src, scope);
  const typedTree = inferType(tree);
  console.dir(typedTree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedType) expect(typedTree.data.type).toEqual(expectedType);
  expect(typedTree.data.type).toMatchSnapshot();
};

export const treeInferTestCaseArgs = (src, expectedType?, scope = {}) =>
  [`produces correct tree for '${src}'`, () => treeInferTestCase(src, expectedType, scope)] as const;

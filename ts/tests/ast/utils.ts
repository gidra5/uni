import { expect, it } from "vitest";
import { parseExprString, parseProgramString } from "../../src/parser/string";

export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseExprString(src);
    expect(errors).toEqual(expectedErrors);
  });

export const exampleTestCase = (src, expectedTree?, scope = {}) => {
  const [tree, errors] = parseProgramString(src, scope);
  console.dir(tree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedTree) expect(tree).toEqual(expectedTree);
  expect(tree).toMatchSnapshot();
};

export const treeTestCase = (src, expectedTree?, scope = {}) => {
  const [tree, errors] = parseExprString(src, scope);
  // console.dir(tree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedTree) expect(tree).toEqual(expectedTree);
  expect(tree).toMatchSnapshot();
};

export const treeTestCaseArgs = (src, expectedTree?, scope = {}) =>
  [
    `produces correct tree for '${src}'`,
    () => treeTestCase(src, expectedTree, scope),
  ] as const;

import { expect, it } from "vitest";
import { parseExprString, parseProgramString } from "../../src/parser/string";
import { defaultParsingContext, parseExpr } from "../../src/parser";
import { Scope } from "../../src/scope";
import { parseTokens } from "../../src/parser/tokens";
import { scopeDictionary } from "../../src/parser/constants";

export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseExprString(src);
    expect(errors).toEqual(expectedErrors);
  });

const dropScope = (tree) => {
  if (tree.data.scope) delete tree.data.scope;
  tree.children.forEach(dropScope);
};

export const exampleTestCase = (src, expectedTree?, scope = scopeDictionary) => {
  const [tree, errors] = parseProgramString(src, scope);
  // console.dir(tree, { depth: null });
  expect(errors).toEqual([]);
  dropScope(tree);
  if (expectedTree) expect(tree).toEqual(expectedTree);
  expect(tree).toMatchSnapshot();
};

export const treeTestCase = (src, expectedTree?, scope = scopeDictionary) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = new Scope(scope);
  const [tree, errors] = parseExpr(context)(tokens).slice(1);
  // console.dir(tree, { depth: null });
  expect(errors).toEqual([]);
  dropScope(tree);
  if (expectedTree) expect(tree).toEqual(expectedTree);
  expect(tree).toMatchSnapshot();
};

export const treeTestCaseArgs = (src, expectedTree?, scope = scopeDictionary) =>
  [`produces correct tree for '${src}'`, () => treeTestCase(src, expectedTree, scope)] as const;

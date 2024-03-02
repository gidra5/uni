import { expect, it } from "vitest";
import { parseExprString, parseProgramString } from "../../src/parser/string";
import { defaultParsingContext, parseExpr } from "../../src/parser";
import { Scope } from "../../src/scope";
import { parseTokens } from "../../src/parser/tokens";
import { scopeDictionary } from "../../src/parser/constants";
import { Compiler } from "../../src/compiler";

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

export const testCase = (src, expectedAsm?, scope = scopeDictionary) => {
  const [ast, errors] = parseExprString(src);
  const asm = Compiler.compileToAsm(ast);
  console.dir(asm, { depth: null });
  expect(errors).toEqual([]);
  if (expectedAsm) expect(asm).toEqual(expectedAsm);
  expect(asm).toMatchSnapshot();
};

export const treeTestCaseArgs = (src, expectedTree?, scope = scopeDictionary) =>
  [`produces correct tree for '${src}'`, () => testCase(src, expectedTree, scope)] as const;

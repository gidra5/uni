import { expect, it } from "vitest";
import { parseExprString, parseScriptString } from "../../src/parser/string";
import { chunkToString, transform } from "../../src/transformers/flatten";

export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseExprString(src);
    expect(errors).toEqual(expectedErrors);
  });

const dropScope = (tree) => {
  if (tree.data.scope) delete tree.data.scope;
  tree.children.forEach(dropScope);
};

export const testCase = (src, expectedAsm?, scope?) => {
  // const [ast, errors] = parseScriptString(src, scope);
  const ast = parseScriptString(src, scope);
  const errors = [];
  console.dir(ast, { depth: null });

  const code = transform(ast);
  const asm = code.map(chunkToString);

  // console.dir(asm, { depth: null });
  expect(errors).toEqual([]);
  if (expectedAsm) expect(asm).toEqual(expectedAsm);
  expect(asm).toMatchSnapshot();
};

export const treeTestCaseArgs = (src, expectedTree?, scope?) =>
  [`produces correct tree for '${src}'`, () => testCase(src, expectedTree, scope)] as const;

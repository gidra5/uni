import path from "node:path";
import { parseStringToAST, parseTokensToASTs } from "./ast";
import {
  AbstractSyntaxTree,
  AbstractSyntaxTreeChildren,
  ParsingError,
  Scope,
  FlatSyntaxTree,
  ConsumeParsingResult,
  Token,
} from "./types";
import fs from "node:fs/promises";
import { omit, pick } from "../utils";

const blockScope = (inner: (outer: Scope) => Scope): Scope => ({
  sequence: {
    leadingTokens: [";", "\n"],
    separators: [{ tokens: [";", "\n"], repeats: [0, Infinity], scope: inner }],
    precedence: [null, null],
  },
});

const bindingScope: Scope = {
  bind: { leadingTokens: [":="], separators: [], precedence: [Infinity, 1] },
  mutate: { leadingTokens: ["="], separators: [], precedence: [Infinity, 1] },
};

const exprScope: Scope = {
  array: {
    leadingTokens: ["["],
    separators: [{ tokens: ["]"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  index: {
    leadingTokens: ["["],
    separators: [{ tokens: ["]"], repeats: [1, 1] }],
    precedence: [Infinity, null],
  },
  arrow: { leadingTokens: ["->"], separators: [], precedence: [Infinity, Infinity] },
  generic: {
    leadingTokens: ["<"],
    separators: [{ tokens: [">"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  group: {
    leadingTokens: ["("],
    separators: [{ tokens: [")"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  block: {
    leadingTokens: ["{"],
    separators: [{ tokens: ["}"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  if: {
    leadingTokens: ["if"],
    separators: [
      { tokens: [":"], repeats: [1, 1] },
      { tokens: ["else"], repeats: [0, 1] },
    ],
    precedence: [null, Infinity],
  },
  tuple: { leadingTokens: [","], separators: [{ tokens: [","], repeats: [0, Infinity] }], precedence: [1, 2] },
  logical: { leadingTokens: ["and", "or"], separators: [], precedence: [1, 2] },
  equality: { leadingTokens: ["==", "is"], separators: [], precedence: [3, 4] },
  comparison: { leadingTokens: [">", ">=", "<", "<="], separators: [], precedence: [5, 6] },
  term: { leadingTokens: ["+", "-"], separators: [], precedence: [7, 8] },
  factor: { leadingTokens: ["*", "/"], separators: [], precedence: [9, 10] },
  exponent: { leadingTokens: ["^", "%"], separators: [], precedence: [11, 12] },
  unary: { leadingTokens: ["not", "-", "sqrt"], separators: [], precedence: [null, 13] },
  postfixNot: { leadingTokens: ["not"], separators: [], precedence: [14, null] },
};
const commentsScope: Scope = {
  comment: {
    leadingTokens: ["//"],
    separators: [{ tokens: ["\n"], repeats: [1, 1], scope: () => ({}) }],
    precedence: [null, null],
  },
  multilineComment: {
    leadingTokens: ["/*"],
    separators: [{ tokens: ["*/"], repeats: [1, 1] }],
    precedence: [null, null],
  },
};
const topLevelScope: Scope = {
  import: {
    leadingTokens: ["import", "use"],
    separators: [
      { tokens: ["as"], repeats: [1, 1], scope: () => pick(exprScope, ["block"]) },
      { tokens: ["with"], repeats: [0, 1], scope: () => pick(exprScope, ["block"]) },
    ],
    precedence: [null, 1],
  },
  external: {
    leadingTokens: ["external"],
    separators: [
      { tokens: [":"], repeats: [0, 1], scope: () => pick(exprScope, ["block"]) },
      { tokens: ["as"], repeats: [0, 1], scope: () => pick(exprScope, ["block"]) },
      { tokens: ["="], repeats: [0, 1], scope: () => pick(exprScope, ["block"]) },
    ],
    precedence: [null, 1],
  },
  export: {
    leadingTokens: ["export", "protected"],
    separators: [{ tokens: ["="], repeats: [0, 1], scope: () => pick(exprScope, ["block"]) }],
    precedence: [null, 1],
  },
};
const scope: Scope = {
  ...blockScope(() => omit(scope, ["sequence"])),
  ...topLevelScope,
  ...pick(bindingScope, ["bind"]),
};

const expandTree = (tree: FlatSyntaxTree): ConsumeParsingResult<AbstractSyntaxTree> => {
  const errors: ParsingError[] = [];
  const result: AbstractSyntaxTree = { item: { type: "newline", src: "\n" } };

  if (tree.lhs) {
    const [expanded, _errors] = expandTree(tree.lhs);
    result.lhs = expanded;
    errors.push(..._errors);
  }

  if (tree.item.type === "operator") {
    const children: AbstractSyntaxTreeChildren[] = [];

    for (const child of tree.item.children) {
      const [asts, errors] = parseTokensToASTs(child.children, 0, scope);
      const _children: AbstractSyntaxTree[] = [];
      for (const ast of asts) {
        const [expanded, _errors] = expandTree(ast);
        _children.push(expanded);
        errors.push(..._errors);
      }
      children.push({ ...child, children: _children });
    }

    result.item = { ...tree.item, children };
  } else {
    result.item = tree.item;
  }

  if (tree.rhs) {
    const [expanded, _errors] = expandTree(tree.rhs);
    result.rhs = expanded;
    errors.push(..._errors);
  }

  return [result, errors];
};

export const expandTrees = (ast: FlatSyntaxTree[]): ConsumeParsingResult<AbstractSyntaxTree[]> => {
  const errors: ParsingError[] = [];
  const result: AbstractSyntaxTree[] = [];

  for (const item of ast) {
    const [expanded, _errors] = expandTree(item);
    result.push(expanded);
    errors.push(..._errors);
  }

  return [result, errors];
};

type Expression = AbstractSyntaxTree;
type External = { alias: string; type?: Expression; pattern?: Expression; value?: Expression };
type Import = { module: string; dependency: boolean; with?: Expression; pattern: Expression };
type Export = { protected: boolean } & ({ name: string } | { pattern: Expression; value: Expression });
type Private = { pattern: Expression; value: Expression };
type Module = {
  externals: External[];
  imports: Import[];
  exports: Export[];
  privates: Private[];
};

/*
Parse module:

input:
1. path to the module
2. optional base of path.
2. preloaded registry of modules.

output: 
1. registry, where each value has:
  1. list of imports, that are keys in the module dict
  2. list of exports, which include:
    1. protected or not
    2. name or pattern and value
  3. list of externals, which include:
    1. name
    2. optional type definition tokens
    3. optional default value tokens
    3. optional pattern tokens
  3. list of privates, which include:
    1. pattern
    2. value
2. errors that occurred during parsing

instructions:
1. concatenate path with base
2. check if resulting path is a folder or a file
3. if it is a folder - return an error
4. read file's content as string
5. parse by calling a parseStringToAST with parameters:
  1. source to parse (file's content)
  2. index at which to start (0).
  3. scope, which defines comments
6. filter out comments, leaving only tokens
5. parse by calling a parseTokensToASTs with parameters:
  1. source to parse (file's content)
  2. index at which to start (0).
  3. scope, which defines statements and operators like "import", "export", "external"
6. assert that result has only one top level children
7. assert that result's child is "sequence" operator
8. extract "sequence"'s children as "statements".
9. assert that "statements" only include single "import", "export", "external" statements
10. for each statement do:
  1. if it's import or use:
    1. assert its first child is single string
    4. parse imported module, using path defined by first child
    5. merge module dictionaries.
    6. add import to the list of imports
  2. if it's export or protected (export):
    1. if its first child used "as" separator - assert rhs is identifier
    2. add to the list of exports
  3. if it's external:
    1. assert first child is single identifier
    2. add external to the list of externals
  4. if it's private (regular declaration):
    2. add external to the list of private defs
11. return module dictionaries and errors.
*/

const loadModuleByName = async (name: string): Promise<Module | null> => {
  return { exports: [], externals: [], imports: [], privates: [] };
};
export const loadDependencyModule = async (name: string): Promise<ConsumeParsingResult<Module | null>> => {
  const module = await loadModuleByName(name);

  if (!module) return [null, [{ message: "could not resolve dependency" }]];

  return [module, []];
};

export const expandModule = async (
  module: Module,
  registry: Record<string, Module> = {}
): Promise<ConsumeParsingResult<Record<string, Module>>> => {
  const { imports } = module;
  const errors: ParsingError[] = [];
  for (const { dependency, module } of imports) {
    if (module in registry) continue;
    if (dependency) {
      const [_module, _errors] = await loadDependencyModule(module);
      errors.push(..._errors);
      if (_module) registry[module] = _module;
    } else {
      const [_registry, _errors] = await parseFile({ path: module, registry });
      errors.push(..._errors);
      registry = _registry;
    }
  }
  return [registry, errors];
};

export const parseFile = async ({
  path: _path,
  base = ".",
  registry = {},
}: {
  path: string;
  base?: string;
  registry?: Record<string, Module>;
}): Promise<ConsumeParsingResult<Record<string, Module>>> => {
  const resolvedPath = path.resolve(path.join(base, _path));
  if (!(await fs.lstat(resolvedPath)).isFile()) return [registry, [{ message: "path does not refer to a file" }]];

  const src = await fs.readFile(resolvedPath, "utf-8");
  const [module, errors] = parseFileContent(src);
  return [{ ...registry, [_path]: module }, errors];
};

export const parseFileContent = (src: string): ConsumeParsingResult<Module> => {
  const module: Module = { exports: [], externals: [], imports: [], privates: [] };
  const [_cleaned] = parseStringToAST(src, 0, commentsScope);
  const cleaned = _cleaned
    .filter((item): item is typeof item & { item: Token } => item.item.type !== "operator")
    .map(({ item }) => item);
  const [_ast, errors] = parseTokensToASTs(cleaned, 0, scope);
  if (_ast.length < 1) return [module, [...errors, { message: "module is empty" }]];

  const ast = _ast.filter(
    (item): item is typeof item & { item: { type: "operator" } } => item.item.type === "operator"
  );
  if (ast.length < 1) return [module, [...errors, { message: "invalid module definition" }]];
  if (ast.length > 3) return [module, [...errors, { message: "invalid module definition" }]];

  const [expanded, _errors] = expandTrees(ast);
  errors.push(..._errors);
  const asts = expanded.flatMap((child) => {
    if (child.item.type !== "operator") return [];
    if (child.item.id === "sequence") {
      return child.item.children.flatMap((child) => {
        return child.children.filter(
          (item): item is typeof item & { item: { type: "operator" } } => item.item.type === "operator"
        );
      });
    }
    return [child as typeof child & { item: { type: "operator" } }];
  });

  for (const ast of asts) {
    const { item } = ast;
    if (item.id === "export" && ast.rhs) {
      const {
        children: [child],
        token,
      } = item;
      if (!child) {
        if (ast.rhs.item.type !== "identifier") {
          errors.push({ message: "Must export identifier" });
          continue;
        }
        module.exports.push({ protected: token.src === "protected", name: ast.rhs.item.src });
      }
      if (child.children.length !== 1) errors.push({ message: "Must have exactly one child" });
      module.exports.push({ protected: token.src === "protected", pattern: child.children[0], value: ast.rhs });
    }
    if (item.id === "bind" && ast.rhs && ast.lhs) {
      module.privates.push({ pattern: ast.lhs, value: ast.rhs });
    }
    if (item.id === "import" && ast.rhs) {
      const {
        children: [child1, child2],
        token,
      } = item;
      if (child1.children.length !== 1) errors.push({ message: "Must have exactly one child" });
      if (child1.children[0].item.type !== "string") {
        errors.push({ message: "Module path must be string" });
        continue;
      }
      const modulePath = child1.children[0].item.value;
      const dependency = token.src === "use";
      if (!child2) {
        module.imports.push({ module: modulePath, pattern: ast.rhs, dependency });
        continue;
      }
      if (child2.children.length !== 1) errors.push({ message: "Must have exactly one child" });
      module.imports.push({ module: modulePath, pattern: child2.children[0], with: ast.rhs, dependency });
    }

    if (item.id === "external" && ast.rhs) {
      const { children } = item;
      if (children.length === 0) {
        if (ast.rhs.item.type !== "identifier") {
          errors.push({ message: "External name must be identifier" });
          continue;
        }
        module.externals.push({ alias: ast.rhs.item.src });
      }
      if (children.length === 1) {
        const [child] = children;
        if (child.children.length !== 1) {
          errors.push({ message: "External name must be single child" });
        }
        if (child.children[0].item.type !== "identifier") {
          errors.push({ message: "External name must be identifier" });
          continue;
        }
        const alias = child.children[0].item.src;
        if (child.separatorToken.src === ":") module.externals.push({ alias, type: ast.rhs });
        if (child.separatorToken.src === "as") module.externals.push({ alias, pattern: ast.rhs });
        if (child.separatorToken.src === "=") module.externals.push({ alias, value: ast.rhs });
      }
      if (children.length === 2) {
        const [child1, child2] = children;
        if (child1.children.length !== 1) {
          errors.push({ message: "External name must be single child" });
        }
        if (child1.children[0].item.type !== "identifier") {
          errors.push({ message: "External name must be identifier" });
          continue;
        }
        const alias = child1.children[0].item.src;
        const external: External = { alias };
        if (child1.separatorToken.src === ":") {
          if (child2.children.length !== 1) {
            errors.push({ message: "External type must be single child" });
          }
          external.type = child2.children[0];
        }
        if (child1.separatorToken.src === "as") {
          if (child2.children.length !== 1) {
            errors.push({ message: "External pattern must be single child" });
          }
          external.pattern = child2.children[0];
        }
        if (child1.separatorToken.src === "=") {
          if (child2.children.length !== 1) {
            errors.push({ message: "External value must be single child" });
          }
          external.value = child2.children[0];
        }
        if (child2.separatorToken.src === "as") external.pattern = ast.rhs;
        if (child2.separatorToken.src === "=") external.value = ast.rhs;
        module.externals.push(external);
      }
      if (children.length === 3) {
        const [child1, child2, child3] = children;
        if (child1.children.length !== 1) {
          errors.push({ message: "External name must be single child" });
        }
        if (child1.children[0].item.type !== "identifier") {
          errors.push({ message: "External name must be identifier" });
          continue;
        }
        const alias = child1.children[0].item.src;
        const type = child2.children[0];
        const pattern = child3.children[0];
        const value = ast.rhs;
        module.externals.push({ alias, value, pattern, type });
      }
    }
  }

  return [module, errors];
};

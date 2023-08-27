import path from "node:path";
import { parseStringToAST } from "./ast";
import {
  ConsumeParsingResult,
  Parser,
  ParsingError,
  ParsingResult,
  Scope,
  Token,
} from "./types";
import fs from "node:fs/promises";
import { TaggedItemUnion } from "../types";

const commentsScope: Scope = {
  comment: {
    leadingTokens: ["//"],
    separators: [{ tokens: ["\n"], repeats: [1, 1], scope: () => ({}) }],
    precedence: [null, null],
  },
  multilineComment: {
    leadingTokens: ["/*"],
    separators: [{ tokens: ["*/"], repeats: [1, 1], scope: () => ({}) }],
    precedence: [null, null],
  },
};

type External<Pattern, Expression> = {
  alias: string;
  type?: Expression;
  pattern?: Pattern;
  value?: Expression;
};
type Import<Pattern, Expression> = {
  module: string;
  dependency: boolean;
  withExternals?: Expression;
  pattern: Pattern;
};
type Definition<Pattern, Expression> = {
  exported: boolean;
  type?: Expression;
  pattern: Pattern;
  value: Expression;
};
type ModuleItem<Pattern, Expression> = TaggedItemUnion<{
  external: External<Pattern, Expression>;
  import: Import<Pattern, Expression>;
  definition: Definition<Pattern, Expression>;
}>;
type Module<Pattern, Expression> = {
  externals: External<Pattern, Expression>[];
  imports: Import<Pattern, Expression>[];
  definitions: Definition<Pattern, Expression>[];
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

export class ModuleParser<P, E> {
  constructor(
    private loader: (name: string) => Promise<Module<P, E>>,
    private parsePattern: Parser<P, Token[]>,
    private parseExpr: Parser<E, Token[]>
  ) {}

  async loadDependencyModule(
    name: string
  ): Promise<ConsumeParsingResult<Module<P, E>>> {
    const module = await this.loader(name);

    if (!module)
      return [
        { externals: [], imports: [], definitions: [] },
        [{ message: "could not resolve dependency" }],
      ];

    return [module, []];
  }

  async resolveDependencies(
    module: Module<P, E>,
    registry: Record<string, Module<P, E>> = {}
  ): Promise<ConsumeParsingResult<Record<string, Module<P, E>>>> {
    const { imports } = module;
    const errors: ParsingError[] = [];

    for (const { dependency, module } of imports) {
      if (module in registry) continue;
      if (dependency) {
        try {
          const _module = await this.loader(module);

          registry[module] = _module;
        } catch (e: any) {
          errors.push({ message: "could not resolve dependency", cause: e });
        }
      } else {
        const resolvedPath = path.resolve(path.join(".", module));
        const [_module, _errors] = await this.parseFile(resolvedPath);

        errors.push(..._errors);
        registry[module] = _module;
      }
    }

    return [registry, errors];
  }

  async parseFile(path: string): Promise<ConsumeParsingResult<Module<P, E>>> {
    const fileStats = await fs.lstat(path);
    if (!fileStats.isFile())
      return [
        { externals: [], imports: [], definitions: [] },
        [{ message: "path does not refer to a file" }],
      ];

    const src = await fs.readFile(path, "utf-8");
    return this.parseModule(src);
  }

  parseModule(src: string): ConsumeParsingResult<Module<P, E>> {
    const [_cleaned] = parseStringToAST(src, 0, commentsScope);
    const cleaned = _cleaned
      .filter(
        (item): item is typeof item & { item: Token } =>
          item.item.type !== "operator"
      )
      .map(({ item }) => item);

    const module: Module<P, E> = {
      externals: [],
      imports: [],
      definitions: [],
    };

    const errors: ParsingError[] = [];
    let index = 0;

    while (cleaned[index]) {
      const token = cleaned[index];

      if (token.type === "newline") {
        index++;
        continue;
      }

      const [nextIndex, item, _errors] = this.parseModuleItem(cleaned, index);
      index = nextIndex;
      errors.push(..._errors);

      if (item.type === "definition") module.definitions.push(item.item);
      if (item.type === "external") module.externals.push(item.item);
      if (item.type === "import") module.imports.push(item.item);
    }

    return [module, errors];
  }

  parseModuleItem(src: Token[], index = 0): ParsingResult<ModuleItem<P, E>> {
    const token = src[index];

    if (token.type === "identifier" && ["use", "import"].includes(token.src)) {
      const dependency = token.src === "use";
      index++;
      if (src[index].type === "newline") index++;

      const [nextIndex, _import, errors] = this.parseImport(src, index);
      const item: Import<P, E> = { ..._import, dependency };
      return [nextIndex, { type: "import", item }, errors];
    }

    if (token.type === "identifier" && token.src === "external") {
      index++;
      if (src[index].type === "newline") index++;

      const [nextIndex, external, errors] = this.parseExternal(src, index);
      return [nextIndex, { type: "external", item: external }, errors];
    }

    const exported = token.type === "identifier" && token.src === "export";
    if (exported) index++;
    if (src[index].type === "newline") index++;

    const [nextIndex, definition, errors] = this.parseDefinition(src, index);
    const item: Definition<P, E> = { ...definition, exported };
    return [nextIndex, { type: "definition", item }, errors];
  }

  parseDefinition(src: Token[], index = 0): ParsingResult<typeof value> {
    const errors: ParsingError[] = [];
    const value: Omit<Definition<P, E>, "exported"> = {
      pattern: [] as P,
      value: [] as E,
    };

    value.pattern = (() => {
      const [nextIndex, pattern, _errors] = this.parsePattern(src, index);
      index = nextIndex;
      errors.push({ message: "cant parse pattern", cause: _errors });
      return pattern;
    })();

    if (src[index].type === "newline") index++;

    if (src[index].type !== "identifier" && src[index].src !== "=") {
      errors.push({ message: 'missing "=" sign' });
    } else index++;

    if (src[index].type === "newline") index++;

    value.value = (() => {
      const [nextIndex, value, _errors] = this.parseExpr(src, index);
      index = nextIndex;
      errors.push({ message: "cant parse expression", cause: _errors });
      return value;
    })();

    return [index, value, errors];
  }

  parseImport(src: Token[], index = 0): ParsingResult<typeof value> {
    const errors: ParsingError[] = [];
    const value: Omit<Import<P, E>, "dependency"> = {
      module: "",
      pattern: [] as P,
    };

    const token = src[index];
    if (token.type !== "string") {
      // TODO: sync
      errors.push({ message: "module name must be a string token" });
      return [index, value, errors];
    }

    value.module = token.value;
    index++;

    if (src[index].type === "newline") index++;

    value.pattern = (() => {
      const [nextIndex, pattern, _errors] = this.parsePattern(src, index);
      index = nextIndex;
      errors.push({ message: "cant parse pattern", cause: _errors });
      return pattern;
    })();

    if (src[index].type === "newline") index++;

    if (src[index].type !== "identifier" && src[index].src !== "with")
      return [index, value, errors];
    index++;

    if (src[index].type === "newline") index++;

    value.withExternals = (() => {
      const [nextIndex, withExternals, _errors] = this.parseExpr(src, index);
      index = nextIndex;
      errors.push({ message: "cant parse expression", cause: _errors });
      return withExternals;
    })();

    return [index, value, errors];
  }

  parseExternal(src: Token[], index = 0): ParsingResult<typeof value> {
    const errors: ParsingError[] = [];
    const value: External<P, E> = { alias: "" };

    const patternStartIndex = index;
    value.pattern = (() => {
      const [nextIndex, pattern, _errors] = this.parsePattern(src, index);
      index = nextIndex;
      errors.push({ message: "cant parse pattern", cause: _errors });
      return pattern;
    })();

    if (patternStartIndex === index - 1 && src[index - 1].type === "identifier")
      value.alias = src[index - 1].src;

    if (src[index].type === "newline") index++;

    if (src[index].type === "identifier" && src[index].src === ":") {
      index++;

      if (src[index].type === "newline") index++;

      value.type = (() => {
        const [nextIndex, type, _errors] = this.parseExpr(src, index);
        index = nextIndex;
        errors.push({ message: "cant parse type", cause: _errors });
        return type;
      })();
    }

    if (src[index].type === "identifier" && src[index].src === "as") {
      index++;

      if (src[index].type === "newline") index++;

      value.alias = (() => {
        const token = src[index];
        index++;

        if (token.type === "identifier") return token.src;

        errors.push({ message: "external alias must be identifier" });
        return "";
      })();
    }

    if (src[index].type === "identifier" && src[index].src === "=") {
      index++;

      if (src[index].type === "newline") index++;

      value.value = (() => {
        const [nextIndex, type, _errors] = this.parseExpr(src, index);
        index = nextIndex;
        errors.push({ message: "cant parse value", cause: _errors });
        return type;
      })();
    }

    if (!value.alias) errors.push({ message: "external must have name" });

    return [index, value, errors];
  }
}

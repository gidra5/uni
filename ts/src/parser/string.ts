import { defaultParsingContext, parse, parseExpr } from ".";
import { Scope } from "../scope";
import { AbstractSyntaxTree } from "./ast";
import { parseTokens } from "./tokens";
import { ConsumeParsingResult } from "./types";
import { TemplateValues, match, template } from "./utils";

export const parseExprString = (src: string, scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = context.scope.append(new Scope(scope));
  const result = parseExpr(context)(tokens).slice(1);
  return result as ConsumeParsingResult<AbstractSyntaxTree>;
};

export const parseProgramString = (src: string, scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = context.scope.append(new Scope(scope));
  return parse(context)(tokens);
};

export const templateString = (templateStr: string, values: TemplateValues) => {
  const [parsed] = parseExprString(templateStr);
  return template(parsed, values) as AbstractSyntaxTree;
};

export const matchString = (
  tree: AbstractSyntaxTree,
  pattern: string,
  matches: Record<string, AbstractSyntaxTree> = {}
) => {
  const [patternParsed] = parseExprString(pattern);
  // console.dir({ msg: "patternParsed", patternParsed, tree }, { depth: null });

  return match(tree, patternParsed, matches);
};

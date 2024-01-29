import { Scope, defaultParsingContext, parse, parseExpr } from ".";
import { AbstractSyntaxTree } from "./ast";
import { parseTokens } from "./tokens";
import { ConsumeParsingResult } from "./types";
import { TemplateValues, match, template } from "./utils";

export const parseExprString = (src: string, scope: Scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = { ...context.scope, ...scope };
  const result = parseExpr(context)(tokens).slice(1);
  return result as ConsumeParsingResult<AbstractSyntaxTree>;
};

export const parseProgramString = (src: string, scope: Scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = { ...context.scope, ...scope };
  return parse(context)(tokens);
};

export const templateString = (templateStr: string, values: TemplateValues) => {
  const [parsed] = parseExprString(templateStr);
  return template(parsed, values);
};

export const matchString = (
  tree: AbstractSyntaxTree,
  pattern: string,
  matches: Record<string, AbstractSyntaxTree> = {}
) => {
  const [patternParsed] = parseExprString(pattern);
  return match(tree, patternParsed, matches);
};

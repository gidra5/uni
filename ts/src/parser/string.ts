import { Scope, defaultParsingContext, parseExpr } from ".";
import { AbstractSyntaxTree } from "./ast";
import { parseTokens } from "./tokens";
import { ConsumeParsingResult } from "./types";
import { TemplateValues, match, template } from "./utils";

export const parseString = (src: string, scope: Scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = { ...context.scope, ...scope };
  const result = parseExpr(context)(tokens).slice(1);
  return result as ConsumeParsingResult<AbstractSyntaxTree>;
};

export const templateString = (templateStr: string, values: TemplateValues) => {
  const [parsed] = parseString(templateStr);
  return template(parsed, values);
};

export const matchString = (
  tree: AbstractSyntaxTree,
  pattern: string,
  matches: Record<string, AbstractSyntaxTree> = {}
) => {
  const [patternParsed] = parseString(pattern);
  return match(tree, patternParsed, matches);
};

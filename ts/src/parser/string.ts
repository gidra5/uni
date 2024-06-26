import { defaultParsingContext, parseScript, parseExpr, parseModule } from "./index.js";
import { Scope } from "../scope.js";
import { AbstractSyntaxTree } from "./ast.js";
import { parseTokens } from "./tokens.js";
import { ConsumeParsingResult } from "./types.js";
import { TemplateValues, match, template } from "./utils.js";
import { desugar } from "../transformers/desugar.js";
import { semanticReduction } from "../transformers/semanticReduction.js";

export const parseExprString = (src: string, scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = context.scope.append(new Scope(scope));
  const result = parseExpr(context)(tokens).slice(1);
  result[0] = desugar(result[0] as AbstractSyntaxTree);
  return result as ConsumeParsingResult<AbstractSyntaxTree>;
};

export const parseScriptString = (src: string, scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = context.scope.append(new Scope(scope));
  const [ast] = parseScript(context)(tokens);
  const desugared = desugar(ast);
  return semanticReduction(desugared);
};

export const parseModuleString = (src: string, scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = context.scope.append(new Scope(scope));
  const [ast] = parseModule(context)(tokens);
  const desugared = desugar(ast);
  return semanticReduction(desugared);
};

export const templateString = (templateStr: string, values: TemplateValues) => {
  const [parsed] = parseExprString(templateStr);
  return template(parsed, values) as AbstractSyntaxTree;
};

export const matchString = (
  tree: AbstractSyntaxTree,
  pattern: string,
  matches?: AbstractSyntaxTree[] & Record<string, AbstractSyntaxTree>
) => {
  const [patternParsed] = parseExprString(pattern);
  // console.dir({ msg: "patternParsed", patternParsed, tree }, { depth: null });

  return match(tree, patternParsed, matches);
};

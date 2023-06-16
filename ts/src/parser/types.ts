export type ScopeGenerator = (enclosing: Scope) => Scope;
export type SeparatorDefinition = {
  tokens: string[];
  repeats: [min: number, max: number];
  scope?: ScopeGenerator;
};
export type Precedence = [prefix: number | null, postfix: number | null];
export type TokenGroupDefinition = {
  separators: SeparatorDefinition[];
  precedence: Precedence;
};
export type Scope = Record<string, TokenGroupDefinition>;

export type Token =
  | { type: "identifier" | "whitespace" | "newline"; src: string }
  | { type: "number"; src: string }
  | { type: "string"; src: string; value: string };
export type TokenGroup = { token: Token; children: TokenGroupSeparator[] };
export type TokenGroupSeparatorChildren = (({ id: string; type: "operator" } & TokenGroup) | Token)[];
export type TokenGroupSeparator = {
  children: TokenGroupSeparatorChildren;
  separatorIndex: number;
  separatorToken: Token;
};
export type SyntaxTree = {
  item: TokenGroupSeparatorChildren[number];
  lhs?: SyntaxTree;
  rhs?: SyntaxTree;
};

export type ParsingError = { message: string };
export type ParsingResult<T> = [index: number, result: T, errors: ParsingError[]];
export type Parser<T> = (src: string, i: number) => ParsingResult<T>;

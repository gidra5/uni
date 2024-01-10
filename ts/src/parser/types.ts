export type Precedence = [prefix: number | null, postfix: number | null];

export type Token =
  | { type: "identifier" | "newline"; src: string }
  | { type: "number"; src: string; value: number }
  | { type: "string"; src: string; value: string };
export type TokenPos = Token & { pos: Position };
export type Position = { start: number; end: number };
export type ParsingError = {
  message: string;
  pos: Position;
  cause: ParsingError[];
};
export type ConsumeParsingResult<T> = [result: T, errors: ParsingError[]];
export type ParsingResult<T> = [
  index: number,
  ...result: ConsumeParsingResult<T>
];
export type Parser<T, S, Consume extends boolean> = (
  src: S,
  i?: number
) => Consume extends true ? ConsumeParsingResult<T> : ParsingResult<T>;
export type StringParser<T, Consume extends boolean = false> = Parser<
  T,
  string,
  Consume
>;
export type TokenParser<T, Consume extends boolean = false> = Parser<
  T,
  Token[],
  Consume
>;

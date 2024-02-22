import { Iterator } from "iterator-js";
import { matchSeparators } from "./utils.js";
import { placeholder } from "./ast.js";
import { TokenGroupDefinition } from "./index.js";
import { Scope } from "../scope.js";

export const infixArithmeticOps = Iterator.iterEntries({
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  modulo: "%",
  power: "^",
});

export const infixBooleanOps = Iterator.iterEntries({
  and: "and",
  or: "or",
  in: "in",
  is: "is",
  equal: "==",
  "not equal": "!=",
  "deep equal": "===",
  "deep not equal": "!==",
});

export const prefixArithmeticOps = Iterator.iterEntries({
  negate: "-",
  decrement: "--",
  increment: "++",
});

export const comparisonOps = Iterator.iter(["<", "<=", ">=", ">"]);

const arithmeticPrecedence = 5;
const booleanPrecedence = 2;
const semicolonPrecedence = 1;

export const scopeDictionary: Record<string, TokenGroupDefinition> = {
  false: { separators: matchSeparators(["false"]), precedence: [null, null] },
  true: { separators: matchSeparators(["true"]), precedence: [null, null] },
  print: { separators: matchSeparators(["print"]), precedence: [null, 1] },
  "@": { separators: matchSeparators(["@"]), precedence: [1, 1] },
  "+": { separators: matchSeparators(["+"]), precedence: [arithmeticPrecedence, arithmeticPrecedence + 1] },
  "-": { separators: matchSeparators(["-"]), precedence: [arithmeticPrecedence, arithmeticPrecedence + 1] },
  "*": { separators: matchSeparators(["*"]), precedence: [arithmeticPrecedence + 2, arithmeticPrecedence + 3] },
  "/": { separators: matchSeparators(["/"]), precedence: [arithmeticPrecedence + 2, arithmeticPrecedence + 3] },
  "%": { separators: matchSeparators(["%"]), precedence: [arithmeticPrecedence + 2, arithmeticPrecedence + 3] },
  "^": { separators: matchSeparators(["^"]), precedence: [arithmeticPrecedence + 4, arithmeticPrecedence + 5] },
  ",": { separators: matchSeparators([","]), precedence: [3, 4] },
  in: { separators: matchSeparators(["in"]), precedence: [booleanPrecedence, booleanPrecedence] },
  is: { separators: matchSeparators(["is"]), precedence: [booleanPrecedence, Infinity] },
  and: { separators: matchSeparators(["and"]), precedence: [booleanPrecedence + 1, booleanPrecedence + 1] },
  or: { separators: matchSeparators(["or"]), precedence: [booleanPrecedence, booleanPrecedence] },
  "==": { separators: matchSeparators(["=="]), precedence: [booleanPrecedence + 2, booleanPrecedence + 2] },
  "!=": { separators: matchSeparators(["!="]), precedence: [booleanPrecedence + 2, booleanPrecedence + 2] },
  "===": { separators: matchSeparators(["==="]), precedence: [booleanPrecedence + 2, booleanPrecedence + 2] },
  "!==": { separators: matchSeparators(["!=="]), precedence: [booleanPrecedence + 2, booleanPrecedence + 2] },
  "!": { separators: matchSeparators(["!"]), precedence: [null, 4] },
  ...comparisonOps
    .map((op) => {
      const definition = {
        separators: matchSeparators([op]),
        precedence: [booleanPrecedence + 3, booleanPrecedence + 3],
      };
      return [op, definition] as [string, TokenGroupDefinition];
    })
    .toObject(),
  ...comparisonOps
    .power(2)
    .map<[string, TokenGroupDefinition]>(([op1, op2]) => {
      const definition = {
        separators: matchSeparators([op1], [op2]),
        precedence: [booleanPrecedence + 3, booleanPrecedence + 3],
      };
      return [`inRange_${op1}_${op2}`, definition] as [string, TokenGroupDefinition];
    })
    .toObject(),
  as: { separators: matchSeparators(["as"]), precedence: [1, 1] },
  mut: { separators: matchSeparators(["mut"]), precedence: [null, 3] },
  "->": { separators: matchSeparators(["->"]), precedence: [Infinity, 2] },
  fn: { separators: matchSeparators(["fn"], ["->"]), precedence: [null, 2] },
  ";": { separators: matchSeparators([";", "\n"]), precedence: [semicolonPrecedence, semicolonPrecedence] },
  "#": { separators: matchSeparators(["#"]), precedence: [null, 4] },
  pin: { separators: matchSeparators(["^"]), precedence: [null, 4] },
  "...": { separators: matchSeparators(["..."]), precedence: [null, 4] },
  match: {
    separators: matchSeparators(["match"], ["{"], ["}"]),
    precedence: [null, null],
  },
  matchColon: {
    separators: matchSeparators(["match"], [":", "\n"]),
    precedence: [null, 2],
  },
  if: {
    separators: matchSeparators(["if"], [":", "\n"]),
    precedence: [null, 2],
  },
  ifElse: {
    separators: matchSeparators(["if"], [":", "\n"], ["else"]),
    precedence: [null, 2],
  },
  for: {
    separators: matchSeparators(["for"], ["in"], [":", "\n"]),
    precedence: [null, 2],
  },
  while: {
    separators: matchSeparators(["while"], [":", "\n"]),
    precedence: [null, 2],
  },
  ifBlock: {
    separators: matchSeparators(["if"], ["{"], ["}"]),
    precedence: [null, 2],
  },
  ifElseBlock: {
    separators: matchSeparators(["if"], [":", "\n"], ["else"], ["{"], ["}"]),
    precedence: [null, 2],
  },
  ifBlockElseBlock: {
    separators: matchSeparators(["if"], ["{"], ["}"], ["else"], ["{"], ["}"]),
    precedence: [null, 2],
  },
  forBlock: {
    separators: matchSeparators(["for"], ["in"], ["{"], ["}"]),
    precedence: [null, 2],
  },
  whileBlock: {
    separators: matchSeparators(["while"], ["{"], ["}"]),
    precedence: [null, 2],
  },
  break: { separators: matchSeparators(["break"]), precedence: [null, 2] },
  continue: {
    separators: matchSeparators(["continue"]),
    precedence: [null, 2],
  },
  return: { separators: matchSeparators(["return"]), precedence: [null, 2] },
  yield: { separators: matchSeparators(["yield"]), precedence: [null, 2] },
  async: { separators: matchSeparators(["async"]), precedence: [null, 2] },
  await: { separators: matchSeparators(["await"]), precedence: [null, 2] },
  parallel: { separators: matchSeparators(["|"]), precedence: [2, 2] },
  pipe: { separators: matchSeparators(["|>"]), precedence: [2, 2] },
  feed: { separators: matchSeparators(["<-"]), precedence: [2, 2] },
  "=": { separators: matchSeparators(["="]), precedence: [2, 2] },
  ":=": { separators: matchSeparators([":="]), precedence: [2, 2] },
  symbol: { separators: matchSeparators(["symbol"]), precedence: [null, null] },
  channel: { separators: matchSeparators(["channel"]), precedence: [null, null] },
  record: {
    separators: matchSeparators(["record"], ["{"], ["}"]),
    precedence: [null, null],
  },
  set: {
    separators: matchSeparators(["set"], ["{"], ["}"]),
    precedence: [null, null],
  },
  map: {
    separators: matchSeparators(["map"], ["{"], ["}"]),
    precedence: [null, null],
  },
  access: {
    separators: matchSeparators(["."]),
    precedence: [Infinity, Infinity],
  },
  accessDynamic: {
    separators: matchSeparators(["["], ["]"]),
    precedence: [Infinity, null],
  },
  import: {
    separators: matchSeparators(["import"], ["as"]),
    precedence: [null, 1],
  },
  importWith: {
    separators: matchSeparators(["import"], ["as"], ["with"]),
    precedence: [null, 1],
  },
  use: { separators: matchSeparators(["use"], ["as"]), precedence: [null, 1] },
  useWith: {
    separators: matchSeparators(["use"], ["as"], ["with"]),
    precedence: [null, 1],
  },
  export: { separators: matchSeparators(["export"]), precedence: [null, 1] },
  exportAs: {
    separators: matchSeparators(["export"], ["as"]),
    precedence: [null, 1],
  },
  external: {
    separators: matchSeparators(["external"]),
    precedence: [null, 2],
  },
  label: { separators: matchSeparators([":"]), precedence: [2, 2] },
  operator: {
    separators: matchSeparators(["operator"]),
    precedence: [null, 3],
  },
  operatorPrecedence: {
    separators: matchSeparators(["operator"], ["precedence"]),
    precedence: [null, 3],
  },
  negate: {
    separators: matchSeparators(["-"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  prefixDecrement: {
    separators: matchSeparators(["--"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  prefixIncrement: {
    separators: matchSeparators(["++"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  postfixDecrement: {
    separators: matchSeparators(["--"]),
    precedence: [3, null],
  },
  postfixIncrement: {
    separators: matchSeparators(["++"]),
    precedence: [3, null],
  },
  parens: {
    separators: matchSeparators(["("], [")"]),
    precedence: [null, null],
  },
  brackets: {
    separators: matchSeparators(["["], ["]"]),
    precedence: [null, null],
  },
  braces: {
    separators: matchSeparators(["{"], ["}"]),
    precedence: [null, null],
  },
  comment: {
    separators: matchSeparators(["//"], ["\n"]),
    precedence: [null, null],
    parse:
      () =>
      (src, i = 0) => {
        let index = i;
        while (src[index] && src[index].type !== "newline") index++;
        return [index, placeholder(), []];
      },
    drop: true,
  },
  commentBlock: {
    separators: matchSeparators(["/*"], ["*/"]),
    precedence: [null, null],
    parse:
      () =>
      (src, i = 0) => {
        let index = i;
        while (src[index] && src[index].src !== "*/") index++;
        return [index, placeholder(), []];
      },
    drop: true,
  },
  application: {
    separators: matchSeparators(),
    precedence: [Infinity, Infinity],
  },
};

export const scope = new Scope(scopeDictionary);

export const symbols = Iterator.iter([
  "->",
  "--",
  "++",
  "//",
  "/*",
  "*/",
  "!=",
  "==",
  ">=",
  "<=",
  ":=",
  "===",
  "!==",
  "...",
]);

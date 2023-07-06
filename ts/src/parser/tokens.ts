/* 
TODO: outdated

Tokenizer algorithm:

Input: 
1. source string to be parsed
2. starting index


Output:
1. Final index after parsing "token"
2. parsed "token"
3. List of errors that occurred during parsing

Instructions: 
1. if current char is `"` - parse string
  1. save current index
  2. increment current index
  3. while current char is not `"` do:
    1. if current char is `\` - increment curr index
    2. if there is no char - emit error, break loop
    3. append current char to string's value
    4. inc curr index
  4. return resulting token
2. if current char is a digit - parse number
  1. save current index
  3. while current char is a digit or `_` do:
    1. if current char is `_` followed by digit - increment curr index
    2. else if it is not followed by digit - break loop
    3. append current char to number's value
    4. inc curr index
  4. if current char is `.` followed by digit then:
    1. append current char to number's value
    2. inc curr index
    3. while current char is a digit or `_` do:
      1. if current char is `_` followed by digit - increment curr index
      2. else if it is not followed by digit - break loop
      3. append current char to number's value
      4. inc curr index
  4. return resulting token
3. if current char is whitespace char then:
  1. save current index
  2. while current char is whitespace char - inc curr index
  3. if token's source includes new line char - return "newline" token
  4. else return "whitespace" token
4. if current char is `_` or a letter then
  1. save current index
  2. while current char is `_` or alphanumeric - inc curr index
  4. return "identifier" token
5. if current char is `.` followed by digit - parse number
  1. save current index
  2. inc current index
  3. set number's value to "0."
  4. while current char is a digit or `_` do:
    1. if current char is `_` followed by digit - increment curr index
    2. else if it is not followed by digit - break loop
    3. append current char to number's value
    4. inc curr index
  4. return resulting token
6. otherwise:
  1. save current index
  2. increment current index
  3. while current char is not any of the above cases - inc curr index
  4. return "identifier" token
*/

import { ConsumeParsingResult, Parser, ParsingError, Token } from "./types";

export const parseToken: Parser<Token> = (src, i) => {
  let index = i;
  const errors: ParsingError[] = [];

  if (/\s/.test(src.charAt(index))) {
    const start = index;
    while (/\s/.test(src.charAt(index))) index++;
    const _src = src.substring(start, index);
    if (_src.includes("\n")) return [index, { type: "newline", src: _src }, errors];
  }

  if (src.charAt(index) === '"') {
    const start = index;
    index++;

    let value = "";
    while (src.charAt(index) !== '"') {
      if (src.charAt(index) === "\\") index++;
      if (!src.charAt(index)) {
        errors.push({ message: "unterminated string: end of text" });
        break;
      }
      value += src.charAt(index);
      index++;
    }
    index++;

    return [index, { type: "string", src: src.substring(start, index), value }, errors];
  }

  if (/\d/.test(src.charAt(index))) {
    const start = index;

    let value = "";
    while (/[_\d]/.test(src.charAt(index))) {
      while (src.charAt(index) === "_") {
        index++;
      }
      value += src.charAt(index);
      index++;
    }
    if (src.charAt(index) === ".") value += src.charAt(index++);
    if (/\d/.test(src.charAt(index))) {
      value += src.charAt(index);
      index++;
      while (/[_\d]/.test(src.charAt(index))) {
        while (src.charAt(index) === "_") {
          index++;
        }
        value += src.charAt(index);
        index++;
      }
    }

    return [index, { type: "number", src: src.substring(start, index), value: Number(value) }, errors];
  }

  if (/[_\w]/.test(src.charAt(index))) {
    const start = index;
    while (/[_\w\d]/.test(src.charAt(index))) index++;

    return [index, { type: "identifier", src: src.substring(start, index) }, errors];
  }

  if (src.charAt(index) === "." && /\d/.test(src.charAt(index + 1))) {
    const start = index;
    index++;
    let value = "0.";
    while (/[_\d]/.test(src.charAt(index))) {
      while (src.charAt(index) === "_") {
        index++;
      }
      value += src.charAt(index);
      index++;
    }

    return [index, { type: "number", src: src.substring(start, index), value: Number(value) }, errors];
  }

  const start = index;
  index++;
  while (/[^_\w\s\d."]/.test(src.charAt(index))) index++;

  return [index, { type: "identifier", src: src.substring(start, index) }, errors];
};

export const parseTokens = (src: string, i: number): ConsumeParsingResult<Token[]> => {
  let index = i;
  const errors: ParsingError[] = [];
  const tokens: Token[] = [];

  while (src.charAt(index)) {
    const [nextIndex, token, _errors] = parseToken(src, index);

    index = nextIndex;
    tokens.push(token);
    errors.push(..._errors);
  }

  return [tokens, errors];
};

export const stringifyToken = (item: Token): string => {
  if (item.type === "newline") return item.type;
  return item.src;
};

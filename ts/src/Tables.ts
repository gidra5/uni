import { TokenTypes, TokenDriver } from "./TokenDriver";
import { TextDriver, specialChars } from "./TextDriver";
import { NodeTypes } from "./SyntaxParser";

export const letter = /\p{L}/u;
export const digit = /\p{Nd}/u;
export const alphanumeric =/[\p{L}\p{Nd}]/u;

// export const literals:                  Map<LiteralTypes     , (driver: TokenDriver) => any     > = new Map();
// export const stringLiteralSpecialChars: Map<string          , (driver: TextDriver)  => any      > = new Map();
export const nodeProcedures:            Map<NodeTypes, (...args: any[]) => any> = new Map();
export const tokenTypeParsers:          Map<TokenTypes      , (driver: TextDriver)  => boolean  > = new Map();
export const dictionary: { maxWordLength: number, [key: string]: TokenTypes } = new Proxy({
    maxWordLength: 2,
    ["g"]: TokenTypes.Keyword,
    [","]: TokenTypes.Separator,
    ["|"]: TokenTypes.Separator,
    ["=>"]: TokenTypes.Separator,
    ["("]: TokenTypes.Grouping,
    [")"]: TokenTypes.Grouping,
    ["\""]: TokenTypes.Grouping,
    ["+"]: TokenTypes.Operator,
    ["-"]: TokenTypes.Operator,
    ["\\"]: TokenTypes.Operator
}, {
    set(obj, prop, val) {
        obj[prop] = val;

        if (typeof prop === "string")
            obj.maxWordLength = Math.max(obj.maxWordLength, (prop as string).length);

        return true;
    }
});

// tokenTypeValues.set(TokenTypes.Operator  , new Map<string, (...operands: any) => any>());
// tokenTypeValues.set(TokenTypes.Name      , new Map<string, any>());

// tokenTypeValues.get(TokenTypes.Name)?.set("identifier", new Grammar([letter, digit], ["L"], [
//     [["S"], [letter, "L"]],
//     [["L"], [digit, "L"]],
//     [["L"], [letter, "L"]]
// ]));
// tokenTypeValues.get(TokenTypes.Name)?.set("number", new Grammar([/\p{Nd}+(.\p{Nd}*)?/u], [], [
//     [["S"], [/\p{Nd}+.\p{Nd}*/u]]
// ]));

// literals.set(LiteralTypes.String, (driver: TokenDriver): string => {
//     let str: string = "";

//     driver.assertStringAndMove("\"", "expected opening bracket");

//     while (driver.currentChar !== "\"") {
//         if (driver.currentChar === "\\") {
//             driver.nextChar();
//             const parser = stringLiteralSpecialChars.get(driver.currentChar);
//             if (parser === undefined) throw new Error("failed to get parser for special char " + driver.currentChar)
//             parser(driver);
//         }

//         str += driver.currentChar;
//         driver.nextChar();
//     }
//     driver.nextChar();

//     return str;
// });

// tokenTypeParsers.set(TokenTypes.Identifier, (driver: TextDriver): [val: string, length: number, type: TokenTypes] => {
//     const start = driver.currentCharPos;
//     let id = driver.currentChar;
//     driver.nextChar();

//     while (alphanumeric.test(driver.currentChar)) { //check if char is a letter or a digit
//         id += driver.currentChar;
//         driver.nextChar();
//     }

//     let idType;
//     const identifierTypes = Object.keys(TokenTypes)
//         .filter(k => typeof TokenTypes[k] === "number")
//         .map(k => TokenTypes[k]);

//     for (const type of identifierTypes) {
//         if (tokenTypeValues.get(type)?.has(id)) { idType = type; break; }
//     }

//     return [id, driver.currentCharPos - start, idType];
// });

tokenTypeParsers.set(TokenTypes.Name, (driver: TextDriver): boolean => {
    if (alphanumeric.test(driver.currentChar)) {
        driver.nextChar();
    } else return false;

    while (alphanumeric.test(driver.currentChar)) {
        driver.nextChar();
    }

    return true;
});

tokenTypeParsers.set(TokenTypes.None, (driver: TextDriver): boolean => {
    driver.nextChar();
    return true;
});

// tokenTypeParsers.set(TokenTypes.Literal, (driver: TokenDriver): Literal => {
//     const literalTokenTypes = Object.keys(LiteralTypes)
//         .filter(k => typeof LiteralTypes[k] === "number")
//         .map(k => LiteralTypes[k]);

//     let lit: Literal | undefined = undefined;

//     for (const literalTokenType of literalTokenTypes) {
//         const parser = literals.get(literalTokenType);
//         if (parser === undefined) throw new Error("failed to get literal parser");

//         const parsed = parser(driver);
//         if (parsed) {
//             lit = [literalTokenType, parsed];
//             break;
//         }
//     }

//     if (lit === undefined) throw new Error("failed to parse literal");

//     return lit;
// });
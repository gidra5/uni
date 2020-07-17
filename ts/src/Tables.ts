import { letter, digit, alphanumeric, TokenTypes, TokenDriver } from "./TokenDriver";
import { Grammar } from "./Grammar";
import { TextDriver } from "./TextDriver";
import { assertStringAndMove } from "./Helper";
import { LiteralTypes } from "./SyntaxParser";
type Literal = [type: LiteralTypes, val: any];

export const literals:                  Map<LiteralTypes     , (driver: TokenDriver) => any> = new Map();
export const stringLiteralSpecialChars: Map<string           , (driver: TextDriver) => any> = new Map();
export const tokenTypeParsers:          Map<TokenTypes       , (driver: TextDriver) => any> = new Map();
export const identifierTypeValues:      Map<TokenTypes  , Map<string, any>           > = new Map();

identifierTypeValues.set(TokenTypes.Keyword   , new Map<string, any>());
identifierTypeValues.set(TokenTypes.Separator , new Map<string, any>());
identifierTypeValues.set(TokenTypes.Grouping  , new Map<string, any>());
identifierTypeValues.set(TokenTypes.Operator  , new Map<string, (...operands: any) => any>());
identifierTypeValues.set(TokenTypes.Name      , new Map<string, any>());

identifierTypeValues.get(TokenTypes.Name)?.set("identifier", new Grammar([letter, digit], ["L"], [
    [["S"], [letter, "L"]],
    [["L"], [digit, "L"]],
    [["L"], [letter, "L"]]
]));
identifierTypeValues.get(TokenTypes.Name)?.set("number", new Grammar([/\p{Nd}+.\p{Nd}*/u], [], [
    [["S"], [/\p{Nd}+.\p{Nd}*/u]]
]));

identifierTypeValues.get(TokenTypes.Keyword)?.set("g", undefined);
identifierTypeValues.get(TokenTypes.Separator)?.set(",", undefined);
identifierTypeValues.get(TokenTypes.Separator)?.set("|", undefined);
identifierTypeValues.get(TokenTypes.Separator)?.set("=>", undefined);
identifierTypeValues.get(TokenTypes.Grouping)?.set("()", undefined);

literals.set(LiteralTypes.String, (driver: TokenDriver): string => {
    let str: string = "";

    assertStringAndMove(driver, "\"", "expected opening bracket");

    while (driver.currentChar !== "\"") {
        if (driver.currentChar === "\\") {
            driver.nextChar();
            const parser = stringLiteralSpecialChars.get(driver.currentChar);
            if (parser === undefined) throw new Error("failed to get parser for special char " + driver.currentChar)
            parser(driver);
        }

        str += driver.currentChar;
        driver.nextChar();
    }
    driver.nextChar();

    return str;
});

tokenTypeParsers.set(TokenTypes.Identifier, (driver: TextDriver): [val: string, length: number, type: TokenTypes] => {
    const start = driver.currentCharPos;
    let id = driver.currentChar;
    driver.nextChar();

    while (alphanumeric.test(driver.currentChar)) { //check if char is a letter or a digit
        id += driver.currentChar;
        driver.nextChar();
    }

    let idType;
    const identifierTypes = Object.keys(TokenTypes)
        .filter(k => typeof TokenTypes[k] === "number")
        .map(k => TokenTypes[k]);

    for (const type of identifierTypes) {
        if (identifierTypeValues.get(type)?.has(id)) { idType = type; break; }
    }

    return [id, driver.currentCharPos - start, idType];
});

tokenTypeParsers.set(TokenTypes.Keyword, (driver: TextDriver): boolean => {
    let str = tokenTypeParsers.get(TokenTypes.Identifier);

    if (str === undefined) throw new Error("failed to get identifier parser");
    const word = str(driver)[0];

    return !!identifierTypeValues.get(TokenTypes.Keyword)?.has(word);
});

tokenTypeParsers.set(TokenTypes.Separator, (driver: TextDriver): boolean => {
    const separator = driver.currentChar;
    driver.nextChar();

    return !!identifierTypeValues.get(TokenTypes.Separator)?.has(separator);
});

tokenTypeParsers.set(TokenTypes.Operator, (driver: TextDriver): boolean => {
    const operator = driver.currentChar;
    driver.nextChar();

    return !!identifierTypeValues.get(TokenTypes.Operator)?.has(operator);
});

tokenTypeParsers.set(TokenTypes.Literal, (driver: TokenDriver): Literal => {
    const literalTokenTypes = Object.keys(LiteralTypes)
        .filter(k => typeof LiteralTypes[k] === "number")
        .map(k => LiteralTypes[k]);

    let lit: Literal | undefined = undefined;

    for (const literalTokenType of literalTokenTypes) {
        const parser = literals.get(literalTokenType);
        if (parser === undefined) throw new Error("failed to get literal parser");

        const parsed = parser(driver);
        if (parsed) {
            lit = [literalTokenType, parsed];
            break;
        }
    }

    if (lit === undefined) throw new Error("failed to parse literal");

    return lit;
});
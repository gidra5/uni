import { TokenDriver } from "./TokenDriver";
import { TextDriver, specialChars } from "./TextDriver";
import { ParseTree, parse, ParseContextInfo, ParserInput } from "./SyntaxParser";
import { DynamicEnum } from "../Utility/Helper";
import { textDrivers } from "../main/ArgumentsTranslator";

export const letter = /\p{L}/u;
export const digit = /\p{Nd}/u;
export const alphanumeric = /[\p{L}\p{Nd}]/u;

export const TypesOf = new DynamicEnum([], 0);
TypesOf.Tokens = new DynamicEnum([
    "Keyword",
    "Grouping",
    "Separator",
    "Operator",
    "String",
    "Name",
    "Skip",
    "None",
]);
TypesOf.Nodes = new DynamicEnum([
    "Program",
    "GrammarDecl",
    "Rule",
    "Code",
    "Group",
]);
TypesOf.Literals = new DynamicEnum([]);
type Parser = (driver: TokenDriver, params?: any[]) => ParseTree | undefined;

const stringLiteralSpecialChars: { [key: string]: (driver: TextDriver) => string } = {};
// export const nodeProcedures: { [type: number]: (...args: (ParseTree | number)[]) => void } = {};
export const nodeParsers:    { [type: number]: Parser } = {};
export const tokenParsers:   { [type: number]: (driver: TextDriver) => string | undefined } = {};
export const dictionary: { maxWordLength: number, [str: string]: number } = new Proxy({
    maxWordLength: 3,
    [specialChars.space]:   TypesOf.Tokens.Skip,
    [specialChars.tab]:     TypesOf.Tokens.Skip,
    [specialChars.EOL]:     TypesOf.Tokens.Skip,
    ["g"]:                  TypesOf.Tokens.Keyword,
    [","]:                  TypesOf.Tokens.Separator,
    ["|"]:                  TypesOf.Tokens.Separator,
    ["("]:                  TypesOf.Tokens.Grouping,
    [")"]:                  TypesOf.Tokens.Grouping,
    ["=>"]:                 TypesOf.Tokens.Operator,
    ["+"]:                  TypesOf.Tokens.Operator,
    ["-"]:                  TypesOf.Tokens.Operator,
}, {
    set(obj, prop, val) {
        obj[prop as number | string] = val;

        if (typeof prop === "string")
            obj.maxWordLength = Math.max(obj.maxWordLength, (prop as string).length);

        return true;
    }
});

// tokenTypeValues.set(TokenTypes.Operator  , new Map<string, (...operands: any) => any>());
// tokenTypeValues.set(TokenTypes.Name      , new Map<string, any>());

tokenParsers[TypesOf.Tokens.String] = (driver: TextDriver): string | undefined => {
    let str: string = "";

    if (driver.currentChar !== "\"") return;
    else driver.nextChar();

    while (driver.currentChar !== "\"") {
        if (driver.currentChar === "\\") {
            driver.nextChar();
            const parser = stringLiteralSpecialChars[driver.currentChar]
                || (driver => { const res = driver.currentChar; driver.nextChar(); return res; });
            const parsed = parser(driver);
            str += parsed;
        } else {
            str += driver.currentChar;
            driver.nextChar();
        }
    }
    driver.nextChar();

    return str;
};

tokenParsers[TypesOf.Tokens.Name] = (driver: TextDriver): string | undefined => {
    const beginPos = driver.currentCharPos;
    if (alphanumeric.test(driver.currentChar))
        driver.nextChar();
    else return;

    while (alphanumeric.test(driver.currentChar))
        driver.nextChar();

    return driver.src.slice(beginPos, driver.currentCharPos);
};

tokenParsers[TypesOf.Tokens.None] = (driver: TextDriver): string | undefined => {
    const beginPos = driver.currentCharPos;
    driver.nextChar();
    return driver.src.slice(beginPos, driver.currentCharPos);
};

tokenParsers[TypesOf.Tokens.Skip] = (driver: TextDriver): string | undefined => {
    const beginPos = driver.currentCharPos;
        if (driver.nextString(2) === "//") {
            driver.nextChar(2);
            while (driver.currentChar !== specialChars.EOL) {
                driver.nextChar();
            }
        } else if (driver.nextString(2) === "/*") {
            driver.nextChar(2);
            while (driver.nextString(2) !== "*/") {
                driver.nextChar();
            }
            driver.nextChar(2);
        } else return;

    return driver.src.slice(beginPos, driver.currentCharPos);
};

nodeParsers[TypesOf.Nodes.Program] = (driver: TokenDriver): ParseTree => {
    const pt: ParseTree = [[TypesOf.Nodes.Program, driver.currentTokenPos, driver]];
    const parseContext: ParseContextInfo = { driver, parent: pt };

    while (driver.currentToken[1] !== specialChars.EOT)
        parse(parseContext, [TypesOf.Nodes.GrammarDecl, TypesOf.Nodes.Rule, TypesOf.Nodes.Code, TypesOf.Tokens, TypesOf.Literals]);

    return pt;
};

nodeParsers[TypesOf.Nodes.GrammarDecl] = (driver: TokenDriver): ParseTree | undefined => {
    const pt: ParseTree = [[TypesOf.Nodes.GrammarDecl, driver.currentTokenPos]];
    const parseContext: ParseContextInfo = { driver, parent: pt };

    //if at one of the points it fails return from parser (implicit undefined)
    if (!parse({ ...parseContext, parserParams: ["g"] }, TypesOf.Tokens.Keyword)
        || !parse({ ...parseContext, parserParams: [[TypesOf.Tokens.Name, TypesOf.Literals.String], "(,)"] },
            TypesOf.Nodes.Group)
        || !parse({ ...parseContext, parserParams: [TypesOf.Tokens.Name, "(,)"] }, TypesOf.Nodes.Group)
        || !parse({ ...parseContext, parserParams: [TypesOf.Nodes.Rule, "(,)"] }, TypesOf.Nodes.Group)
        || !parse(parseContext, TypesOf.Tokens.Name)
    ) return;

    return pt;
}

//grouping string format - (left brace)(separator)(right brace)
nodeParsers[TypesOf.Nodes.Group] = (driver: TokenDriver,
    params?: [groupElementsType?: ParserInput, groupingString?: string, ...rest: any[]]): ParseTree | undefined => {
    if (!params) return;

    const pt: ParseTree = [[TypesOf.Nodes.Group, driver.currentTokenPos]];
    const parseContext: ParseContextInfo = { driver, parent: pt };

    if (!parse({ ...parseContext, parserParams: [params[1]?.charAt(0)] }, TypesOf.Tokens.Grouping)) return;

    if (parse(parseContext, params[0])) {
        while (parse({ ...parseContext, parserParams: [params[1]?.charAt(1)] }, TypesOf.Tokens.Separator))
            parse(parseContext, TypesOf.Nodes.values.filter(v => ![TypesOf.Nodes.Program].includes(v)));
    }

    if (!parse({ ...parseContext, parserParams: [params[1]?.charAt(2)] }, TypesOf.Tokens.Grouping)) return;

    return pt;
}

nodeParsers[TypesOf.Nodes.Rule] = (driver: TokenDriver): ParseTree => {
    const pt: ParseTree = [[TypesOf.Nodes.Rule, driver.currentTokenPos]];
    const parseContext: ParseContextInfo = { driver, parent: pt };

    while (parse(parseContext, TypesOf.Tokens.Name))
        continue;

    parse(parseContext, TypesOf.Tokens.Name);

    while (parse(parseContext, TypesOf.Tokens.Name))
        continue;

    parse({ ...parseContext, parserParams: ["=>"]}, TypesOf.Tokens.Operator);

    while (parse(parseContext, TypesOf.Tokens.Name))
        continue;

    return pt;
}
// nodeParsers[TypesOf.Nodes.Code] = (driver: TokenDriver): ParseTree => {
//     return
// }
import { TokenDriver } from "./TokenDriver";
import { TextDriver, specialChars } from "./TextDriver";
import { ParseTree, parse } from "./SyntaxParser";
import { DynamicEnum } from "../Utility/Helper";

export const letter = /\p{L}/u;
export const digit = /\p{Nd}/u;
export const alphanumeric = /[\p{L}\p{Nd}]/u;

export const TypesOf = new DynamicEnum([], 0);
TypesOf.Tokens = new DynamicEnum([
    "Keyword",
    "Grouping",
    "Separator",
    "Operator",
    "Name",
    "Skip",
    "None",
]);
TypesOf.Nodes = new DynamicEnum([
    "Program",
    "GrammarDecl",
    "Rule",
    "RuleLeft",
    "RuleRight",
    "Literal",
    "Code",
    "Group",
]);
TypesOf.Literals = new DynamicEnum([
    "String"
]);

// export const stringLiteralSpecialChars: Map<string          , (driver: TextDriver)  => any      > = new Map();
export const nodeProcedures: { [type: number]: (...args: (ParseTree | number)[]) => void } = {};
export const literalParsers: { [type: number]: (driver: TokenDriver) => ParseTree | undefined } = {};
export const nodeParsers:    { [type: number]: (driver: TokenDriver) => ParseTree | undefined } = {};
export const tokenParsers:   { [type: number]: (driver: TextDriver) => boolean } = {};
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
    ["\""]:                 TypesOf.Tokens.Grouping,
    ["=>"]:                 TypesOf.Tokens.Oper,
    ["+"]:                  TypesOf.Tokens.Operator,
    ["-"]:                  TypesOf.Tokens.Operator,
    ["\\"]:                 TypesOf.Tokens.Operator
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

tokenParsers[TypesOf.Tokens.Name] = (driver: TextDriver): boolean => {
    if (alphanumeric.test(driver.currentChar))
        driver.nextChar();
    else return false;

    while (alphanumeric.test(driver.currentChar))
        driver.nextChar();

    return true;
};

tokenParsers[TypesOf.Tokens.None] = (driver: TextDriver): boolean => {
    driver.nextChar();
    return true;
};

tokenParsers[TypesOf.Tokens.Skip] = (driver: TextDriver): boolean => {
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
        } else return false;

        return true;

};

nodeParsers[TypesOf.Nodes.Program] = (driver: TokenDriver): ParseTree => {
    const pt: ParseTree = [[TypesOf.Nodes.Program, driver.currentTokenPos, driver], undefined];

    while (driver.currentToken[1] !== specialChars.EOT) {
        parse(driver, TypesOf.Nodes.GrammarDecl, pt);
        parse(driver, TypesOf.Nodes.Code, pt);
    }

    return pt;
};

nodeParsers[TypesOf.Nodes.GrammarDecl] = (driver: TokenDriver): ParseTree | undefined => {
    const pt: ParseTree = [[TypesOf.Nodes.GrammarDecl, driver.currentTokenPos], undefined];

    parse(driver, TypesOf.Nodes.Group, pt);
    parse(driver, TypesOf.Nodes.Group, pt);
    parse(driver, TypesOf.Nodes.Group, pt);
    parse(driver, TypesOf.Tokens.Name, pt);

    return pt;
}

nodeParsers[TypesOf.Nodes.Group] = (driver: TokenDriver): ParseTree => {
    const pt: ParseTree = [[TypesOf.Nodes.Group, driver.currentTokenPos], undefined];

    parse(driver, TypesOf.Tokens.Grouping, pt);
    parse(driver, TypesOf.Nodes.values.filter(v => ![
        TypesOf.Nodes.Program, TypesOf.Nodes.RuleLeft, TypesOf.Nodes.RuleRight].includes(v)), pt);

    while (parse(driver, TypesOf.Tokens.Separator, pt))
        parse(driver, TypesOf.Nodes.values.filter(v => ![
            TypesOf.Nodes.Program, TypesOf.Nodes.RuleLeft, TypesOf.Nodes.RuleRight].includes(v)), pt);

    parse(driver, TypesOf.Tokens.Grouping, pt);

    return pt;
}
nodeParsers[TypesOf.Nodes.Rule] = (driver: TokenDriver): ParseTree => {
    const pt: ParseTree = [[TypesOf.Nodes.Rule, driver.currentTokenPos], undefined];

    parse(driver, TypesOf.Nodes.RuleLeft, pt);
    parse(driver, TypesOf.Tokens.Separator, pt);
    parse(driver, TypesOf.Nodes.RuleRight, pt);

    return pt;
}
nodeParsers[TypesOf.Nodes.RuleLeft] = (driver: TokenDriver): ParseTree => {
    const pt: ParseTree = [[TypesOf.Nodes.RuleLeft, driver.currentTokenPos], undefined];

    while (parse(driver, TypesOf.Tokens.Name, pt))
        continue;

    parse(driver, TypesOf.Tokens.Name, pt);

    while (parse(driver, TypesOf.Tokens.Name, pt))
        continue;

    return pt;
}
nodeParsers[TypesOf.Nodes.RuleRight] = (driver: TokenDriver): ParseTree => {
    const pt: ParseTree = [[TypesOf.Nodes.RuleRight, driver.currentTokenPos], undefined];

    while (parse(driver, TypesOf.Tokens.Name, pt))
        continue;

    return pt;
}
// nodeParsers[TypesOf.Nodes.Code] = (driver: TokenDriver): ParseTree => {
//     return
// }
// nodeParsers[TypesOf.Nodes.Literal] = (driver: TokenDriver): AbstractSyntaxTree | undefined => {
//     const pt: AbstractSyntaxTree = [[TypesOf.Nodes.Literal, driver.currentTokenPos], undefined];

//     for (const literalType of TypesOf.Literals.values) {
//         const literal = literalParsers[literalType](driver);
//     }

//     return pt;
// }

// literalParsers[TypesOf.Literals.String] = (driver: TokenDriver): AbstractSyntaxTree => {
//     const pt: AbstractSyntaxTree = [[TypesOf.Nodes.Literal, driver.currentTokenPos], undefined];

//     parse(driver, pt, TypesOf.Nodes.Group);

//     return pt;
// }
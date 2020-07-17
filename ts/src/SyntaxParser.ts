import { TokenDriver, Token, TokenTypes } from "./TokenDriver";
import { specialChars } from "./TextDriver";
import { checkCurrToken } from "./Helper";
import { Rule, Grammar } from "./Grammar";
import { Error } from "./Error";
import { AST } from "./AST";

export enum LiteralTypes { String, Rule };

function Arr(driver: TokenDriver, element: TokenTypes) {
    const elements: Token[] = [];

    checkCurrToken(driver, "(", "expected opening bracket of Array");

    checkCurrToken(driver, element, "expected token of type");
    elements.push(driver.currentToken);

    while (driver.currentToken[1] === ',') {
        driver.nextToken();
        checkCurrToken(driver, element, "expected token of type");
        elements.push(driver.currentToken);
    }

    checkCurrToken(driver, ")", "expected closing bracket of Array");

    return elements;
}

function rule(driver: TokenDriver): Rule[] {
    const rules: Rule[] = [];
    const lhs: Token[] = [];

    checkCurrToken(driver, [TokenTypes.Name, specialChars.EOT], "expected identifier or string of rule");
    checkCurrToken(driver, [LiteralTypes.String, specialChars.EOT], "expected identifier or string of rule");
    lhs.push(driver.currentToken);
    driver.nextToken();
    while (driver.currentToken[1] == '-') {
        driver.nextToken();
        checkCurrToken(driver, [TokenTypes.Name, specialChars.EOT], "expected identifier or string of rule");
        checkCurrToken(driver, [LiteralTypes.String, specialChars.EOT], "expected identifier or string of rule");
        lhs.push(driver.currentToken);
    }

    checkCurrToken(driver, "=>", "incorrect syntax of rule");

    const r: Rule = [[], []];
    r[0] = lhs;
    driver.nextToken();
    r[1].push(driver.currentToken);
    rules.push(r);
    while (["-", "|"].includes(driver.currentToken[1])) {
        if (driver.currentToken[1] === "-") {
            driver.nextToken();
            rules[rules.length - 1][1].push(driver.currentToken);
        } else if (driver.currentToken[1] === "|") {
            driver.nextToken();
            const r: Rule = [[], []];
            r[0] = lhs;
            r[1].push(driver.currentToken);
            rules.push(r);
        }
    }

    return rules;
}

function grammar(driver: TokenDriver): [string, Grammar] {
    driver.nextToken();
    const name = driver.currentToken[0] === TokenTypes.Name ?
        driver.currentToken[1] : Error(driver, "expected name");
    const grammar: Grammar = new Grammar();

    checkCurrToken(driver, "(", "expected opening bracket");
    driver.nextToken();
    grammar[0] = Arr(driver, LiteralTypes.String);

    checkCurrToken(driver, ",", "expected set of identifiers");
    driver.nextToken();
    grammar[1] = Arr(driver, TokenTypes.Name);

    checkCurrToken(driver, ",", "expected set of rules");
    driver.nextToken();
    grammar[2] = Arr(driver, LiteralTypes.Rule).flat();

    checkCurrToken(driver, ",", "expected a nextToken");
    driver.nextToken();
    grammar[3] = driver.currentToken;

    checkCurrToken(driver, ")", "expected closing bracket");

    return [name, grammar];
}


export function syntaxParser(tokenizedSrc: TokenDriver): AST {

}
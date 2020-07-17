import { tokenTypeParsers } from "./Tables";
import { specialChars, TextDriver } from "./TextDriver";

export enum TokenTypes { Comment, Keyword, Grouping, Separator, Operator, Name, None };
const ignoredChars = [specialChars.space, specialChars.tab, specialChars.EOL];

export const EOTToken: Token = [TokenTypes.None, specialChars.EOT];
export const letter = /\p{L}/u;
export const digit = /\p{Nd}/u;
export const alphanumeric = /[\p{L}, \p{Nd}]/u;

export type Token = [type: TokenTypes, value: any]; // | RegExp | string;
export type TokenExtended = [token: Token, src: string];
export type TokenInfo = [pos: number, line: number, linePos: number];
export type TokenWithInfo = [...token: TokenExtended, ...info: TokenInfo];

export class TokenDriver {
    currentTokenPos = 0;
    currentToken: Token = EOTToken;
    file: string;
    src: string;
    tokenized: TokenWithInfo[] = [];

    //goes through src-code once and generates Tokens from it
    constructor(driver: TextDriver) {
        while (driver.currentChar !== specialChars.EOT) {
            while (ignoredChars.includes(driver.currentChar)) driver.nextChar();
            const tokenInfo: TokenWithInfo = [EOTToken, "",
                driver.currentCharPos, driver.currentCharLine, driver.currentCharLinePos];

            const tokenClasses = Object.keys(TokenTypes)
                .filter(k => typeof TokenTypes[k] === "number" || TokenTypes[k] === "None")
                .map(k => TokenTypes[k]);

            for (const tokenType of tokenClasses) {
                const parser = tokenTypeParsers.get(tokenType);
                if (parser) {
                    const parsed = parser(driver);
                    if (parsed) {
                        tokenInfo[0] = [tokenType, parsed];
                        tokenInfo[1] = driver.src.slice(tokenInfo[2], driver.currentCharPos);
                        break;
                    }
                }
            }

            this.tokenized.push(tokenInfo);
        }

        this.currentToken = this.tokenized[this.currentTokenPos][0];
        this.file = driver.file;
        this.src = driver.src;
    }

    nextToken(step: number = 1) {
        this.currentTokenPos += step;
        this.currentToken = this.tokenized[this.currentTokenPos][0];
    };
}

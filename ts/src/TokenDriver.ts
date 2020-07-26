//groupings make scope trees
export enum TokenTypes { Keyword, Grouping, Separator, Operator, Name, None };

import { tokenTypeParsers, dictionary, alphanumeric } from "./Tables";
import { specialChars, TextDriver } from "./TextDriver";
import { currLogLevel, LogLevels } from "./Error";

export const ignoredChars = [specialChars.space, specialChars.tab, specialChars.EOL];

export const EOTToken: Token = [TokenTypes.None, specialChars.EOT];

export type Token = [type: TokenTypes, src: string];
export type TokenInfo = [pos: number, line: number, linePos: number];
export type TokenExtended = [...token: Token, ...info: TokenInfo];

export class TokenDriver {
    currentTokenPos = 0;
    currentToken: TokenExtended = [...EOTToken, 0, 0, 0];
    file: string;
    src: string;
    tokenized: TokenExtended[] = [];

    //goes through src-code once and generates Tokens from it
    constructor(driver: TextDriver) {
        const comment = () => {
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
        }

        while (driver.currentChar !== specialChars.EOT) {
            //evading useless chars and comments
            comment();
            while (ignoredChars.includes(driver.currentChar)) {
                driver.nextChar();
                while (comment()) { }
            }

            const tokenInfo: TokenExtended = [...EOTToken,
                driver.currentCharPos, driver.currentCharLine, driver.currentCharLinePos];

            //checking if next string is in dictionary
            const str = driver.nextString(dictionary.maxWordLength);

            for (let i = 1; i <= dictionary.maxWordLength; ++i) {
                const substr = str.substring(0, i);

                if (dictionary[substr] !== undefined) {
                    if (dictionary[substr] === TokenTypes.Keyword &&
                        alphanumeric.test(driver.nextString(i + 1).slice(i)))
                            continue;

                    tokenInfo[0] = dictionary[substr];
                    tokenInfo[1] = substr;
                    driver.nextChar(i);
                    break;
                }
            }

            if (tokenInfo[0] !== TokenTypes.None) {
                this.tokenized.push(tokenInfo); continue;
            }

            //if it wasn't in dictionary check other types of tokens
            const tokenTypes = Object.keys(TokenTypes)
                .filter(k => typeof TokenTypes[k] === "number")
                .map(k => TokenTypes[k]);

            for (const tokenType of tokenTypes) {
                const parser = tokenTypeParsers.get(tokenType);
                if (parser) {
                    const parsed = parser(driver);
                    if (parsed) {
                        tokenInfo[0] = tokenType;
                        tokenInfo[1] = driver.src.slice(tokenInfo[2], driver.currentCharPos);
                        break;
                    } else //if failed return back charPos
                        driver.nextChar(tokenInfo[2] - driver.currentCharPos);
                }
            }
            
            this.tokenized.push(tokenInfo);
        }

        this.currentToken = this.tokenized[this.currentTokenPos];
        this.file = driver.file;
        this.src = driver.src;
    }

    nextToken(step: number = 1) {
        this.currentTokenPos += step;
        this.currentToken = this.tokenized[this.currentTokenPos];
    };

    checkCurrToken(driver: TokenDriver, expected: Token, err: string): boolean {
        if (driver.currentToken[1] !== expected[1] || driver.currentToken[0] !== expected[0]) {
            driver.warning(err);
            return false;
        }

        return true;
    }

    error(msg: string) {
        const currToken = this.tokenized[this.currentTokenPos];
        console.log(`Error in file ${this.file} at pos ${currToken[2]}
            line ${currToken[3] + 1}: ${msg}\n
            ${this.src.split(specialChars.EOL)[currToken[3]]}\n`);
        for (let i = 0; i < currToken[1].length; ++i) {
            console.log(`\u001b[${currToken[4] + i}C^`);
        }

        process.exit();
    }

    warning(msg: string) {
        if (currLogLevel > LogLevels.Warn) return;

        const currToken = this.tokenized[this.currentTokenPos];
        console.log(`Error in file ${this.file} at pos ${currToken[2]}
            line ${currToken[3] + 1}: ${msg}\n
            ${this.src.split(specialChars.EOL)[currToken[3]]}\n`);
        for (let i = 0; i < currToken[1].length; ++i) {
            console.log(`\u001b[${currToken[4] + i}C^`);
        }
    }
}

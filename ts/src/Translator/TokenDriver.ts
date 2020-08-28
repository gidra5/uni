import { tokenParsers, dictionary, alphanumeric, TypesOf } from "./Tables";
import { specialChars, TextDriver } from "./TextDriver";
import { currLogLevel, LogLevels } from "../Utility/Error";

export const ignoredChars = [specialChars.space, specialChars.tab, specialChars.EOL];

export type Token = [type: number, src: string];
export type TokenInfo = [pos: number, line: number, linePos: number];
export type TokenExtended = [...token: Token, ...info: TokenInfo];

export const EOTToken: Token = [TypesOf.Tokens.None, specialChars.EOT];

export class TokenDriver {
    currentTokenPos = 0;
    currentToken: TokenExtended = [...EOTToken, 0, 0, 0];
    file: string;
    src: string;
    tokenized: TokenExtended[] = [];

    //goes through src-code once and generates Tokens from it
    constructor(driver: TextDriver) {
        while (driver.currentChar !== specialChars.EOT) {
            const tokenInfo: TokenExtended = [...EOTToken,
                driver.currentCharPos, driver.currentCharLine, driver.currentCharLinePos];

            //checking if next string is in dictionary
            const str = driver.nextString(dictionary.maxWordLength);

            for (let i = 1; i <= dictionary.maxWordLength; ++i) {
                const substr = str.substring(0, i);

                if (dictionary[substr] !== undefined) {
                    if (dictionary[substr] === TypesOf.Tokens.Keyword &&
                        alphanumeric.test(driver.nextString(i + 1).slice(i)))
                            continue;

                    tokenInfo[0] = dictionary[substr];
                    tokenInfo[1] = substr;
                    driver.nextChar(i);
                    break;
                }
            }
            // console.log(tokenInfo);

            if (tokenInfo[0] === TypesOf.Tokens.None) {
                //if it wasn't in dictionary check other types of tokens
                // const tokenTypes = Object.keys(TypesOf.Token)
                //     .filter(k => typeof TypesOf.Token[k] === "number")
                //     .map(k => TypesOf.Token[k]);

                for (const tokenType of TypesOf.Tokens.values) {
                    const parser = tokenParsers[tokenType];
                    if (!parser) continue;
                    const parsed = parser(driver);
                    if (parsed) {
                        tokenInfo[0] = tokenType;
                        tokenInfo[1] = driver.src.slice(tokenInfo[2], driver.currentCharPos);
                        break;
                    } else //if failed return back charPos
                        driver.nextChar(tokenInfo[2] - driver.currentCharPos);
                }
            }

            if (tokenInfo[0] !== TypesOf.Tokens.Skip)
                this.tokenized.push(tokenInfo);
        }

        this.currentToken = this.tokenized[this.currentTokenPos];
        this.file = driver.file;
        this.src = driver.src;
    }

    nextToken(step: number = 1) {
        this.currentTokenPos += step;
        this.currentToken = this.currentTokenPos < this.tokenized.length ? this.tokenized[this.currentTokenPos] :
            [...EOTToken, 0, 0, 0];
    };

    checkCurrToken(driver: TokenDriver, expected: Token, err: string): boolean {
        if (driver.currentToken[1] !== expected[1] || driver.currentToken[0] !== expected[0]) {
            driver.warning(err);
            return false;
        }

        return true;
    }

    error(msg: string): never {
        const currToken = this.tokenized[this.currentTokenPos];

        let underscore = `\u001b[${currToken[4] - 0.5}C^`;
        for (let i = 1; i < currToken[1].length; ++i)
            underscore += `\u001b[0.5C^`;

        console.log(`Error in file ${this.file} at pos ${currToken[4] + 1} `+
            `line ${currToken[3] + 1}:`+
            `\n\n\t${this.src.split(specialChars.EOL)[currToken[3]]}` +
            `\n\t${underscore}` +
            `\n${msg}`);

        process.exit();
    }

    warning(msg: string) {
        if (currLogLevel > LogLevels.Warn) return;

        const currToken = this.tokenized[this.currentTokenPos];

        let underscore = `\u001b[${currToken[4] - 0.5}C^`;
        for (let i = 1; i < currToken[1].length; ++i)
            underscore += `\u001b[0.5C^`;

        console.log(`Error in file ${this.file} at pos ${currToken[4] + 1} ` +
            `line ${currToken[3] + 1}:` +
            `\n\n\t${this.src.split(specialChars.EOL)[currToken[3]]}` +
            `\n\t${underscore}` +
            `\n${msg}`);
    }
}

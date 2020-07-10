import { Token, TokenType } from "./Grammar";
import { keywords } from "./Tables";
import { currentChar, nextChar, currentCharPos, Char } from "./CodeDriver";

const ignoredChars = [Char.space, Char.tab, Char.EOL];
export const letter = () => /\p{L}/u;
export const digit = () => /\p{Nd}/u;
export const alphanumeric = () => /[\p{L}, \p{Nd}]/;

export let tokenPos = 0;
export let currentToken;
export function nextToken() {
    while (ignoredChars.includes(currentChar)) nextChar();
    tokenPos = currentCharPos;

    /*
    const iden = new Grammar().parser();
    const num = new Grammar().parser();
    */

    /*
    for(const grammar of grammars) {
        grammar.parser()();
    }
    */
    if (letter().test(currentChar)) iden();
    else if (digit().test(currentChar)) literal();
}

function iden() {
    let id = currentChar;
    nextChar();

    while (alphanumeric().test(currentChar)) { //check if char is a letter or a digit
        id += currentChar;
        nextChar();
    }

    if (keywords.has(id)) currentToken = [TokenType.Keyword, id];
    currentToken = [TokenType.Identifier, id];
}

function literal() {
    let val: number = Number(currentChar);
    nextChar();

    while (digit().test(currentChar)) { //check if char is a letter or a digit
        val *= 10;
        val += Number(currentChar);
        nextChar();
    }

    if (currentChar === ".") {
        nextChar();
        let pos = 1;

        while (digit().test(currentChar)) {
            pos /= 10;
            val += pos * Number(currentChar);
            nextChar();
        }

    }

    currentToken = [TokenType.Literal, val];
}
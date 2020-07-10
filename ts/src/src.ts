import * as fs from 'fs';
import * as Grammar from "./Grammar";
import { nextToken, currentToken } from './Scanner';
import { src, currentCharPos, currentChar, nextChar, setupSource } from "./CodeDriver";
import { Error } from "./Error";
// import * as driver from "./CodeDriver";
// import * as scaner from "./Scaner";
// import * as parser from "./SyntaxParser";
// import * as contextAnalizer from "./ContextAnalizer";

setupSource(process.argv[2]);
const srcOutFile = process.argv[3] || src.split(".")[0] + ".code";
let srcOut = "";

function nextString(length: number) {
    return src.substring(currentCharPos, currentCharPos + length);
}

function assertStringAndMove(str: string, err: string) {
    if (nextString(str.length) !== str) Error(err);
    nextChar(str.length);
}

function or(el1: () => any, el2: () => any): () => any {
  return () => {
    try {
      return el1();
    } catch (e) {
      return el2();
    }
  };
}

function string(): string {
    let str: string = "";

    assertStringAndMove("\"", "expected opening bracket");

    while (currentChar !== "\"") {
        if (currentChar === "\\") nextChar();

        str += currentChar;
        nextChar();
    }
    nextChar();

    return str;
}

function Arr<T>(element: () => T): T[] {
    const elements: T[] = [];

    assertStringAndMove("(", "expected opening bracket of Array");

    elements.push(element());
    while (currentChar === ',') {
        nextChar();
        elements.push(element());
    }

    assertStringAndMove(")", "expected closing bracket of Array");

    return elements;
}

function rule(): Grammar.Rule[] {
    const rules: Grammar.Rule[] = [];
    const lhs: string[] = [];

    nextToken();
    lhs.push(currentToken);
    while (currentChar == '-') {
        nextChar(); nextToken();
        lhs.push(currentToken);
    }

    assertStringAndMove("=>", "incorrect syntax of rule");

    const r: Grammar.Rule = [l: [], r: []];
    r.l = lhs;
    nextToken();
    r.r.push(currentToken);
    rules.push(r);
    while (["-", "|"].includes(currentChar)) {
        if (currentChar === "-") {
            nextChar(); nextToken();
            rules[rules.length - 1].r.push(currentToken);
        } else if (currentChar === "|") {
            nextChar(); nextToken();
            const r: Grammar.Rule = [l: [], r: []];
            r.l = lhs;
            r.r.push(currentToken);
            rules.push(r);
        }
    }

    return rules;
}

function grammar(): [string, Grammar.Grammar] {
    const declarationStart = currentCharPos;
    nextToken();
    const name = currentToken;
    const grammar: Grammar.Grammar = new Grammar.Grammar();

    assertStringAndMove("(", "expected opening bracket");
    grammar[0] = Arr(string);

    assertStringAndMove(",", "expected set of identifiers");
    grammar[1] = Arr(() => (nextToken(), currentToken));

    assertStringAndMove(",", "expected set of rules");
    grammar[2] = Arr(rule).flat();

    assertStringAndMove(",", "expected a nextToken");
    nextToken();
    grammar[3] = currentToken;

    assertStringAndMove(")", "expected closing bracket");

    const declarationEnd = currentCharPos;

    const declSrc = src.slice(declarationStart, declarationEnd);

    return [name, grammar];
}

console.log("Starting parsing...");

const grammars = new Map<string, Grammar.Grammar>();

let g: [string, Grammar.Grammar];
while (true) {
    while (nextString(2) !== "g ") {
        srcOut += currentChar;

        nextChar();

        if (currentChar === "") break;
    }
    if (currentChar === "") break;
    nextChar(2);
    g = grammar();

    if (grammars.has(g[0])) logError("already declared " + g[0]);
    grammars.set(g[0], g[1]);
}

console.log(JSON.stringify([...grammars], null, 2));

fs.writeFileSync(srcOutFile, srcOut);

console.log("Done!");
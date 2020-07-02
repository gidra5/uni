import * as fs from 'fs'

// const files = new Map<string, FileData>();

if (process.argv.length <= 2)
    throw new Error("Enter filepath, pleeeease.");
const src = fs.readFileSync(process.argv[2]).toString();
// process.argv.filter((v, i) => ![0, 1].includes(i)).
//     forEach(file => files.set(file, new FileData(fs.readFileSync(file))));

let currentCharPos = 0;
let currentChar = src.charAt(currentCharPos);

const isLetter = (char: string) => /\p{L}/u.test(char);
const isDigit = (char: string) => /\p{Nd}/u.test(char);
const isAlphanumeric = (char: string) => isLetter(char) || isDigit(char);

class Rule {
    lhs: string[] = [];
    rhs: string[] = [];
}

class Grammar {
    terminals: string[] = [];
    nonTerminals: string[] = [];
    rules: Rule[] = [];
    startingTerminal: string = "";
}

function nextChar(step: number = 1) {
    currentCharPos += step;
    currentChar = src.charAt(currentCharPos);
}

function nextString(length: number) {
    return src.substring(currentCharPos, currentCharPos + length);
}

function token(): string {
    let id = currentChar;

    if (!isLetter(currentChar)) //check if char is a letter
        throw new Error("expected a token");
    nextChar();

    while (isAlphanumeric(currentChar)) { //check if char is a letter or a digit
        id += currentChar;
        nextChar();
    }

    return id;
}

function Arr<T>(element: () => T): T[] {
    const elements: T[] = [];

    if (currentChar !== "(") throw new Error("expected opening bracket");
    nextChar();

    elements.push(element());
    while (currentChar == ',') {
        nextChar();
        elements.push(element());
    }

    if (currentChar !== ")") throw new Error("expected closing bracket");
    nextChar();

    return elements;
}

function rule(): Rule {
    const rule: Rule = new Rule();

    rule.lhs.push(token());
    while (currentChar == '-') {
        nextChar();
        rule.lhs.push(token());
    }

    if (nextString(2) !== "=>")
        throw new Error("incorrect syntax of rule");
    nextChar(2);

    try {
        rule.rhs.push(token());
    } catch (e) { }
    while (currentChar == '-') {
        nextChar();
        rule.rhs.push(token());
    }

    return rule;
}

function grammar(): [string, Grammar] | null{
    while (nextString(2) !== "g ") {
        nextChar();

        if(currentChar === "")
            return null;
    }
    nextChar(2);
    try {
        const name = token();
        const grammar = new Grammar();

        if (currentChar !== '(')
            throw new Error("expected opening bracket");
        nextChar();
        grammar.terminals =  Arr(token);

        if (currentChar !== ',')
            throw new Error("expected set of identifiers");
        nextChar();
        grammar.nonTerminals = Arr(token);

        if (currentChar !== ',')
            throw new Error("expected set of rules");
        nextChar();
        grammar.rules = Arr(rule);

        if (currentChar !== ',')
            throw new Error("expected an token");
        nextChar();
        grammar.startingTerminal = token();

        if (currentChar !== ')')
            throw new Error("expected closing bracket");
        nextChar();

        return [name, grammar];
    } catch (e) {
        return grammar();
    }
}

console.log("Starting parsing...");

const grammars = new Map<string, Grammar>();

let g = grammar();
while (g) {
    grammars.set(g[0], g[1]);

    g = grammar();
}

console.log(grammars);

console.log("Done!");
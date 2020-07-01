// import * as fs from 'fs'
const fs = require("fs");

const isLetter = (char: string) => /\p{L}/u.test(char);//char.match(/\p{L}/);
const isDigit = (char: string) => /\p{Nd}/u.test(char);//char.match(/\p{Nd}/);

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

let currentCharPos = 0;

let currentChar;

function nextChar()
{
    ++currentCharPos
    currentChar = src.charAt(currentCharPos);
}

function identifier(): string {
    let id = currentChar;

    if (isLetter(currentChar)) //check if char is a letter
        nextChar();
    else
        throw new Error("expected identifier\n");

    while (isAlphanumeric(currentChar)) { //check if char is a letter or a digit
        id += currentChar;
        nextChar();
    }

    return id;
}

function Arr(): string[] {
    const ids: string[] = [];

    if (currentChar == '(')
        nextChar();
    else
        throw new Error("expected opening bracket\n");

    ids.push(identifier());
    while (currentChar == ',') {
        nextChar();
        ids.push(identifier());
    }

    if (currentChar == ')')
        nextChar();
    else
        throw new Error("expected closing bracket\n");

    return [];
}

function ArR() {
    if (currentChar == '(')
        nextChar();
    else
        throw new Error("expected opening bracket\n");

    rule();
    while (currentChar == ',') {
        nextChar();
        rule();
    }

    if (currentChar == ')')
        nextChar();
    else
        throw new Error("expected closing bracket\n");
}

function rule() {
    identifier();
    while (currentChar == '-') {
        nextChar();
        identifier();
    }

    if (currentChar == '=')
        nextChar();
    else
        throw new Error("incorrect syntax of rule\n");
    if (currentChar == '>')
        nextChar();
    else
        throw new Error("incorrect syntax of rule\n");

    identifier();
    while (currentChar == '-') {
        nextChar();
        identifier();
    }
}

function grammar() {
    let name = identifier();

    if (currentChar == '(')
        nextChar();
    else
        throw new Error("expected opening bracket\n");

    let arr = Arr();

    if (currentChar == ',') {
        nextChar();
        Arr();
    } else throw new Error("expected set of identifiers\n");

    if (currentChar == ',') {
        nextChar();
        ArR();
    } else throw new Error("expected set of rules\n");

    if (currentChar == ',') {
        nextChar();
        identifier();
    } else throw new Error("expected an identifier\n");

    if (currentChar == ')')
        nextChar();
    else
        throw new Error("expected closing bracket\n");
}

// const files = new Map<string, FileData>();

if (process.argv.length <= 2)
    throw new Error("Enter filepath, pleeeease.");
const src = fs.readFileSync(process.argv[2]).toString();
// process.argv.filter((v, i) => ![0, 1].includes(i)).
//     forEach(file => files.set(file, new FileData(fs.readFileSync(file))));

console.log("Starting parsing...");

nextChar();

grammar();

// const grammars = new Map<string, Grammar>();
// for (const file of files.values()) {
//     const g = file.readGrammar(); grammars.set(g[0], g[1]);
// }

// console.log(grammars);

console.log("Done!");
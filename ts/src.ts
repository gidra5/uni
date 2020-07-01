import * as fs from 'fs'

const isLetter = (char: string) => char.match(/\p{L}/);
const isDigit = (char: string) => char.match(/\d/);

const isLetterOrDigit = (char: string) => isLetter(char) || isDigit(char);

class Rule {
    lhs: string[];
    rhs: string[];
}

class Grammar {
    terminals: string[];
    nonTerminals: string[];
    rules: Rule[];
    startingTerminal: string;
}

class FileData {
    data: string;
    currentCharPos: number = 0;
    // currentCharLine: number = 0;

    constructor(data: Buffer) {
        this.data = data.toString("utf-8");
    }

    get currentChar() {
        return this.data.charAt(this.currentCharPos);
    }

    nextChar(step: number = 1): string {
        this.currentCharPos += step;
        const tmp = this.data.substring(this.currentCharPos - step, this.currentCharPos);
        // if (tmp.includes("\n")) ++this.currentCharLine;
        return tmp;
    }

    assertCurrChar(predicate: (char: string) => boolean, errMsg: string, cb: () =>  void) {
        if (predicate(this.currentChar))
            cb();
        else
            throw new Error(errMsg);
    }

    assertCurrCharAndMove(predicate: (char: string) => boolean, errMsg: string, cb?: () => void): void {
        this.assertCurrChar(predicate, errMsg, () => {
            this.nextChar();
            cb();
        });
    }

    assertChar(char: string): (errMsg: string, cb?: () => any) => void {
        return (errMsg: string, cb = () => { }) => {
            this.assertCurrChar(c => c === char, errMsg, cb);
        };
    }

    assertCharAndMove(char: string): (errMsg: string, cb?: () => any) => void {
        return (errMsg: string, cb = () => { }) => {
            this.assertCurrCharAndMove(c => c === char, errMsg, cb);
        };
    }

    readOneOrMoreElement(predicate: (char: string) => boolean, readElement) {
        readElement();

        while (predicate(this.currentChar)) {
            readElement();
        }
    }

    oneOrMoreElementReaderWithSeparator(separator: string) {
        return (readElement) =>
            this.readOneOrMoreElement(c => c == separator, () => (this.nextChar(), readElement()));
    }

    wrapped(open: string, close: string, readElement) {
        this.assertChar(open)(`expected opening char '${open}'`);

        readElement();

        this.assertChar(close)(`expected closing char '${close}'`);
    }

    readIdentifier(): string {
        let id: string = "";

        let onceCalled = false;
        this.readOneOrMoreElement(c => isLetterOrDigit(c), () => {
            id += this.currentChar;

            if (onceCalled) this.nextChar();
            else this.assertCurrCharAndMove(c => isLetter(c), "expected identifier");

            onceCalled = true;
        });

        return id;
    }

    readArray<T>(readElement: () => T): T[] {
        let elements: T[] = [];

        this.wrapped("(", ")",
            () => this.oneOrMoreElementReaderWithSeparator(",")(() => elements.push(readElement())));

        return elements;
    }

    readRule(): Rule {
        const rule: Rule = new Rule();
        const transformSymbol = "=>";
        const reader = this.oneOrMoreElementReaderWithSeparator("-");

        reader(() => rule.lhs.push(this.readIdentifier()));

        transformSymbol.split("").forEach(char => {
            this.assertCharAndMove(char)("incorrect syntax of rule");
        });

        reader(() => rule.rhs.push(this.readIdentifier()));
    }

    readGrammar(): [string, Grammar] {
        // while (this.currentChar !== undefined) {
        //     //if ("grammar") break;
        //     this.nextChar();
        // }

        if (this.currentChar === undefined) return;

        const assertComma = this.assertChar(",");

        const grammarName = this.readIdentifier();
        const grammar = new Grammar();

        this.wrapped("(", ")", () => {
            grammar.terminals = this.readArray(this.readIdentifier);

            assertComma("expected set of identifiers", () => grammar.nonTerminals = this.readArray(this.readIdentifier));

            assertComma("expected set of rules", () => grammar.rules = this.readArray(this.readRule));

            assertComma("expected an identifier", () => grammar.startingTerminal = this.readIdentifier());
        });

        return [grammarName, grammar];
    };
}

const files = new Map<string, FileData>();

if (process.argv.length <= 1)
    throw new Error("Enter filepath, pleeeease.");
process.argv.filter((v, i) => i !== 0).forEach(file => fs.readFile(file, (err, data) => {
    if (err) throw new Error("Failed to open " + file);
    files.set(file, new FileData(data));
}));

console.log("Starting to parse...");

const grammars = new Map<string, Grammar>();
for (const file of files.values()) {
    file.readOneOrMoreElement(c => c !== undefined,
        () => { const g = file.readGrammar(); grammars.set(g[0], g[1]); });
}

console.log(grammars);

console.log("Done!");
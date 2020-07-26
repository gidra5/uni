import * as fs from 'fs';
import { LogLevels, currLogLevel } from './Error';

export const specialChars = {
    space: " ",
    tab: "\t",
    EOL: "\n",
    EOT: ""
};

export class TextDriver {
    src: string;
    file: string;
    currentChar = specialChars.EOT;
    currentCharPos = 0;
    currentCharLine = 0;
    currentCharLinePos = 0;

    constructor(file: string) {
        this.file = file;
        this.src = fs.readFileSync(file).toString();
        this.reset();
    }

    reset() {
        this.currentChar = this.src.charAt(0);
    }

    nextChar(step: number = 1) {
        let lines = this.nextString(step).split(specialChars.EOL);
        if (lines.length - 1 > 0) {
            this.currentCharLine += (lines.length - 1) * Math.sign(step);
            this.currentCharLinePos = lines.pop()!.length - 1;
        }

        this.currentCharPos += step;
        this.currentCharLinePos += step;
        this.currentChar = this.src.charAt(this.currentCharPos);
    };

    nextString(length: number) {
        if (length > 0)
            return this.src.substring(this.currentCharPos, this.currentCharPos + length);
        else
            return this.src.substring(this.currentCharPos + length, this.currentCharPos);
    }

    assertStringAndMove(str: string, err: string) {
        if (this.nextString(str.length) !== str) this.error(err);
        this.nextChar(str.length);
    }

    error(msg: string) {
        console.log(`Error in file ${this.file} at pos ${this.currentCharLinePos + 1} ` +
            `line ${this.currentCharLine + 1}:` +
            `\n\n\t${this.src.split(specialChars.EOL)[this.currentCharLine]}` +
            `\n\t\u001b[${this.currentCharLinePos}C^` +
            `\n${msg}`);

        process.exit();
    }

    warning(msg: string) {
        if (currLogLevel > LogLevels.Warn) return;

        console.log(`Warning in file ${this.file} at pos ${this.currentCharLinePos + 1} ` +
            `line ${this.currentCharLine + 1}:` +
            `\n\n\t${this.src.split(specialChars.EOL)[this.currentCharLine]}` +
            `\n\t\u001b[${this.currentCharLinePos}C^` +
            `\n${msg}`);
    }
}
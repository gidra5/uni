import * as fs from 'fs';

export const specialChars = {
    space: " ",
    tab: "\t",
    EOL: "\n",
    EOT: ""
};

export class TextDriver {
    currentCharPos = 0;
    currentCharLine = 0;
    currentCharLinePos = 0;
    currentChar = specialChars.EOT;
    file: string;
    src: string;

    constructor(file: string) {
        this.file = file;
        this.src = fs.readFileSync(file).toString();
        this.reset();
    }

    reset() {
        this.currentChar = this.src.charAt(0);
    }

    nextChar(step: number = 1) {
        this.currentCharPos += step;
        this.currentCharLinePos += step;
        this.currentChar = this.src.charAt(this.currentCharPos);

        let lines = this.nextString(step).split(specialChars.EOL).length - 1;
        if (lines) {
            this.currentCharLine += lines;
            this.currentCharLinePos = 0;
        }
    };

    nextString(length: number) {
        return this.src.substring(this.currentCharPos, this.currentCharPos + length);
    }
}
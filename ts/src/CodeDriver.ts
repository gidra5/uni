import * as fs from 'fs';

export const Char = {
    space: " ",
    tab: "\t",
    EOL: "\n",
    EOT: ""
};

export let currentCharPos = 0;
export let currentCharLine = 0;
export let currentCharLinePos = 0;
export let currentChar = "";

if (process.argv.length <= 2)
    throw new Error("Enter filepath, pleeeease.");

export let src;

export function setupSource(...files: string[]) {
    src = fs.readFileSync(files[0]).toString();
}

export function nextChar(step: number = 1) {
    currentCharPos += step;
    currentCharLinePos += step;
    currentChar = src.charAt(currentCharPos);

    if (nextString(step).includes("\n")) {
        ++currentCharLine;
        currentCharLinePos = 0;
    }
}

export function nextString(length: number) {
    return src.substring(currentCharPos, currentCharPos + length);
}
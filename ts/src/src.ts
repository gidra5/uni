import { writeFileSync } from 'fs';
import { TokenDriver } from './TokenDriver';
import { syntaxParser } from './SyntaxParser';
import { assembleFromParsed } from './SemanticAnalyzer';
import { TextDriver } from './TextDriver';
// import * as scanner from "./Scanner";
// import * as parser from "./SyntaxParser";
// import * as contextAnalizer from "./ContextAnalizer";

if (process.argv.length < 3) {
    console.log("Enter filepath, pleeeease.");
    process.exit();
}

function setupSource(...files: string[]) {
    return files.map(file => new TextDriver(file));
}

const textDrivers = setupSource(process.argv[2]);
const srcOutFiles = [process.argv[3]] || textDrivers.forEach(td => td.src.split(".")[0] + ".code");

console.log("Starting parsing...");

console.log("Lexical analize...");
const scannedTexts = textDrivers.map(td => new TokenDriver(td));
console.log(scannedTexts);

console.log("Syntax parsing...")
const parsedTexts = scannedTexts.map(t => syntaxParser(t));
console.log(parsedTexts);

console.log("Assembling code...");
const out = parsedTexts.map(t => assembleFromParsed(t));

console.log("Saving...");
srcOutFiles.forEach((f, i) => writeFileSync(f, out[i]));

console.log("Done!");
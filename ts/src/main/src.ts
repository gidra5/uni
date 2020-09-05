// import { writeFileSync } from 'fs';
import { TokenDriver } from '../Translator/TokenDriver';
import { translateArgs, textDrivers } from './ArgumentsTranslator';
import { parse } from '../Translator/SyntaxParser';
import { TypesOf } from '../Translator/Tables';
// import * as scanner from "./Scanner";
// import * as parser from "./SyntaxParser";
// import * as contextAnalizer from "./ContextAnalizer";

console.log("Starting...");

translateArgs(process.argv.slice(2));

console.log("Lexical analysis...");
const scannedTexts = textDrivers.map(td => new TokenDriver(td));

console.log("Parsing...")
// const parsedTexts = scannedTexts.map(t => parse(t));

// console.log("Semantic analysis...");
// const analyzed = parsedTexts.map(t => semanticAnalysis(t));

// console.log("Compiling...");
// const out = analyzed.map(t => compile(t));

// console.log("Saving...");
// srcOutFiles.forEach((f, i) => writeFileSync(f, out[i]));

console.log("Done!");

console.log(scannedTexts.map(td => td.tokenized.map(token => [TypesOf.Tokens[token[0]], ...token.slice(1)])));
// console.log(parsedTexts);
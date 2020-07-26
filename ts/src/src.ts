import { writeFileSync } from 'fs';
import { TokenDriver } from './TokenDriver';
import { translate, textDrivers, srcOutFiles } from './ArgsTranslator';
// import * as scanner from "./Scanner";
// import * as parser from "./SyntaxParser";
// import * as contextAnalizer from "./ContextAnalizer";

console.log("Starting...");

translate(process.argv.slice(2));

console.log("Lexical analysis...");
const scannedTexts = textDrivers.map(td => new TokenDriver(td));
console.log(scannedTexts.map(td => td.tokenized));

// console.log("Parsing...")
// const parsedTexts = scannedTexts.map(t => parse(t));
// console.log(parsedTexts);

// console.log("Semantic analysis...");
// const analyzed = parsedTexts.map(t => semanticAnalysis(t));

// console.log("Compiling...");
// const out = analyzed.map(t => compile(t));

// console.log("Saving...");
// srcOutFiles.forEach((f, i) => writeFileSync(f, out[i]));

console.log("Done!");
import { program } from "commander";
import readline from "readline";
import { promises as fs } from "fs";
import { stdin as input, stdout as output } from "process";
import * as parser from "./parser.mjs";

program.option("-i, --interactive");

program.parse();

const options = program.opts();
const [file] = program.args;

const rl = readline.createInterface({ input, output, prompt: ">> " });

rl.prompt();

rl.on("line", (line) => {
  switch (line.trim()) {
    case "hello":
      console.log("world!");
      break;
    case "exit":
      rl.close();
      break;
    default:
      const [tokens, spans, errors] = parser.tokenize(line);

      console.log(tokens);
      console.log(errors);

      break;
  }
  rl.prompt();
}).on("close", () => {
  console.log("Have a great day!");
  process.exit(0);
});

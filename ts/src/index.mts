import { program } from "commander";
import readline from "readline";
import { promises as fs } from "fs";
import { stdin as input, stdout as output } from "process";
import * as parser from "./parser.mjs";
import { none } from "./types.mjs";

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
      // const info = parser.tokenize(line);

      // console.log(info);
      const registry = new parser.Registry<parser.OperatorDefinition>();
      registry.register({ precedence: [none(), none()], separators: [{ ident: '(' }, { ident: ')' }] });
      registry.register({ precedence: [none(), none()], separators: [{ ident: 'abc' }] });
      const info = parser.operands(line, registry);

      console.dir({info, registry}, { depth: 6 });

      break;
  }
  rl.prompt();
}).on("close", () => {
  console.log("Have a great day!");
  process.exit(0);
});

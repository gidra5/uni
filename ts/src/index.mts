import { program } from "commander";
import readline from "readline";
import { promises as fs } from "fs";
import { stdin as input, stdout as output } from "process";
import { operators } from "./evaluator.mjs";
import { expr } from "./parser/index.mjs";
import { transpose } from "./parser/utils.mjs";

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
      // const info = operands(operators)(line);
      const info = expr(operators)(line);

      // console.dir({info, registry: operators}, { depth: 12 });
      console.dir({ info: transpose(info)[0] }, { depth: 12 });

      break;
  }
  rl.prompt();
}).on("close", () => {
  console.log("Have a great day!");
  process.exit(0);
});

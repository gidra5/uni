import { program } from "commander";
import readline from "readline";
import { stdin as input, stdout as output } from "process";
import {
  Term,
  eraseBlocks,
  eraseFunctionWithArgs,
  resolveNames,
  erasePatterns,
  evaluate,
  insertContext,
  parse,
  print,
} from "./lambda.js";
import { print as printErrors } from "./errors.js";

program.option("-i, --interactive");

program.parse();

const { interactive } = program.opts();
const [file] = program.args;

if (interactive) {
  const rl = readline.createInterface({ input, output, prompt: ">> " });
  const session: Term[] = [];

  rl.prompt();

  rl.on("line", (_line) => {
    const line = _line.trim();
    switch (line) {
      case "hello":
        console.log("world!");
        break;
      case "exit":
        rl.close();
        break;
      default: {
        const [parsed, errors] = parse(line);
        printErrors(errors);
        console.log(3, parsed, errors);

        const erasedPatterns = erasePatterns(parsed);
        console.dir([4, erasedPatterns], { depth: null });
        const erasedBlocks = eraseBlocks(erasedPatterns);
        console.dir([5, erasedBlocks], { depth: null });
        const erasedFnArgs = eraseFunctionWithArgs(erasedBlocks);
        console.dir([6, erasedFnArgs], { depth: null });
        const erasedNames = resolveNames(erasedFnArgs);
        console.dir([7, erasedNames, session], { depth: null });
        const withEnv = insertContext(erasedNames, session);
        console.dir([8, withEnv], { depth: null });
        console.log(print(withEnv));
        const evaluated = evaluate(withEnv);
        session.unshift(evaluated);
        console.log(print(evaluated), session);
        break;
      }
    }
    rl.prompt();
  }).on("close", () => {
    console.log("Have a great day!");
    process.exit(0);
  });
} else {
}

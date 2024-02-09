import { program } from "commander";
import readline from "readline";
import { stdin as input, stdout as output } from "process";
import { parseTokens } from "./parser/tokens.js";
import { VM } from "./vm/index.js";
import fs from "fs";
import { keyboardDevice } from "./vm/devices.js";

program.option("-i, --interactive");
program.option("--vm");

program.parse();

const { interactive, vm } = program.opts();
const [file] = program.args;
// let map = new FileMap();
// const ctx: Context = {};

if (vm) {
  input.setRawMode(true);
  readline.emitKeypressEvents(input);
  const keyboardData = [] as number[];
  input.on("keypress", (char, key) => {
    keyboardData.push(char.charCodeAt(0));
  });
  const vm = new VM(
    keyboardDevice(() => {
      while (keyboardData.length === 0) {}
      return keyboardData.shift()!;
    })
  );

  const image = fs.readFileSync(file);

  vm.run(image);
} else if (interactive) {
  const rl = readline.createInterface({ input, output, prompt: ">> " });
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
        const [tokens, tokenErrors] = parseTokens(line);

        // const fileName = "cli";
        // map.addFile(fileName, line);
        // printTokenErrors(tokenErrors, map, fileName);
        // const [, tree, exprErrors] = parseExpr()(tokens);
        // printErrors(exprErrors, tokens, map, fileName);
        // console.log(printTree(treeExpression(tree)));
        // console.log(printTree(treeOptimizer(treeExpression(tree))[0]));

        // const x = evalExpr(tree, ctx);
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

// export const evalAccessStr = (str: string, ctx: Context) =>
//   evalAccessExpr(parseAccessExpression(parseTokens(str)[0])[1], ctx);
// export const evalExprStr = (str: string, ctx: Context) => {
//   return evalExpr(parseExpr()(parseTokens(str)[0])[1], ctx);
// };

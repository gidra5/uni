import { program } from "commander";
import readline from "readline";
import { stdin as input, stdout as output } from "process";
import { VM } from "./vm/index.js";
import fs from "fs";
import { parseTokens } from "./parser/tokens.js";
import { parse } from "./parser/index.js";
import { Compiler } from "./compiler/index.js";
import { parseExprString } from "./parser/string.js";

program.option("-i, --interactive");

program
  .command("repl [file]")
  .description("Run interactive environment with optional initial script/module")
  .action(() => {});

program
  .command("build <file> <output>")
  .description("Compile a program into an image")
  .action((file, output) => {
    const code = fs.readFileSync(file, "utf-8");
    // const [tokens, _errors] = parseTokens(code);
    // const [ast, __errors] = parse()(tokens);
    const [ast, _errors] = parseExprString(code);

    const compiled = Compiler.compile(ast, 0x3000);
    const buffer = Buffer.from(compiled.buffer);

    fs.writeFileSync(output, buffer.swap16(), { encoding: "binary" });
  });

program
  .command("vm <image> [osImage]")
  .description("Run an image of compiled program")
  .action((imageFile, osImageFile) => {
    const osImage = osImageFile ? fs.readFileSync(osImageFile) : undefined;
    const image = fs.readFileSync(imageFile);

    const vm = new VM(osImage);
    console.log("Os image loaded");

    input.setRawMode(true);
    readline.emitKeypressEvents(input);
    input.on("keypress", (char, key) => {
      if (key.ctrl && key.name === "c") {
        process.exit(0);
      }
      vm.emit("input", char);
    });

    vm.loadImage(image);
    console.log("Image loaded");

    vm.on("halt", () => {
      console.log("Halted");

      process.exit(0);
    });

    console.log("Starting VM...");
    vm.run();
  });

program.parse();

const { interactive } = program.opts();
const [file] = program.args;
// let map = new FileMap();
// const ctx: Context = {};

if (interactive) {
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
        // const [tokens, tokenErrors] = parseTokens(line);

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

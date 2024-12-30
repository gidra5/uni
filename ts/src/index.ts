import { program } from "commander";
import readline from "readline";
import { stdin as input, stdout as output } from "process";
import { VM } from "./vm/index.js";
import fs from "fs";
import { parseScript } from "./parser/parser.js";
import { parseTokenGroups } from "./parser/tokenGroups.js";
import { generateLLVMCode } from "./codegen/llvm.js";
import { exec } from "child_process";

program
  .command("run <file>")
  .description("Run script from a file in interpreter")
  .action((file) => {
    // const taskQueue = new TaskQueue();
    // const context = initialContext(taskQueue);
    // console.log("Starting interpreter...");
    // const code = fs.readFileSync(file, "utf-8");
    // console.log("Script is read");
    // evaluate(taskQueue, parseScriptString(code), context, identity);
    // taskQueue.run();
    console.log("Exiting interpreter");
  });

program
  .command("repl")
  .argument("[file]", "initial script/module")
  .description("Run REPL in interpreter")
  .action((file) => {
    // const taskQueue = new TaskQueue();
    // const context = initialContext(taskQueue);
    console.log("Starting REPL...");
    // const callback: Continuation = (v) => console.dir(v, { depth: null });
    // if (file) {
    //   console.log("Reading initial script...");
    //   const code = fs.readFileSync(file, "utf-8");
    //   console.log("Running initial script...");
    //   evaluate(taskQueue, parseScriptString(code), context, callback);
    //   taskQueue.run();
    // }
    console.log("Waiting for next input...");
    const rl = readline.createInterface({ input, output, prompt: ">> " });
    rl.prompt();

    rl.on("line", (_line) => {
      const line = _line.trim();
      switch (line) {
        case "exit":
          rl.close();
          break;
        default: {
          // try {
          //   evaluate(taskQueue, parseScriptString(line), context, callback);
          //   taskQueue.run();
          // } catch (e) {
          //   console.error(e);
          // }
          break;
        }
      }

      rl.prompt();
    }).on("close", () => {
      console.log("Have a great day!");
      process.exit(0);
    });
  });

program
  .command("lli <file>")
  .description("generate code for llvm and interpret it with lli")
  .action((file) => {
    const code = fs.readFileSync(file, "utf-8");
    console.log("File is read");

    const tokens = parseTokenGroups(code);
    const x = parseScript(tokens);
    console.log("File is parsed");

    const compiled = generateLLVMCode(x);
    console.log("File is compiled");

    const child = exec("lli");
    child.stdin?.write(compiled);
    child.stdin?.end();
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });

program
  .command("build <file> <output>")
  .option("-s, --stack-vm", "Compile for stack VM")
  .description("Compile a program into an image")
  .action((file, output, options) => {
    const stackVm = options.stackVm;
    const code = fs.readFileSync(file, "utf-8");
    console.log("File is read");

    // const [ast, _errors] = parseExprString(code);
    console.log("File is parsed");

    // const compiled = Compiler.compileToBinary(ast, 0x3000);
    console.log("File is compiled");
    // const buffer = Buffer.from(compiled.buffer);

    // fs.writeFileSync(output, buffer.swap16(), { encoding: "binary" });
    console.log("Compiled output is written to file");
  });

program
  .command("vm <image> [osImage]")
  .option("-s, --stack-vm", "Run in stack VM")
  .description("Run an image of compiled program")
  .action((imageFile, osImageFile, options) => {
    // .univm - uses register vm
    // .unisvm - uses stack vm
    // otherwise read stackVm flag
    const stackVm = options.stackVm;
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

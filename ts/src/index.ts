import { FileMap } from "codespan-napi";
import { program } from "commander";
import fs from "fs";
import readline from "readline";
import { stdin as input, stdout as output } from "process";
import { validate, validateTokenGroups } from "./analysis/validate.js";
import { SystemError } from "./error.js";
import { parseScript } from "./parser/parser.js";
import { parseTokenGroups } from "./parser/tokenGroups.js";
import { generateVm2Bytecode, VM } from "./vm/index.js";
import { inject, Injectable } from "./utils/injector.js";

const reportErrors = (errors: SystemError[], fileId: number, fileMap: FileMap) => {
  if (errors.length === 0) return false;

  errors.forEach((error) => error.withFileId(fileId).print(fileMap));
  process.exitCode = 1;
  return true;
};

const runInVm = (source: string, fileName: string, vm: VM) => {
  const fileMap = inject(Injectable.FileMap);
  fileMap.addFile(fileName, source);
  const fileId = fileMap.getFileId(fileName);

  try {
    const tokens = parseTokenGroups(source);
    const [tokenErrors, validatedTokens] = validateTokenGroups(tokens);
    if (reportErrors(tokenErrors, fileId, fileMap)) return;

    const [astErrors, ast] = validate(parseScript(validatedTokens));
    if (reportErrors(astErrors, fileId, fileMap)) return;

    const bytecode = generateVm2Bytecode(ast);
    vm.addProgram(fileName, bytecode);

    const functionName = `${fileName}:main`;
    return vm.run(functionName);
  } catch (error) {
    if (error instanceof SystemError) {
      error.withFileId(fileId).print(fileMap);
      return;
    }

    console.error(error);
  }
};

program
  .command("run <file>")
  .description("Run script from a file in interpreter")
  .action((file) => {
    let source: string;
    try {
      source = fs.readFileSync(file, "utf-8");
    } catch (error) {
      console.error(`Failed to read "${file}":`, error);
      return;
    }

    const vm = new VM();
    const result = runInVm(source, file, vm);
    if (result !== undefined) console.dir(result, { depth: null });
  });

program
  .command("repl")
  .argument("[file]", "initial script/module")
  .description("Run REPL in interpreter")
  .action((file) => {
    console.log("Starting REPL...");
    const vm = new VM();

    const runSnippet = (source: string, label: string) => {
      const result = runInVm(source, label, vm);
      if (result !== undefined) console.dir(result, { depth: null });
    };

    if (file) {
      try {
        const code = fs.readFileSync(file, "utf-8");
        runSnippet(code, file);
      } catch (error) {
        console.error(`Failed to read "${file}":`, error);
        return;
      }
    }

    console.log("Waiting for next input...");
    const rl = readline.createInterface({ input, output, prompt: ">> " });
    rl.prompt();

    let replLine = 0;
    rl.on("line", (_line) => {
      const line = _line.trim();
      switch (line) {
        case "exit":
          rl.close();
          break;
        default: {
          try {
            runSnippet(line, `<repl:${++replLine}>`);
          } catch (e) {
            console.error(e);
          }
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
  .command("lli [file]")
  .description("generate code for llvm and interpret it with lli")
  .action((file = process.stdin.fd) => {
    // let code: string;
    // try {
    //   code = fs.readFileSync(file, "utf-8");
    // } catch (e) {
    //   unreachable("either pass a file or pipe an input through stdin");
    // }
    // console.log("File is read");
    // const tokens = parseTokenGroups(code);
    // const x = parseScript(tokens);
    // console.log("File is parsed");
    // const compiled = generateLLVMCode(x);
    // console.log("File is compiled");
    // const child = exec("lli-18");
    // child.stdin?.write(compiled);
    // child.stdin?.end();
    // child.stdout?.pipe(process.stdout);
    // child.stderr?.pipe(process.stderr);
  });

program
  .command("build <file> <output>")
  .option("-s, --stack-vm", "Compile for stack VM")
  .description("Compile a program into an image")
  .action((file, output, options) => {
    // const stackVm = options.stackVm;
    // const code = fs.readFileSync(file, "utf-8");
    // console.log("File is read");
    // // const [ast, _errors] = parseExprString(code);
    // console.log("File is parsed");
    // // const compiled = Compiler.compileToBinary(ast, 0x3000);
    // console.log("File is compiled");
    // // const buffer = Buffer.from(compiled.buffer);
    // // fs.writeFileSync(output, buffer.swap16(), { encoding: "binary" });
    // console.log("Compiled output is written to file");
  });

program
  .command("vm <image> [osImage]")
  .option("-s, --stack-vm", "Run in stack VM")
  .description("Run an image of compiled program")
  .action((imageFile, osImageFile, options) => {
    // // .univm - uses register vm
    // // .unisvm - uses stack vm
    // // otherwise read stackVm flag
    // const stackVm = options.stackVm;
    // const osImage = osImageFile ? fs.readFileSync(osImageFile) : undefined;
    // const image = fs.readFileSync(imageFile);
    // const vm = new VM(osImage);
    // console.log("Os image loaded");
    // input.setRawMode(true);
    // readline.emitKeypressEvents(input);
    // input.on("keypress", (char, key) => {
    //   if (key.ctrl && key.name === "c") {
    //     process.exit(0);
    //   }
    //   vm.emit("input", char);
    // });
    // vm.loadImage(image);
    // console.log("Image loaded");
    // vm.on("halt", () => {
    //   console.log("Halted");
    //   process.exit(0);
    // });
    // console.log("Starting VM...");
    // vm.run();
  });

program.parse();

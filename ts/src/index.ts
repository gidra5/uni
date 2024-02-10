import { program } from "commander";
import readline from "readline";
import { stdin as input, stdout as output } from "process";
import { VM } from "./vm/index.js";
import fs from "fs";
import { keyboardDevice } from "./vm/devices.js";

program.option("-i, --interactive");

program
  .command("repl [file]")
  .description("Run interactive environment with optional initial script/module")
  .action(() => {});

program
  .command("vm <image> [osImage]")
  .description("Run an image of compiled program")
  .action((imageFile, osImageFile) => {
    input.setRawMode(true);
    readline.emitKeypressEvents(input);
    const keyboardData = [] as number[];
    input.on("keypress", (char, key) => {
      if (key.ctrl && key.name === "c") {
        process.exit(0);
      }

      keyboardData.push(char.charCodeAt(0));
    });
    const waitForInput = (vm: VM) => {
      // revert pc to previous instruction
      // so that it can be executed once input is available
      vm.pc--;
      input.once("keypress", () => {
        vm.resume();
      });
      vm.suspend();
    };

    const osImage = osImageFile ? fs.readFileSync(osImageFile) : undefined;
    const image = fs.readFileSync(imageFile);

    const vm = new VM(
      keyboardDevice(
        () => {
          if (keyboardData.length !== 0) return keyboardData.shift()!;
          waitForInput(vm);
          return 0;
        },
        () => {
          if (keyboardData.length !== 0) return true;
          waitForInput(vm);
          return false;
        }
      ),
      osImage
    );

    vm.loadImage(image);
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

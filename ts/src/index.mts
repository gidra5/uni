import { program } from "commander";
import readline from "readline";
import { stdin as input, stdout as output } from "process";

program.option("-i, --interactive");

program.parse();

const { interactive } = program.opts();
const [file] = program.args;

if (interactive) {
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
        break;
    }
    rl.prompt();
  }).on("close", () => {
    console.log("Have a great day!");
    process.exit(0);
  });
} else {
}

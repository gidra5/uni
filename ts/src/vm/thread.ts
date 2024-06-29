import { VM } from "./index.js";
import { workerData, parentPort } from "worker_threads";
import { stdin as input, stdout as output } from "process";
import readline from "readline";

const vm = new VM();
vm.memory = workerData.memory;
vm.id = workerData.id;

input.setRawMode(true);
readline.emitKeypressEvents(input);
input.on("keypress", (char, key) => {
  if (key.ctrl && key.name === "c") {
    process.exit(0);
  }
  vm.emit("input", char);
});

vm.on("halt", () => {
  console.log("Halted");

  process.exit(0);
});

parentPort?.on("message", (message) => {
  if (message.type === "start") {
    vm.run();
  }
});

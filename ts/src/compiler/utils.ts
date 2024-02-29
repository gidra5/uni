import { Iterator } from "iterator-js";
import { disassemble } from "../vm/handlers";
import { CodeChunk, chunkToByteCode } from "./chunks";
import { RegisterState } from "./registers";

export const chunkToString = (chunk: CodeChunk): string => {
  return disassemble(chunkToByteCode([], [])(chunk, 0));
};
export const registerStateToObject = <T>(state: RegisterState<T>["state"]) => {
  return Iterator.iter(state)
    .enumerate()
    .flatMap(([x, i]) => (x ? [{ reg: i, ...x }] : []))
    .map<[number, any]>(({ reg, ...rest }) => [reg, rest])
    .toObject();
};

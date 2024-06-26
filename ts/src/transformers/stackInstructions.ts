import type { CodeChunk } from "../compiler/chunks";
import type { OpCode } from "../vm/handlers";
import type { Address, Register } from "../vm/utils";

type ChunkInSymbol = string | symbol;

type ChunkInValue = number | string | boolean | ChunkInValue[];

type ChunkInArgument =
  | { value: ChunkInValue }
  | { register: Register }
  | { address: Address }
  | { label: ChunkInSymbol };

type ChunkIn = {
  label?: ChunkInSymbol;
  opcode: CodeChunk["opcode"] | OpCode.POP | OpCode.PUSH;
  arg1?: ChunkInArgument;
  arg2?: ChunkInArgument;
  arg3?: ChunkInArgument;
};

type ChunkOut = {
  label?: ChunkInSymbol;
  opcode: CodeChunk["opcode"];
  arg1?: ChunkInArgument;
  arg2?: ChunkInArgument;
  arg3?: ChunkInArgument;
};

export const transform = (chunks: ChunkIn[]): ChunkOut[] => {
  return [];
};

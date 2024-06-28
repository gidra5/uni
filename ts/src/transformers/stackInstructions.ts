import type { CodeChunk } from "../compiler/chunks";
import type { OpCode } from "../vm/handlers";
import type { Address, Register } from "../vm/utils";

type ChunkInSymbol = string | symbol;

type ChunkInValue = number | string | boolean | ChunkInValue[];

type ChunkInArgument = { value: ChunkInValue } | { stack: number } | { label: ChunkInSymbol };

type ChunkIn = {
  label?: ChunkInSymbol;
  opcode:
    | CodeChunk["opcode"]
    | OpCode.POP
    | OpCode.PUSH
    | OpCode.COPY
    | OpCode.SWAP
    | OpCode.GET
    | OpCode.SET
    | OpCode.INSERT
    | OpCode.REMOVE
    | OpCode.REPLACE;
  arg1?: ChunkInArgument;
  arg2?: ChunkInArgument;
  arg3?: ChunkInArgument;
};

type ChunkOutArgument =
  | { value: ChunkInValue }
  | { register: Register }
  | { address: Address }
  | { label: ChunkInSymbol };

type ChunkOut = {
  label?: ChunkInSymbol;
  opcode: CodeChunk["opcode"];
  arg1?: ChunkOutArgument;
  arg2?: ChunkOutArgument;
  arg3?: ChunkOutArgument;
};

export const transform = (chunks: ChunkIn[]): ChunkOut[] => {
  return [];
};

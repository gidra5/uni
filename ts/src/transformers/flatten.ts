import type { AbstractSyntaxTree } from "../parser/ast";
import { OpCode, TrapCode } from "../vm/handlers";
import type { Address, Register } from "../vm/utils";

type ChunkInSymbol = string | symbol;

type ChunkInValue = number | string | boolean | ChunkInValue[] | Chunk[];

type ChunkInArgument =
  | { value: ChunkInValue }
  | { stack: number }
  | { register: Register }
  | { address: Address }
  | { name: ChunkInSymbol }
  | { label: ChunkInSymbol };

type Chunk = {
  label?: ChunkInSymbol;
  opcode: OpCode;
  arg1?: ChunkInArgument;
  arg2?: ChunkInArgument;
  arg3?: ChunkInArgument;
};

export type Context = { partial: boolean; chunks: Chunk[] };

const chunk = (opcode: OpCode, arg1?: ChunkInArgument, arg2?: ChunkInArgument, arg3?: ChunkInArgument): Chunk =>
  ({
    arg1,
    arg2,
    arg3,
    opcode,
  } as Chunk);
export const newContext = (partial = true): Context => ({ partial, chunks: [] });
const argToString = (arg: ChunkInArgument): string => {
  if ("value" in arg) {
    return arg.value.toString();
  }
  if ("stack" in arg) {
    return `stack[${arg.stack}]`;
  }
  if ("register" in arg) {
    return `r${arg.register}`;
  }
  if ("address" in arg) {
    return `@${arg.address}`;
  }
  if ("name" in arg) {
    return `name(${arg.name.toString()})`;
  }

  return `label(${arg.label.toString()})`;
};
export const chunkToString = (chunk: Chunk): string => {
  const args = [chunk.arg1, chunk.arg2, chunk.arg3].map((x) => x && argToString(x));
  const label = chunk.label ? `${chunk.label.toString()}: ` : "";
  return label + `${OpCode[chunk.opcode]} arg1: ${args[0]} arg2: ${args[1]} arg3: ${args[2]}`;
};
export const transform = (ast: AbstractSyntaxTree, context: Context = newContext()): Chunk[] => {
  // console.log("transform", ast, context);

  switch (ast.name) {
    case "float":
    case "int":
    case "string": {
      context.chunks.push(chunk(OpCode.PUSH, { value: ast.value }));
      return context.chunks;
    }
    case "name": {
      const name: string = ast.value;
      context.chunks.push(chunk(OpCode.COPY, { name }));
      return context.chunks;
    }
    case "operator":
      break;
  }

  switch (ast.value) {
    case "true": {
      context.chunks.push(chunk(OpCode.PUSH, { value: true }));
      return context.chunks;
    }
    case "false": {
      context.chunks.push(chunk(OpCode.PUSH, { value: false }));
      return context.chunks;
    }
    case "parens": {
      return transform(ast.children[0], context);
    }
    case "brackets": {
      context.chunks.push(chunk(OpCode.PUSH_FRAME));
      transform(ast.children[0], context);
      context.chunks.push(chunk(OpCode.POP_FRAME));
      return context.chunks;
    }
    case "fn": {
      const body = ast.children[1];
      const name = ast.children[0].value;
      const bodyChunks = newContext();
      bodyChunks.chunks.push(chunk(OpCode.ENTRY_POINT));
      bodyChunks.chunks.push(chunk(OpCode.DECLARE, { name }, { value: 1 }));
      transform(body, bodyChunks);
      bodyChunks.chunks.push(chunk(OpCode.RETURN));

      context.chunks.push(chunk(OpCode.PUSH, { value: bodyChunks.chunks }));
      return context.chunks;
    }
    case "application": {
      const fn = ast.children[0];
      const arg = ast.children[1];
      transform(arg, context);
      transform(fn, context);
      context.chunks.push(chunk(OpCode.CALL));
      return context.chunks;
    }
    case "print": {
      const expr = ast.children[0];

      transform(expr, context);
      context.chunks.push(chunk(OpCode.PRINT));

      return context.chunks;
    }
    case ";": {
      const left = ast.children[0];
      const right = ast.children[1];
      transform(left, context);
      return transform(right, context);
    }
    case "+": {
      const left = ast.children[0];
      const right = ast.children[1];
      transform(left, context);
      transform(right, context);
      context.chunks.push(chunk(OpCode.ADD));
      return context.chunks;
    }
    case ",": {
      const left = ast.children[0];
      const right = ast.children[1];
      transform(left, context);
      transform(right, context);
      context.chunks.push(chunk(OpCode.TUPLE));
      return context.chunks;
    }
    case "return": {
      const expr = ast.children[0];
      transform(expr, context);
      context.chunks.push(chunk(OpCode.RETURN));
      return context.chunks;
    }
    case "=": {
      const left = ast.children[0];
      const right = ast.children[1];
      const name: string = left.value;

      transform(right, context);
      context.chunks.push(chunk(OpCode.REPLACE, { name }));
      return context.chunks;
    }
    case ":=": {
      const left = ast.children[0];
      const right = ast.children[1];
      const name: string = left.value;

      transform(right, context);
      context.chunks.push(chunk(OpCode.DECLARE, { name }, { value: 0 }));
      return context.chunks;
    }
  }

  if (!context.partial) {
    context.chunks.push(chunk(OpCode.TRAP, { value: TrapCode.TRAP_HALT }));
  }

  return context.chunks;
};

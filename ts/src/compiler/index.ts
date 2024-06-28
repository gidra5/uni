import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { Register, toHex, type Address } from "../vm/utils.js";
import { chunkToByteCode, type CodeChunk } from "./chunks.js";

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

const chunk = (opcode: OpCode, arg1?: ChunkInArgument, arg2?: ChunkInArgument, arg3?: ChunkInArgument): Chunk =>
  ({
    arg1,
    arg2,
    arg3,
    opcode,
  } as Chunk);

type Context = {
  chunks: Chunk[];
  functionChunks: Chunk[][];
  data: number[][];
};

export class Compiler {
  context: Context = {
    chunks: [],
    functionChunks: [],
    data: [],
  };

  get functionOffsets() {
    return Iterator.iter(this.context.functionChunks)
      .map((chunk) => chunk.length)
      .prepend(this.context.chunks.length)
      .sum(true)
      .toArray();
  }

  get dataOffsets() {
    const dataStart = this.context.chunks.length + this.context.functionChunks.flat().length + 1;
    return Iterator.iter(this.context.data)
      .map((data) => data.length)
      .prepend(dataStart)
      .sum(true)
      .toArray();
  }

  compileToChunks(ast: AbstractSyntaxTree) {
    // console.log(ast, this);
    if (ast.name === "operator") {
      if (ast.value === "true") {
        this.context.chunks.push(chunk(OpCode.PUSH, { value: true }));
        return this;
      } else if (ast.value === "false") {
        this.context.chunks.push(chunk(OpCode.PUSH, { value: false }));
        return this;
      } else if (ast.value === "parens") {
        return this.compileToChunks(ast.children[0]);
      } else if (ast.value === "brackets") {
        this.context.chunks.push(chunk(OpCode.PUSH_FRAME));
        this.compileToChunks(ast.children[0]);
        this.context.chunks.push(chunk(OpCode.POP_FRAME));
        return this;
      } else if (ast.value === "fn") {
        const body = ast.children[1];
        const name = ast.children[0].value;
        const bodyChunks = new Compiler();
        bodyChunks.context.chunks.push(chunk(OpCode.ENTRY_POINT));
        bodyChunks.context.chunks.push(chunk(OpCode.ASSIGN_NAME, { name }, { value: 1 }));
        bodyChunks.compileToChunks(body);
        bodyChunks.context.chunks.push(chunk(OpCode.RETURN));

        this.context.chunks.push(chunk(OpCode.PUSH, { value: bodyChunks.context.chunks }));
        return this;
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];
        this.compileToChunks(arg);
        this.compileToChunks(fn);
        this.context.chunks.push(chunk(OpCode.CALL));
        return this;
      } else if (ast.value === "print") {
        const expr = ast.children[0];

        this.compileToChunks(expr);
        this.context.chunks.push(chunk(OpCode.PRINT));

        return this;
      } else if (ast.value === ";") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      } else if (ast.value === "+") {
        const left = ast.children[0];
        const right = ast.children[1];
        this.compileToChunks(left).compileToChunks(right);
        this.context.chunks.push(chunk(OpCode.ADD));
        return this;
      } else if (ast.value === ",") {
        const left = ast.children[0];
        const right = ast.children[1];
        this.compileToChunks(left).compileToChunks(right);
        this.context.chunks.push(chunk(OpCode.TUPLE));
        return this;
      } else if (ast.value === "yield") {
        const expr = ast.children[0];
        return this.compileToChunks(expr);
      } else if (ast.value === "return") {
        const expr = ast.children[0];
        this.compileToChunks(expr);
        this.context.chunks.push(chunk(OpCode.RETURN));
        return this;
      } else if (ast.value === "=") {
        const left = ast.children[0];
        const right = ast.children[1];
        const name: string = left.value;

        this.compileToChunks(right);
        this.context.chunks.push(chunk(OpCode.REPLACE, { name }));
        return this;
      } else if (ast.value === ":=") {
        const left = ast.children[0];
        const right = ast.children[1];
        const name: string = left.value;

        this.compileToChunks(right);
        this.context.chunks.push(chunk(OpCode.ASSIGN_NAME, { name }));
      }
    } else if (ast.name === "float") {
      this.context.chunks.push(chunk(OpCode.PUSH, { value: ast.value }));
      return this;
    } else if (ast.name === "int") {
      this.context.chunks.push(chunk(OpCode.PUSH, { value: ast.value }));
      return this;
    } else if (ast.name === "string") {
      this.context.chunks.push(chunk(OpCode.PUSH, { value: ast.value }));
      return this;
    } else if (ast.name === "name") {
      const name: string = ast.value;
      this.context.chunks.push(chunk(OpCode.COPY, { name }));
      return this;
    }

    return this;
  }

  compile(ast: AbstractSyntaxTree): [code: number[], data: number[]] {
    const compiled = new Compiler().compileToChunks(ast);
    // console.dir(compiled, { depth: null });
    const { context } = compiled;
    const chunks = [...context.chunks];
    chunks.push(chunk(OpCode.TRAP, { value: TrapCode.TRAP_HALT }));
    chunks.push(...context.functionChunks.flat());

    const functionOffsets = compiled.functionOffsets;
    const dataOffsets = compiled.dataOffsets;
    const dataStart = dataOffsets[0];
    const data = context.data.flat();
    data[0] = dataStart + data.length;

    const code = (chunks as CodeChunk[]).map(chunkToByteCode);

    return [code, data];
  }

  static compileToAsm(ast: AbstractSyntaxTree): string {
    const [code, data] = new Compiler().compile(ast);

    const asm = code.map(disassemble);

    asm.push(...data.map((x: number) => `${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`));

    return asm.map((x, i) => `${toHex(i)}    ${x}`).join("\n");
  }

  static compileToBinary(ast: AbstractSyntaxTree, offset: number): Uint16Array {
    const [code, data] = new Compiler().compile(ast);

    const asm = code.map(disassemble);
    asm.push(...data.map((x: number) => `${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`));
    asm.forEach((x, i) => console.log(`${toHex(i)}    ${x}`));

    const _chunks = code.concat(data);
    _chunks.unshift(offset);
    return new Uint16Array(_chunks);
  }
}

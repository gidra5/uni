import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { toHex } from "../vm/utils.js";
import { chunkToByteCode, type CodeChunk } from "./chunks.js";
import { newContext, transform } from "../transformers/flatten.js";

export class Compiler {
  static compile(ast: AbstractSyntaxTree): [code: number[], data: number[]] {
    const [...chunks] = transform(ast, newContext(false));
    // chunks.push(...context.functionChunks.flat());

    // const functionOffsets = Iterator.iter(context.functionChunks)
    //   .map((chunk) => chunk.length)
    //   .prepend(context.chunks.length)
    //   .sum(true)
    //   .toArray();
    // const dataStart = context.chunks.length + context.functionChunks.flat().length + 1;
    // const dataOffsets = Iterator.iter(context.data)
    //   .map((data) => data.length)
    //   .prepend(dataStart)
    //   .sum(true)
    //   .toArray();
    // const data = context.data.flat();
    // data[0] = dataStart + data.length; // stack base pointer

    const code = (chunks as CodeChunk[]).map(chunkToByteCode);

    // return [code, data];
    return [code, []];
  }

  static compileToAsm(ast: AbstractSyntaxTree): string {
    const [code, data] = Compiler.compile(ast);

    const asm = code.map(disassemble);

    asm.push(...data.map((x: number) => `${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`));

    return asm.map((x, i) => `${toHex(i)}    ${x}`).join("\n");
  }

  static compileToBinary(ast: AbstractSyntaxTree, offset: number): Uint16Array {
    const [code, data] = Compiler.compile(ast);

    const asm = code.map(disassemble);
    asm.push(...data.map((x: number) => `${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`));
    asm.forEach((x, i) => console.log(`${toHex(i)}    ${x}`));

    const _chunks = code.concat(data);
    _chunks.unshift(offset);
    return new Uint16Array(_chunks);
  }
}

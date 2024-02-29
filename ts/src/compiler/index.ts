import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { toHex } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";
import { CopySymbol, copy } from "../utils/copy.js";
import { omit } from "../utils/index.js";
import { InstructionFactory } from "./stackAdapter.js";

type Context = {
  chunks: CodeChunk[];
  functionChunks: CodeChunk[][];
  data: number[][];
};

export class Compiler {
  adapter = new InstructionFactory();
  private context: Context = {
    chunks: [],
    data: [[0]],
    functionChunks: [],
  };

  constructor(context?: Partial<Context>) {
    if (context)
      this.context = {
        ...this.context,
        ...context,
        // get registers() {
        //   return this.registerState.state.flatMap((x, i) => (x ? { ...x, reg: i } : []));
        // },
      };
  }

  get functionOffsets() {
    return Iterator.iter(this.context.functionChunks)
      .map((chunk) => chunk.length)
      .prepend(this.context.chunks.length)
      .sum(true)
      .toArray();
  }

  get dataOffsets() {
    const dataStart = this.context.chunks.length + this.context.functionChunks.flat().length;
    return Iterator.iter(this.context.data)
      .map((data) => data.length)
      .prepend(dataStart)
      .sum(true)
      .toArray();
  }

  [CopySymbol]() {
    return this.copy();
  }

  copy() {
    const copied = new Compiler(copy(this.context));
    copied.adapter = copy(this.adapter);
    return copied;
  }

  update(mapper: (c: Compiler) => Compiler) {
    return mapper(this.copy());
  }

  pushData(...data: number[][]) {
    return this.update((c) => {
      c.context.data.push(...data);
      return c;
    });
  }

  pushChunk(...code: CodeChunk[]) {
    return this.update((c) => {
      // console.log(c.context.registers);
      // console.log(code.map(chunkToString).join("\n"));
      // console.log("");

      c.context.chunks.push(...code);
      return c;
    });
  }

  pushFunctionChunk(...code: CodeChunk[][]) {
    return this.update((c) => {
      c.context.functionChunks.push(...code);
      return c;
    });
  }

  private compileToChunks(ast: AbstractSyntaxTree): Compiler {
    // console.log(ast, this);
    if (ast.name === "group") {
      if (ast.value === "true") {
        return this.pushData([-1]);
      } else if (ast.value === "false") {
        return this.pushData([0]);
      } else if (ast.value === "parens") {
        return this.compileToChunks(ast.children[0]);
      } else if (ast.value === "brackets") {
        // const stackSize = this.adapter.stack.size();
        return this.compileToChunks(ast.children[0]).update((c) => {
          // const newSize = c.adapter.stack.size();
          // const toDrop = newSize - (stackSize + 1);
          return c;
        });
      }
    } else if (ast.name === "operator") {
      if (ast.value === "->" || ast.value === "fn") {
        const body = ast.children[1];
        const codeIndex = this.context.chunks.length;
        const dataIndex = this.context.data.length;
        // console.log("fn", this.context.registers);

        const compiledBody = new Compiler().compileToChunks(body);

        return this.pushFunctionChunk(compiledBody.context.chunks.slice(codeIndex)).pushData(
          ...compiledBody.context.data.slice(dataIndex)
        );
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];

        return this.compileToChunks(arg).compileToChunks(fn);
      } else if (ast.value === "print") {
        const expr = ast.children[0];
        return this;
      } else if (ast.value === ";") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      } else if (ast.value === "+") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      } else if (ast.value === "*") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      }
    } else if (ast.name === "float") {
      // TODO: encode float? because we are using 16-bit words, js uses 64-bit floats
      return this;
    } else if (ast.name === "int") {
      return this;
    } else if (ast.name === "string") {
      const string: string = ast.value;
      const data: number[] = [];

      // null-terminated string
      for (const char of string) {
        const charCode = char.charCodeAt(0);
        data.push(charCode);
      }
      data.push(0);

      return this.pushData(data);
    } else if (ast.name === "name") {
      const name: string = ast.value;
      const value = this.adapter.stack.get({ name });
      if (value === undefined) {
        return this;
      }
      // console.log("name", name, value, reg);

      return this;
    }

    return this;
  }

  static compileToAsm(ast: AbstractSyntaxTree): string {
    const compiled = new Compiler().compileToChunks(ast);
    const { context } = compiled;
    const chunks = [...context.chunks];
    chunks.push(chunk(OpCode.TRAP, { value: TrapCode.TRAP_HALT }));
    chunks.push(...context.functionChunks.flat());

    const functionOffsets = compiled.functionOffsets;
    const dataOffsets = compiled.dataOffsets;
    const dataStart = dataOffsets[0];
    const data = context.data.flat();
    data[0] = dataStart + data.length;

    const code = context.chunks.map(chunkToByteCode(functionOffsets, dataOffsets));
    const asm = code.map((instruction, i) => `${toHex(i)}   ${disassemble(instruction)}`);

    const dataToString = (x: number, i: number) =>
      `${toHex(i + dataStart)}   ${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`;
    asm.push(...data.map(dataToString));

    return asm.join("\n");
  }

  static compile(ast: AbstractSyntaxTree, offset: number): Uint16Array {
    const compiled = new Compiler().compileToChunks(ast);
    const { context } = compiled;
    const chunks = [...context.chunks];
    chunks.push(chunk(OpCode.TRAP, { value: TrapCode.TRAP_HALT }));
    chunks.push(...context.functionChunks.flat());

    const functionOffsets = compiled.functionOffsets;
    const dataOffsets = compiled.dataOffsets;
    const dataStart = dataOffsets[0];
    const data = context.data.flat();
    data[0] = offset + dataStart + data.length;

    const code = chunks.map(chunkToByteCode(functionOffsets, dataOffsets));
    console.log(code.map((instruction, i) => `${toHex(i)}   ${disassemble(instruction)}`).join("\n"));
    const dataToString = (x: number, i: number) =>
      `${toHex(i + dataStart)}   ${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`;
    console.log(data.map(dataToString).join("\n"));
    const _chunks = code.concat(data);
    _chunks.unshift(offset);
    return new Uint16Array(_chunks);
  }
}

import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { Register, toHex } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";
import { CopySymbol, copy } from "../utils/copy.js";
import { omit } from "../utils/index.js";
import { InstructionFactory } from "./instructionsFactory.js";

type Context = {
  chunks: CodeChunk[];
  functionChunks: CodeChunk[][];
  data: number[][];
};

export class Compiler {
  factory = new InstructionFactory((data) => {
    const dataOffset = this.context.data.length;
    this.context.data.push(data);
    return dataOffset;
  }, this.chunkPush);

  private context: Context = { chunks: [], data: [[0]], functionChunks: [] };

  constructor(context?: Partial<Context>) {
    if (!context) return;
    this.context = { ...this.context, ...context };
  }

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

  [CopySymbol]() {
    return this.copyThis();
  }

  copyThis() {
    const copied = new Compiler(copy(this.context));
    copied.factory = copy(this.factory);
    return copied;
  }

  update(mapper: (c: Compiler) => Compiler) {
    return mapper(this.copyThis());
  }

  inspect(f: (c: Compiler) => void) {
    f(this);
    return this;
  }

  dataPush(...data: number[][]) {
    return this.update((c) => {
      c.context.data.push(...data);
      return c;
    });
  }

  chunkPush(...code: CodeChunk[]) {
    return this.update((c) => {
      // console.log(c.context.registers);
      // console.log(code.map(chunkToString).join("\n"));
      // console.log("");

      c.context.chunks.push(...code);
      return c;
    });
  }

  functionChunkPush(...code: CodeChunk[][]) {
    return this.update((c) => {
      c.context.functionChunks.push(...code);
      return c;
    });
  }

  private stackJoin(index: number, count: number) {
    return this.update((c) => {
      c.factory.join(index, count);
      return c;
    });
  }

  private stackDrop(count: number) {
    return this.update((c) => {
      c.factory.stack = c.factory.stack.drop(count);
      return c;
    });
  }

  private push(f: Register | ((reg: Register) => CodeChunk[])) {
    return this.update((c) => c.chunkPush(...c.factory.push(f)));
  }

  private pop(f: Register | ((reg: Register) => CodeChunk[])) {
    return this.update((c) => c.chunkPush(...c.factory.pop(f)));
  }

  private pushConstant(value: number) {
    const dataOffset = this.context.data.length;
    return this.dataPush([value]).push((reg1) => [chunk(OpCode.LOAD, { reg1, dataOffset })]);
  }

  private pushPointer(...value: number[]) {
    const dataOffset = this.context.data.length;
    return this.dataPush(value).push((reg1) => [chunk(OpCode.LOAD_EFFECTIVE_ADDRESS, { reg1, dataOffset })]);
  }

  pushFunctionPointer(chunks: CodeChunk[]) {
    const functionOffset = this.context.functionChunks.length;
    return this.functionChunkPush(chunks).push((reg1) => [
      chunk(OpCode.LOAD_EFFECTIVE_ADDRESS, { reg1, functionOffset }),
    ]);
  }

  private copy(reg: Register) {
    return this.update((c) => c.chunkPush(...c.factory.copy(reg)));
  }

  private replace(reg: Register) {
    return this.update((c) => c.chunkPush(...c.factory.replace(reg)));
  }

  private add() {
    return this.update((c) => c.chunkPush(...c.factory.add()));
  }

  private call() {
    return this.update((c) => c.chunkPush(...c.factory.call()));
  }

  private entry(closureSize: number = 0) {
    return this.update((c) => c.chunkPush(...c.factory.entry(closureSize)));
  }

  private return() {
    return this.update((c) => c.chunkPush(...c.factory.return()));
  }

  private yield() {
    return this.update((c) => c.chunkPush(...c.factory.yield()));
  }

  private print() {
    return this.pop(Register.R_R0).chunkPush(chunk(OpCode.TRAP, { value: TrapCode.TRAP_PUTS }));
  }

  private assignName(name: string, index: number) {
    return this.update((c) => {
      c.factory.stack = c.factory.stack.assignName({ index }, name);
      return c;
    });
  }

  private compileToChunks(ast: AbstractSyntaxTree): Compiler {
    // console.log(ast, this);
    if (ast.name === "group") {
      if (ast.value === "true") {
        return this.pushConstant(-1);
      } else if (ast.value === "false") {
        return this.pushConstant(0);
      } else if (ast.value === "parens") {
        return this.compileToChunks(ast.children[0]);
      } else if (ast.value === "brackets") {
        const stackSize = this.factory.stack.size();
        return this.compileToChunks(ast.children[0]).update((c) => {
          const newSize = c.factory.stack.size();
          const toDrop = newSize - (stackSize + 1);

          return c.stackDrop(toDrop);
        });
      }
    } else if (ast.name === "operator") {
      if (ast.value === "fn") {
        const body = ast.children[1];
        const name = ast.children[0].value;
        // console.log("fn", this.context.registers);

        return this.update((c) => {
          const bodyCompiler = new Compiler(omit(c.context, ["chunks"]));
          const compiledBody = bodyCompiler.entry().assignName(name, 1).compileToChunks(body).return();

          return c.pushFunctionPointer(compiledBody.context.chunks);
        });
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];

        return this.compileToChunks(arg).compileToChunks(fn).call();
      } else if (ast.value === "print") {
        const expr = ast.children[0];
        return this.compileToChunks(expr).print();
      } else if (ast.value === ";") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      } else if (ast.value === "+") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right).add();
      } else if (ast.value === ",") {
        const left = ast.children[0];
        const right = ast.children[1];
        const index = this.factory.stack.size();
        return this.compileToChunks(left).compileToChunks(right).stackJoin(index, 2);
      } else if (ast.value === "yield") {
        const expr = ast.children[0];
        return this.compileToChunks(expr).yield();
      } else if (ast.value === "return") {
        const expr = ast.children[0];
        return this.compileToChunks(expr).return();
      } else if (ast.value === "=") {
        const left = ast.children[0];
        const right = ast.children[1];
        const name: string = left.value;
        const value = this.factory.stack.get({ name });
        if (value === undefined) {
          return this;
        }
        // console.log("name", name, value, reg);

        return this.compileToChunks(right).replace(value.index);
      } else if (ast.value === ":=") {
        const left = ast.children[0];
        const right = ast.children[1];
        const name: string = left.value;
        const index = this.factory.stack.size();
        // console.log("name", name, value, reg);

        return this.compileToChunks(right).assignName(name, index);
      }
    } else if (ast.name === "float") {
      // TODO: encode float? because we are using 16-bit words, js uses 64-bit floats
      return this.pushConstant(ast.value);
    } else if (ast.name === "int") {
      return this.pushConstant(ast.value);
    } else if (ast.name === "string") {
      const string: string = ast.value;
      const data: number[] = [];

      // null-terminated string
      for (const char of string) {
        const charCode = char.charCodeAt(0);
        data.push(charCode);
      }
      data.push(0);

      return this.pushPointer(...data);
    } else if (ast.name === "name") {
      const name: string = ast.value;
      const value = this.factory.stack.get({ name });
      if (value === undefined) {
        return this;
      }
      // console.log("name", name, value, reg);

      return this.copy(value.index);
    }

    return this;
  }

  static compileToAsm(ast: AbstractSyntaxTree): string {
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

    const code = chunks.map(chunkToByteCode(functionOffsets, dataOffsets));
    const asm = code.map(disassemble);

    asm.push(...data.map((x: number) => `${toHex(x)} | ${String(x).padStart(6, " ")} | ${String.fromCharCode(x)}`));

    return asm.map((x, i) => `${toHex(i)}    ${x}`).join("\n");
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

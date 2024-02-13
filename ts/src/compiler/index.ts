import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { OpCode, TrapCode } from "../vm/handlers.js";
import { Register } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";

type Context = {
  scope: Scope;
  chunks: CodeChunk[];
  data: number[][];
  occupiedRegisters: Register[];
};

export class Compiler {
  private context: Context = { scope: new Scope(), chunks: [], data: [], occupiedRegisters: [] };
  constructor(context?: Context) {
    if (context) this.context = context;
  }

  isOccupied(register: Register) {
    return this.context.occupiedRegisters.includes(register);
  }

  unoccupy(register: Register) {
    const copy = this.copy();
    copy.context.occupiedRegisters = copy.context.occupiedRegisters.filter((r) => r !== register);
    return copy;
  }

  occupy(register: Register) {
    const copy = this.copy();
    copy.context.occupiedRegisters.push(register);
    return copy;
  }

  unoccupyForChunks(chunks: CodeChunk[]) {}

  copy() {
    const context: Context = {
      ...this.context,
      scope: this.context.scope.copy(),
      chunks: [...this.context.chunks],
      data: [...this.context.data],
    };
    return new Compiler(context);
  }

  pushData(data: number[]) {
    const copy = this.copy();
    copy.context.data.push(data);
    return copy;
  }

  pushChunk(...code: CodeChunk[]) {
    const copy = this.copy();
    copy.context.chunks.push(...code);
    return copy;
  }

  scopeAdd(name: string, value: any) {
    const copy = this.copy();
    copy.context.scope = copy.context.scope.add(name, value);
    return copy;
  }

  private compileToChunks(ast: AbstractSyntaxTree): Compiler {
    if (ast.name === "group") {
      if (ast.value === "true") {
        return this.pushData([-1]);
      } else if (ast.value === "false") {
        return this.pushData([0]);
      } else {
      }
    } else if (ast.name === "operator") {
      if (ast.value === "->" || ast.value === "fn") {
        const name: string = ast.children[0].value;
        const expr = ast.children[1];
        return this.scopeAdd(name, expr);
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];
        const compiledFn = this.compileToChunks(fn);
        const compiledArg = this.compileToChunks(arg);
        const dataOffset = this.context.data.length;
        const stackOffset = this.context.scope.size();
        const compiled = compiledFn.pushChunk(
          chunk(OpCode.OP_ST, { stackOffset, reg1: Register.R_R6 }),
          chunk(OpCode.OP_ST, { stackOffset: stackOffset + 1, reg1: Register.R_R7 }),
          chunk(OpCode.OP_LD, { dataOffset, reg1: Register.R_R6 }),
          chunk(OpCode.OP_LD, { dataOffset: dataOffset + 1, reg1: Register.R_R7 }),
          chunk(OpCode.OP_ADD, { reg1: Register.R_R6, reg2: Register.R_R6, reg3: Register.R_R6 }),
          chunk(OpCode.OP_ADD, { reg1: Register.R_R7, reg2: Register.R_R7, reg3: Register.R_R7 })
        );
        return compiled;
      } else if (ast.value === "print") {
        const expr = ast.children[0];
        const dataOffset = this.context.data.length;
        let compiled = this.compileToChunks(expr);
        compiled = compiled.pushChunk(
          chunk(OpCode.OP_LEA, { dataOffset, reg1: Register.R_R0 }),
          chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_PUTS })
        );

        return compiled;
      }
    } else if (ast.name === "float") {
      // TODO: encode float? because we are using 16-bit words, js uses 64-bit floats
      return this.pushData([ast.value]);
    } else if (ast.name === "int") {
      return this.pushData([ast.value]);
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
      const name = ast.value;
      const value = this.context.scope.get(name);
      if (value === undefined) {
        return this.pushData([0]);
      }
      return this.pushChunk(chunk(OpCode.OP_LD, { stackOffset: name.index, reg1: Register.R_R0 }));
    }

    return this;
  }

  static compile(ast: AbstractSyntaxTree, offset: number): Uint16Array {
    const { context } = new Compiler().compileToChunks(ast);
    context.chunks.push(chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_HALT }));

    const dataStart = context.chunks.length;
    const data = context.data.flat();
    const stackStart = dataStart + data.length;
    const code = context.chunks.map(chunkToByteCode(dataStart, stackStart));
    const _chunk = code.concat(data);
    _chunk.unshift(offset);
    return new Uint16Array(_chunk);
  }
}

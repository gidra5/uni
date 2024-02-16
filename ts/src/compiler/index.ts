import { Iterator } from "iterator-js";
import { AbstractSyntaxTree } from "../parser/ast.js";
import { Scope } from "../scope.js";
import { OpCode, TrapCode, disassemble } from "../vm/handlers.js";
import { Register, toHex } from "../vm/utils.js";
import { CodeChunk, chunk, chunkToByteCode } from "./chunks.js";

type Context = {
  scope: Scope;
  stack: Scope;
  stackFrames: number[];
  chunks: CodeChunk[];
  functionChunks: CodeChunk[][];
  data: number[][];
  occupiedRegisters: number[];
};

export class Compiler {
  private context: Context = {
    scope: new Scope(),
    stack: new Scope(),
    stackFrames: [],
    chunks: [],
    data: [],
    occupiedRegisters: [],
    functionChunks: [],
  };
  constructor(context?: Context) {
    if (context) this.context = context;
  }

  copy() {
    const context: Context = {
      ...this.context,
      scope: this.context.scope.copy(),
      chunks: [...this.context.chunks],
      data: [...this.context.data],
    };
    return new Compiler(context);
  }

  pushData(...data: number[][] | [(c: Compiler) => number[]]) {
    const copy = this.copy();
    const _data = (typeof data[0] === "function" ? data[0](copy) : data) as number[][];
    copy.context.data.push(..._data);
    return copy;
  }

  pushChunk(...code: CodeChunk[] | [(c: Compiler) => CodeChunk[]]) {
    const copy = this.copy();
    const chunks = (typeof code[0] === "function" ? code[0](copy) : code) as CodeChunk[];
    copy.context.chunks.push(...chunks);
    return copy;
  }

  pushFunctionChunk(...code: CodeChunk[][]) {
    const copy = this.copy();
    copy.context.functionChunks.push(...code);
    return copy;
  }

  scopeAdd(name: string, value: any = {}) {
    const copy = this.copy();
    copy.context.scope = copy.context.scope.add(name, value);
    return copy;
  }

  scopePush(value: any = {}) {
    const copy = this.copy();
    copy.context.scope = copy.context.scope.push(value);
    return copy;
  }

  scopePop() {
    const copy = this.copy();
    copy.context.scope = copy.context.scope.removeByRelativeIndex(0);
    return copy;
  }

  stackPush(value: any = {}) {
    const copy = this.copy();
    copy.context.stack = copy.context.stack.push(value);
    return copy;
  }

  stackPop() {
    const copy = this.copy();
    copy.context.stack = copy.context.stack.removeByRelativeIndex(0);
    return copy;
  }

  stackPushInstruction(reg: Register) {
    return this.pushChunk(chunk(OpCode.OP_ST, { stackOffset: this.context.stack.size(), reg1: reg })).stackPush();
  }

  stackPopInstruction(reg: Register) {
    return this.stackPop().pushChunk(chunk(OpCode.OP_LD, { stackOffset: this.context.stack.size() - 1, reg1: reg }));
  }

  // occupyRegister() {
  //   const copy = this.copy();
  //   copy.context.occupiedRegisters++;
  //   return copy;
  // }

  // releaseRegister() {
  //   const copy = this.copy();
  //   copy.context.occupiedRegisters.push;
  //   return copy;
  // }

  private compileToChunks(ast: AbstractSyntaxTree): Compiler {
    // console.log(ast);

    if (ast.name === "group") {
      if (ast.value === "true") {
        return this.pushData([-1]);
      } else if (ast.value === "false") {
        return this.pushData([0]);
      } else if (ast.value === "parens") {
        return this.compileToChunks(ast.children[0]);
      } else {
      }
    } else if (ast.name === "operator") {
      if (ast.value === "->" || ast.value === "fn") {
        const name: string = ast.children[0].value;
        const expr = ast.children[1];
        const codeIndex = this.context.chunks.length;
        const dataIndex = this.context.data.length;
        const withName = this.scopeAdd(name);
        const compiled = withName
          .compileToChunks(expr)
          .pushChunk(
            chunk(OpCode.OP_LD, { stackOffset: this.context.stack.size() - 1, reg1: Register.R_R0 }),
            chunk(OpCode.OP_JMP, { reg1: Register.R_R0 })
          );
        return this.pushFunctionChunk(compiled.context.chunks.slice(codeIndex))
          .pushData(...compiled.context.data.slice(dataIndex))
          .pushChunk(chunk(OpCode.OP_LEA, { reg1: Register.R_R0, functionOffset: this.context.functionChunks.length }))
          .stackPushInstruction(Register.R_R0);
      } else if (ast.value === "application") {
        const fn = ast.children[0];
        const arg = ast.children[1];
        return this.stackPush()
          .compileToChunks(arg)
          .compileToChunks(fn)
          .pushData((compiler) => [compiler.context.chunks.length + 4])
          .pushChunk((compiler) => [
            chunk(OpCode.OP_LD, { dataOffset: compiler.context.data.length - 1, reg1: Register.R_R0 }),
            chunk(OpCode.OP_ST, { stackOffset: this.context.stack.size(), reg1: Register.R_R0 }),
          ])
          .stackPopInstruction(Register.R_R0)
          .pushChunk(chunk(OpCode.OP_JMP, { reg1: Register.R_R0 }));
      } else if (ast.value === "print") {
        const expr = ast.children[0];
        const dataOffset = this.context.data.length;
        let compiled = this.compileToChunks(expr);
        compiled = compiled.pushChunk(
          chunk(OpCode.OP_LEA, { dataOffset, reg1: Register.R_R0 }),
          chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_PUTS })
        );

        return compiled;
      } else if (ast.value === ";") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left).compileToChunks(right);
      } else if (ast.value === "+") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left)
          .compileToChunks(right)
          .stackPopInstruction(Register.R_R0)
          .stackPopInstruction(Register.R_R1)
          .pushChunk(chunk(OpCode.OP_ADD, { reg1: Register.R_R0, reg2: Register.R_R1, reg3: Register.R_R2 }))
          .stackPushInstruction(Register.R_R2);
      } else if (ast.value === "*") {
        const left = ast.children[0];
        const right = ast.children[1];
        return this.compileToChunks(left)
          .compileToChunks(right)
          .pushChunk(
            chunk(OpCode.OP_LD, { stackOffset: this.context.scope.size(), reg1: Register.R_R0 }),
            chunk(OpCode.OP_LD, { stackOffset: this.context.scope.size() + 1, reg1: Register.R_R1 }),

            chunk(OpCode.OP_ST, { stackOffset: this.context.scope.size(), reg1: Register.R_R2 })
          );
      }
    } else if (ast.name === "float") {
      // TODO: encode float? because we are using 16-bit words, js uses 64-bit floats
      return this.pushData([ast.value]);
    } else if (ast.name === "int") {
      return this.pushData([ast.value])
        .pushChunk(chunk(OpCode.OP_LD, { reg1: Register.R_R0, dataOffset: this.context.data.length }))
        .stackPushInstruction(Register.R_R0);
    } else if (ast.name === "string") {
      const string: string = ast.value;
      const data: number[] = [];

      // null-terminated string
      for (const char of string) {
        const charCode = char.charCodeAt(0);
        data.push(charCode);
      }
      data.push(0);

      return this.pushData(data)
        .pushChunk(chunk(OpCode.OP_LD, { reg1: Register.R_R0, dataOffset: this.context.data.length }))
        .stackPushInstruction(Register.R_R0);
    } else if (ast.name === "name") {
      const name: string = ast.value;
      const value = this.context.scope.get({ name });
      if (value === undefined) {
        return this;
      }
      return this.pushChunk(
        chunk(OpCode.OP_LD, { stackOffset: value.index, reg1: Register.R_R0 })
      ).stackPushInstruction(Register.R_R0);
    }

    return this;
  }

  static compile(ast: AbstractSyntaxTree, offset: number): Uint16Array {
    const { context } = new Compiler().compileToChunks(ast);
    context.chunks.push(chunk(OpCode.OP_TRAP, { value: TrapCode.TRAP_HALT }));

    const functionOffsets = Iterator.iter(context.functionChunks)
      .map((chunk) => chunk.length)
      .prepend(context.chunks.length)
      .sum(true)
      .toArray();
    context.chunks.push(...context.functionChunks.flat());
    const dataStart = context.chunks.length;
    const dataOffsets = Iterator.iter(context.data)
      .map((data) => data.length)
      .prepend(dataStart)
      .sum(true)
      .toArray();
    const data = context.data.flat();
    const stackStart = dataStart + data.length;
    const code = context.chunks.map(chunkToByteCode(functionOffsets, dataOffsets, stackStart));
    console.log(code.map((instruction, i) => `${toHex(i)}   ${disassemble(instruction)}`).join("\n"));
    console.log(data.map((x, i) => `${toHex(i + dataStart)}   ${x}`).join("\n"));
    const _chunk = code.concat(data);
    _chunk.unshift(offset);
    return new Uint16Array(_chunk);
  }
}

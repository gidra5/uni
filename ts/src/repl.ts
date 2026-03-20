import { FileMap } from "codespan-napi";
import { validate, validateTokenGroups } from "./analysis/validate.js";
import { SystemError } from "./error.js";
import { parseScript } from "./parser/parser.js";
import { parseTokenGroups } from "./parser/tokenGroups.js";
import { Injectable, inject } from "./utils/injector.js";
import { generateVm2Bytecode, VM } from "./vm/index.js";
import type { ClosureEnv } from "./vm/instructions.js";

export type ReplEvaluation =
  | {
      kind: "success";
      label: string;
      result: unknown;
    }
  | {
      kind: "diagnostic";
      label: string;
      fileId: number;
      fileMap: FileMap;
      errors: SystemError[];
    }
  | {
      kind: "unexpected-error";
      label: string;
      fileId: number;
      fileMap: FileMap;
      error: unknown;
    };

export type ReplLineOutcome = { kind: "empty" } | { kind: "exit" } | { kind: "evaluated"; evaluation: ReplEvaluation };

const diagnosticResult = (label: string, errors: SystemError[], fileId: number, fileMap: FileMap): ReplEvaluation => ({
  kind: "diagnostic",
  label,
  fileId,
  fileMap,
  errors: errors.map((error) => error.withFileId(fileId)),
});

export class ReplSession {
  private replLine = 0;
  private env?: ClosureEnv;

  constructor(private readonly vm = new VM()) {}

  evaluate(source: string, label: string): ReplEvaluation {
    const fileMap = inject(Injectable.FileMap);
    fileMap.addFile(label, source);
    const fileId = fileMap.getFileId(label);

    try {
      const tokens = parseTokenGroups(source);
      const [tokenErrors, validatedTokens] = validateTokenGroups(tokens);
      if (tokenErrors.length > 0) return diagnosticResult(label, tokenErrors, fileId, fileMap);

      const [astErrors, ast] = validate(parseScript(validatedTokens));
      if (astErrors.length > 0) return diagnosticResult(label, astErrors, fileId, fileMap);

      const bytecode = generateVm2Bytecode(ast);
      this.vm.addProgram(label, bytecode);
      const execution = this.vm.runWithEnv(`${label}:main`, this.env);
      this.env = execution.env;

      return {
        kind: "success",
        label,
        result: execution.result,
      };
    } catch (error) {
      if (error instanceof SystemError) {
        return diagnosticResult(label, [error], fileId, fileMap);
      }

      return {
        kind: "unexpected-error",
        label,
        fileId,
        fileMap,
        error,
      };
    }
  }

  handleLine(line: string): ReplLineOutcome {
    const trimmed = line.trim();
    if (trimmed === "") return { kind: "empty" };
    if (trimmed === "exit") return { kind: "exit" };

    return {
      kind: "evaluated",
      evaluation: this.evaluate(trimmed, `<repl:${++this.replLine}>`),
    };
  }
}

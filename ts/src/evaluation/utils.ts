import { Diagnostic, primaryDiagnosticLabel } from "codespan-napi";
import { inject, Injectable } from "../utils/injector.js";
import { getPosition } from "../parser/parser.js";
import { Tree } from "../ast.js";
import { Position } from "../utils/position.js";

type CompileContext = Readonly<{
  fileId: number;
}>;

export const showPos = (position: Position, context: CompileContext, msg: string = "") => {
  const diag = Diagnostic.note();

  diag.withLabels([
    primaryDiagnosticLabel(context.fileId, {
      message: msg,
      start: position.start,
      end: position.end,
    }),
  ]);
  const fileMap = inject(Injectable.FileMap);
  diag.emitStd(fileMap);
};

export const showNode = (node: Tree, context: CompileContext, msg: string = "") =>
  showPos(getPosition(node), context, msg);

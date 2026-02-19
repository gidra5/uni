import { beforeEach, describe, expect, it } from "vitest";
import { FileMap } from "codespan-napi";
import { parseTokenGroups } from "../src/parser/tokenGroups";
import { validateTokenGroups } from "../src/analysis/validate";
import { parseScript } from "../src/parser/parser";
import { Injectable, register } from "../src/utils/injector";
import {
  compileSourceToVm2Bytecode,
  generateVm2BytecodeFromAst,
  generateVm2BytecodeFromIr,
  type Program,
  VM,
} from "../src/vm/index";
import { lowerAstToEffectIr, type EffectIrNode } from "../src/ir/effects";

beforeEach(() => {
  register(Injectable.FileMap, new FileMap());
  register(Injectable.NextId, 0);
  register(Injectable.PrecedenceMap, new Map());
  register(Injectable.PositionMap, new Map());
});

const parseAst = (program: string) => {
  const tokens = parseTokenGroups(program);
  const [, validatedTokens] = validateTokenGroups(tokens);
  return parseScript(validatedTokens);
};

const collectKinds = (root: EffectIrNode) => {
  const kinds: string[] = [];
  const walk = (node: EffectIrNode) => {
    kinds.push(node.kind);
    switch (node.kind) {
      case "with":
        walk(node.handlers);
        walk(node.body);
        return;
      case "mask":
      case "without":
        walk(node.effect);
        walk(node.body);
        return;
      case "perform":
        walk(node.effect);
        walk(node.arg);
        return;
      case "performer":
        walk(node.effect);
        return;
      case "generic":
        node.children.forEach(walk);
        return;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  };
  walk(root);
  return kinds;
};

describe("effect IR pipeline", () => {
  it("normalizes effect syntax into algebraic-like IR nodes", () => {
    const ast = parseAst(`
      inject record { decide: 1 } {
        x := handle ($decide) ()
        mask $decide {
          without $other {
            x
          }
        }
      }
    `);
    const ir = lowerAstToEffectIr(ast);
    const kinds = collectKinds(ir.root);

    expect(kinds).toContain("with");
    expect(kinds).toContain("perform");
    expect(kinds).toContain("mask");
    expect(kinds).toContain("without");
  });

  it("preserves bytecode under AST -> IR -> bytecode lowering", () => {
    const ast = parseAst(`
      decide := $decide |> handle
      inject record {
        decide: handler fn (callback, _value) { callback true }
      } {
        if decide(): 1 else 2
      }
    `);

    const ir = lowerAstToEffectIr(ast);
    const legacy = generateVm2BytecodeFromAst(ast);
    const viaIr = generateVm2BytecodeFromIr(ir);

    const run = (program: Program) => {
      const vm = new VM();
      for (const [name, code] of Object.entries(program)) vm.addCode(name, code);
      return vm.run();
    };

    expect(run(viaIr)).toEqual(run(legacy));
  });

  it("compiles and executes through source -> IR -> bytecode -> interpret", () => {
    const bytecode = compileSourceToVm2Bytecode(`
      inject record { a: 7 } ->
      handle ($a) ()
    `);
    const vm = new VM();
    for (const [name, code] of Object.entries(bytecode)) vm.addCode(name, code);
    const result = vm.run();

    expect(result).toBe(7);
  });
});

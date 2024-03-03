import { Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { InstructionFactory } from "../../src/compiler/instructionsFactory";
import { registerStateToObject } from "../../src/compiler/utils";

describe("instructionFactory", () => {
  let pushData: Mock;
  let pushChunks: Mock;
  let factory: InstructionFactory;

  beforeEach(() => {
    pushData = vi.fn();
    pushChunks = vi.fn();
    factory = new InstructionFactory(pushData, pushChunks);
  });

  it("works", () => {
    factory.push(0);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }]);

    factory.push(1);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }, { value: { offset: 1, size: 1 } }]);

    factory.push(0);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0, 2]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 1 } },
      { value: { offset: 2, size: 1 } },
    ]);

    factory.get(0, 2);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0, 2]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      2: { value: { stackOffset: new Set([0]) }, stale: false, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 1 } },
      { value: { offset: 2, size: 1 } },
    ]);
  });
});

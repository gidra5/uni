import { Mock, beforeEach, describe, expect, it, vi, test } from "vitest";
import { InstructionFactory } from "../../src/compiler/instructionsFactory";
import { registerStateToObject } from "../../src/compiler/utils";
import { chunk } from "../../src/compiler/chunks";
import { OpCode } from "../../src/vm/handlers";

describe("instructionFactory", () => {
  let pushData: Mock;
  let pushChunks: Mock;
  let factory: InstructionFactory;

  beforeEach(() => {
    pushData = vi.fn();
    pushChunks = vi.fn();
    factory = new InstructionFactory(pushData, pushChunks);
  });

  it("stack state", () => {
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
      0: { value: { stackOffset: new Set([2]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      2: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 1 } },
      { value: { offset: 2, size: 1 } },
    ]);

    factory.set(0, 1);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([2]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1, 0]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 1 } },
      { value: { offset: 2, size: 1 } },
    ]);

    factory.get(0, 0);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      2: { value: { dataOffset: 0 }, stale: false, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 1 } },
      { value: { offset: 2, size: 1 } },
    ]);

    factory.get(2, 2);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      2: { value: { stackOffset: new Set([2]) }, stale: false, weak: true },
      3: { value: { dataOffset: 0 }, stale: false, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 1 } },
      { value: { offset: 2, size: 1 } },
    ]);

    factory.pop(1);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      3: { value: { dataOffset: 0 }, stale: false, weak: true },
    });
    expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }, { value: { offset: 1, size: 1 } }]);

    factory.pop(() => []);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      3: { value: { dataOffset: 0 }, stale: false, weak: true },
    });
    expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }]);

    factory.push(() => []);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      3: { value: { dataOffset: 0 }, stale: false, weak: true },
    });
    expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }, { value: { offset: 1, size: 1 } }]);

    factory.push(() => []);
    factory.push(() => []);
    factory.push(() => []);

    factory.join(1, 3);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      2: { value: { stackOffset: new Set([2]) }, stale: true, weak: true },
      3: { value: { dataOffset: 0 }, stale: false, weak: true },
      4: { value: { stackOffset: new Set([3]) }, stale: true, weak: true },
      5: { value: { stackOffset: new Set([4]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 3 } },
      { value: { offset: 4, size: 1 } },
    ]);

    factory.split(1, 2);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      2: { value: { stackOffset: new Set([2]) }, stale: true, weak: true },
      3: { value: { dataOffset: 0 }, stale: false, weak: true },
      4: { value: { stackOffset: new Set([3]) }, stale: true, weak: true },
      5: { value: { stackOffset: new Set([4]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 2 } },
      { value: { offset: 3, size: 1 } },
      { value: { offset: 4, size: 1 } },
    ]);

    factory.split(1, 1);

    expect(pushData).toBeCalledTimes(0);
    expect(pushChunks).toBeCalledTimes(0);
    expect(registerStateToObject(factory.registers.state)).toEqual({
      0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      2: { value: { stackOffset: new Set([2]) }, stale: true, weak: true },
      3: { value: { dataOffset: 0 }, stale: false, weak: true },
      4: { value: { stackOffset: new Set([3]) }, stale: true, weak: true },
      5: { value: { stackOffset: new Set([4]) }, stale: true, weak: true },
    });
    expect(factory.stack.scope).toEqual([
      { value: { offset: 0, size: 1 } },
      { value: { offset: 1, size: 1 } },
      { value: { offset: 2, size: 1 } },
      { value: { offset: 3, size: 1 } },
      { value: { offset: 4, size: 1 } },
    ]);

    // factory.push(() => []);
    // factory.push(() => []);
    // factory.push(() => []);
    // factory.push(() => []);
    // factory.push(() => []);
    // factory.join(2, 8);
    // factory.pop((...regs) => []);

    // expect(pushData).toBeCalledTimes(0);
    // expect(pushChunks).toBeCalledTimes(0);
    // expect(registerStateToObject(factory.registers.state)).toEqual({
    //   0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
    //   1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
    //   2: { value: { stackOffset: new Set([2]) }, stale: true, weak: true },
    //   3: { value: { dataOffset: 0 }, stale: false, weak: true },
    //   4: { value: { stackOffset: new Set([3]) }, stale: true, weak: true },
    //   5: { value: { stackOffset: new Set([4]) }, stale: true, weak: true },
    // });
    // expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }, { value: { offset: 1, size: 1 } }]);
  });

  describe("instructions", () => {
    test.only("add", () => {
      factory.push(() => []);
      factory.push(() => []);
      expect(registerStateToObject(factory.registers.state)).toEqual({
        0: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
        1: { value: { stackOffset: new Set([1]) }, stale: true, weak: true },
      });
      expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }, { value: { offset: 1, size: 1 } }]);

      expect(factory.add()).toEqual([chunk(OpCode.ADD, { reg1: 0, reg2: 1, reg3: 2 })]);
      expect(registerStateToObject(factory.registers.state)).toEqual({
        2: { value: { stackOffset: new Set([0]) }, stale: true, weak: true },
      });
      expect(factory.stack.scope).toEqual([{ value: { offset: 0, size: 1 } }]);
    });
  });
});

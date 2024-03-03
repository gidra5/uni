import { beforeEach, describe, expect, it } from "vitest";
import { registerStateToObject } from "../../src/compiler/utils";
import { RegisterState } from "../../src/compiler/registers";

describe("instructionFactory", () => {
  let state: RegisterState<any>;

  beforeEach(() => {
    state = new RegisterState<any>(8);
  });

  it("works", () => {
    state.set(0, { stackOffset: [0] });

    expect(registerStateToObject(state.state)).toEqual({
      0: { value: { stackOffset: [0] }, stale: true, weak: true },
    });
  });
});

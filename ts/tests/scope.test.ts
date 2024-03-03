import { describe, expect, it } from "vitest";
import { Scope } from "../src/scope";

describe("scope", () => {
  it("works", () => {
    let scope = new Scope<number>();
    scope = scope.push(1);
    expect(scope.getByRelativeIndex(0)).toEqual({ relativeIndex: 0, index: 0, value: 1 });
    expect(scope.getByIndex(0)).toEqual({ relativeIndex: 0, index: 0, value: 1 });

    scope = scope.add("a", 2);
    expect(scope.getByRelativeIndex(0)).toEqual({ relativeIndex: 0, index: 1, name: "a", value: 2 });
    expect(scope.getByIndex(1)).toEqual({ relativeIndex: 0, index: 1, name: "a", value: 2 });
    expect(scope.getByName("a")).toEqual({ relativeIndex: 0, index: 1, name: "a", value: 2 });
    expect(scope.getByRelativeIndex(1)).toEqual({ relativeIndex: 1, index: 0, value: 1 });
    expect(scope.getByIndex(0)).toEqual({ relativeIndex: 1, index: 0, value: 1 });

    scope = scope.append(new Scope<number>().add("b", 3).add("a", 4));
    expect(scope.getByRelativeIndex(0)).toEqual({ relativeIndex: 0, index: 3, name: "a", value: 4 });
    expect(scope.getByIndex(3)).toEqual({ relativeIndex: 0, index: 3, name: "a", value: 4 });
    expect(scope.getByName("a")).toEqual({ relativeIndex: 0, index: 3, name: "a", value: 4 });
    expect(scope.getByRelativeIndex(1)).toEqual({ relativeIndex: 1, index: 2, name: "b", value: 3 });
    expect(scope.getByIndex(2)).toEqual({ relativeIndex: 1, index: 2, name: "b", value: 3 });
    expect(scope.getByName("b")).toEqual({ relativeIndex: 1, index: 2, name: "b", value: 3 });
    expect(scope.getByRelativeIndex(2)).toEqual({ relativeIndex: 2, index: 1, name: "a", value: 2 });
    expect(scope.getByIndex(1)).toEqual({ relativeIndex: 2, index: 1, name: "a", value: 2 });
    expect(scope.getByRelativeIndex(3)).toEqual({ relativeIndex: 3, index: 0, value: 1 });
    expect(scope.getByIndex(0)).toEqual({ relativeIndex: 3, index: 0, value: 1 });

    expect(scope).toEqual({
      names: { a: 3, b: 2 },
      scope: [{ value: 1 }, { name: "a", value: 2 }, { name: "b", value: 3 }, { name: "a", value: 4 }],
    });

    const scope2 = scope.removeByName("a");
    expect(scope2.getByName("a")).toEqual({ relativeIndex: 1, index: 1, name: "a", value: 2 });

    scope = scope.removeAll("a");
    expect(scope.getByName("a")).toEqual(undefined);
  });
});

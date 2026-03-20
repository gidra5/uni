import { beforeEach, describe, expect, it } from "vitest";
import { reset } from "../src/utils/injector.js";
import { ReplSession } from "../src/repl.js";

beforeEach(() => {
  reset();
});

describe("repl session", () => {
  it("evaluates a single line", () => {
    const repl = new ReplSession();

    const outcome = repl.handleLine("1 + 2");

    expect(outcome).toMatchObject({
      kind: "evaluated",
      evaluation: {
        kind: "success",
        label: "<repl:1>",
        result: 3,
      },
    });
  });

  it("preserves bindings across lines", () => {
    const repl = new ReplSession();

    expect(repl.handleLine("x := 41")).toMatchObject({
      kind: "evaluated",
      evaluation: {
        kind: "success",
        label: "<repl:1>",
        result: 41,
      },
    });

    expect(repl.handleLine("x + 1")).toMatchObject({
      kind: "evaluated",
      evaluation: {
        kind: "success",
        label: "<repl:2>",
        result: 42,
      },
    });
  });

  it("loads initial source before interactive lines", () => {
    const repl = new ReplSession();

    expect(repl.evaluate("base := 40", "<initial>")).toMatchObject({
      kind: "success",
      label: "<initial>",
      result: 40,
    });

    expect(repl.handleLine("base + 2")).toMatchObject({
      kind: "evaluated",
      evaluation: {
        kind: "success",
        label: "<repl:1>",
        result: 42,
      },
    });
  });

  it("reports diagnostics and keeps the session usable", () => {
    const repl = new ReplSession();

    const failed = repl.handleLine("(");
    expect(failed.kind).toBe("evaluated");
    if (failed.kind !== "evaluated") {
      expect.unreachable("expected an evaluated outcome");
    }

    expect(failed.evaluation.kind).toBe("diagnostic");
    if (failed.evaluation.kind !== "diagnostic") {
      expect.unreachable("expected a diagnostic evaluation");
    }

    expect(failed.evaluation.label).toBe("<repl:1>");
    expect(failed.evaluation.errors).toHaveLength(1);
    expect(failed.evaluation.errors[0]?.message).toMatch(/missing closing token/i);

    expect(repl.handleLine("1 + 1")).toMatchObject({
      kind: "evaluated",
      evaluation: {
        kind: "success",
        label: "<repl:2>",
        result: 2,
      },
    });
  });

  it("signals exit without evaluating input", () => {
    const repl = new ReplSession();

    expect(repl.handleLine("exit")).toEqual({ kind: "exit" });
    expect(repl.handleLine("2 + 2")).toMatchObject({
      kind: "evaluated",
      evaluation: {
        kind: "success",
        label: "<repl:1>",
        result: 4,
      },
    });
  });
});

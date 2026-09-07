import { describe, it, expect } from "vitest";
import { ok, fail, type ActionResult } from "./action-result";

describe("action-result", () => {
  it("wraps a success value", () => {
    const r: ActionResult<number> = ok(42);
    expect(r).toEqual({ ok: true, data: 42 });
  });

  it("wraps a failure message", () => {
    expect(fail("Nope")).toEqual({ ok: false, error: "Nope" });
  });

  it("carries field errors when given", () => {
    expect(fail("Invalid", { email: ["Required"] })).toEqual({
      ok: false,
      error: "Invalid",
      fieldErrors: { email: ["Required"] },
    });
  });
});

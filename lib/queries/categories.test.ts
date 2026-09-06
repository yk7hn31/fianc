import { describe, it, expect } from "vitest";
import * as icons from "lucide-react";
import { DEFAULT_CATEGORIES } from "./categories.data";

describe("DEFAULT_CATEGORIES", () => {
  it("seeds at least one income category and several expense categories", () => {
    const income = DEFAULT_CATEGORIES.filter((c) => c.kind === "income");
    const expense = DEFAULT_CATEGORIES.filter((c) => c.kind === "expense");
    expect(income.length).toBeGreaterThanOrEqual(1);
    expect(expense.length).toBeGreaterThanOrEqual(6);
  });

  it("has no duplicate names", () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names only icons that exist in lucide-react", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(icons, `${c.name} → ${c.icon}`).toHaveProperty(c.icon);
    }
  });
});

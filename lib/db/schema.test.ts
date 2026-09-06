import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { transactions, budgets, users } from "./schema";

describe("schema", () => {
  it("stores money as bigint minor units", () => {
    const cols = getTableConfig(transactions).columns;
    const amount = cols.find((c) => c.name === "amount_minor");
    expect(amount?.getSQLType()).toBe("bigint");
  });

  it("scopes transactions by user", () => {
    const names = getTableConfig(transactions).columns.map((c) => c.name);
    expect(names).toContain("user_id");
    expect(names).toContain("transfer_group_id");
    expect(names).toContain("dedupe_hash");
  });

  it("carries an explicit direction so transfers can be signed", () => {
    const names = getTableConfig(transactions).columns.map((c) => c.name);
    expect(names).toContain("direction");
  });

  it("keys budgets by category and month", () => {
    const names = getTableConfig(budgets).columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(["category_id", "month", "amount_minor", "rollover"]),
    );
  });

  it("keeps email unique", () => {
    const email = getTableConfig(users).columns.find((c) => c.name === "email");
    expect(email?.isUnique).toBe(true);
  });
});

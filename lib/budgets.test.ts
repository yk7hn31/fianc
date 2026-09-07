import { describe, it, expect } from "vitest";
import {
  monthKey,
  addMonths,
  monthBounds,
  monthRange,
  foldRollover,
} from "./budgets";

describe("month helpers", () => {
  it("derives a month key from a date string", () => {
    expect(monthKey("2026-03-17")).toBe("2026-03");
  });

  it("adds months across a year boundary", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("builds an inclusive contiguous range", () => {
    expect(monthRange("2025-12", "2026-02")).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("bounds a 31-day month", () => {
    expect(monthBounds("2026-01")).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("bounds a 30-day month", () => {
    expect(monthBounds("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("bounds February in a common year and in a leap year", () => {
    expect(monthBounds("2026-02").to).toBe("2026-02-28");
    expect(monthBounds("2028-02").to).toBe("2028-02-29");
  });

  it("bounds December without rolling into the next year", () => {
    expect(monthBounds("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("returns a single month when from equals to", () => {
    expect(monthRange("2026-02", "2026-02")).toEqual(["2026-02"]);
  });
});

describe("foldRollover", () => {
  const months = monthRange("2026-01", "2026-04");

  it("without rollover, each month stands alone", () => {
    const result = foldRollover(
      months.map((month) => ({ month, amountMinor: 10000, rollover: false })),
      [{ month: "2026-01", spentMinor: 4000 }],
      months,
    );
    expect(result[0]).toMatchObject({ carryMinor: 0, remainingMinor: 6000 });
    expect(result[1]).toMatchObject({ carryMinor: 0, remainingMinor: 10000 });
  });

  it("with rollover, unspent budget carries forward", () => {
    const result = foldRollover(
      months.map((month) => ({ month, amountMinor: 10000, rollover: true })),
      [{ month: "2026-01", spentMinor: 4000 }],
      months,
    );
    expect(result[1]).toMatchObject({
      carryMinor: 6000,
      availableMinor: 16000,
      remainingMinor: 16000,
    });
  });

  it("with rollover, overspend eats into the next month", () => {
    const result = foldRollover(
      months.map((month) => ({ month, amountMinor: 10000, rollover: true })),
      [{ month: "2026-01", spentMinor: 13000 }],
      months,
    );
    expect(result[0].remainingMinor).toBe(-3000);
    expect(result[1]).toMatchObject({ carryMinor: -3000, availableMinor: 7000 });
  });

  // The spec, verbatim: "Months with no budget row contribute budget = 0 but
  // still carry." A budget row is only written when the user types an amount
  // or copies last month, so an unbudgeted month is the ordinary case.
  it("carries across a month that has no budget row", () => {
    const result = foldRollover(
      [
        { month: "2026-01", amountMinor: 10000, rollover: true },
        { month: "2026-03", amountMinor: 10000, rollover: true },
      ],
      [],
      months,
    );
    // Jan leaves 10000. Feb budgets nothing but still carries that 10000
    // forward untouched…
    expect(result[1]).toMatchObject({
      budgetMinor: 0,
      carryMinor: 10000,
      availableMinor: 10000,
      remainingMinor: 10000,
      rollover: true,
    });
    // …so March's own 10000 sits on top of it.
    expect(result[2]).toMatchObject({
      budgetMinor: 10000,
      carryMinor: 10000,
      availableMinor: 20000,
    });
  });

  it("spends from the carry in a month with no budget row", () => {
    const result = foldRollover(
      [{ month: "2026-01", amountMinor: 10000, rollover: true }],
      [{ month: "2026-02", spentMinor: 4000 }],
      monthRange("2026-01", "2026-03"),
    );
    expect(result[1]).toMatchObject({
      budgetMinor: 0,
      carryMinor: 10000,
      spentMinor: 4000,
      remainingMinor: 6000,
    });
    expect(result[2]).toMatchObject({ carryMinor: 6000, availableMinor: 6000 });
  });

  it("does not carry into a gap month before rollover was ever enabled", () => {
    const result = foldRollover(
      [{ month: "2026-01", amountMinor: 10000, rollover: false }],
      [],
      monthRange("2026-01", "2026-02"),
    );
    expect(result[1]).toMatchObject({ carryMinor: 0, rollover: false });
  });

  it("keeps rollover off through gap months after it is switched off", () => {
    const result = foldRollover(
      [
        { month: "2026-01", amountMinor: 10000, rollover: true },
        { month: "2026-02", amountMinor: 10000, rollover: false },
      ],
      [],
      months,
    );
    // Feb turned it off explicitly; March and April have no row, so they
    // inherit "off" and stay at zero rather than resurrecting Jan's balance.
    expect(result[2]).toMatchObject({ carryMinor: 0, rollover: false });
    expect(result[3]).toMatchObject({ carryMinor: 0, rollover: false });
  });

  it("stops carrying the month rollover is switched off", () => {
    const result = foldRollover(
      [
        { month: "2026-01", amountMinor: 10000, rollover: true },
        { month: "2026-02", amountMinor: 10000, rollover: false },
      ],
      [{ month: "2026-01", spentMinor: 0 }],
      monthRange("2026-01", "2026-02"),
    );
    expect(result[1]).toMatchObject({ carryMinor: 0, availableMinor: 10000 });
  });

  it("treats a month with no spend as zero spent", () => {
    const result = foldRollover(
      [{ month: "2026-01", amountMinor: 5000, rollover: false }],
      [],
      ["2026-01"],
    );
    expect(result[0]).toMatchObject({ spentMinor: 0, remainingMinor: 5000 });
  });
});

import { describe, it, expect } from "vitest";
import { monthKey, addMonths, monthRange, foldRollover } from "./budgets";

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

  it("carries across a month that has no budget row", () => {
    const result = foldRollover(
      [
        { month: "2026-01", amountMinor: 10000, rollover: true },
        { month: "2026-03", amountMinor: 10000, rollover: true },
      ],
      [],
      months,
    );
    // Jan leaves 10000; Feb has no row so it neither budgets nor carries…
    expect(result[1]).toMatchObject({ budgetMinor: 0, carryMinor: 0, remainingMinor: 0 });
    // …and March starts from February's remaining, not January's.
    expect(result[2]).toMatchObject({ budgetMinor: 10000, carryMinor: 0 });
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

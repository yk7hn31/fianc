import { describe, it, expect } from "vitest";
import { parseAmount, formatAmount, directionFor, minorUnitExponent } from "./money";

describe("parseAmount", () => {
  it("parses whole numbers to minor units", () => {
    expect(parseAmount("12")).toEqual({ ok: true, value: 1200 });
  });

  it("parses two decimal places", () => {
    expect(parseAmount("12.34")).toEqual({ ok: true, value: 1234 });
  });

  it("pads a single decimal place", () => {
    expect(parseAmount("12.3")).toEqual({ ok: true, value: 1230 });
  });

  it("accepts comma thousands separators", () => {
    expect(parseAmount("1,234.56")).toEqual({ ok: true, value: 123456 });
  });

  it("strips a leading currency symbol", () => {
    expect(parseAmount("$12.34")).toEqual({ ok: true, value: 1234 });
  });

  it("rejects an empty string", () => {
    expect(parseAmount("   ")).toMatchObject({ ok: false });
  });

  it("rejects more than two decimals", () => {
    expect(parseAmount("1.234")).toMatchObject({ ok: false });
  });

  it("rejects comma-as-decimal because it is ambiguous", () => {
    expect(parseAmount("1,23")).toMatchObject({ ok: false });
  });

  it("rejects European grouping because it is ambiguous", () => {
    expect(parseAmount("1.234,56")).toMatchObject({ ok: false });
  });

  it("rejects negative input; direction comes from the transaction type", () => {
    expect(parseAmount("-5")).toMatchObject({ ok: false });
  });

  it("rejects amounts beyond safe integer minor units", () => {
    expect(parseAmount("999999999999999999")).toMatchObject({ ok: false });
  });

  it("does not lose cents to floating point", () => {
    expect(parseAmount("0.07")).toEqual({ ok: true, value: 7 });
    expect(parseAmount("19.99")).toEqual({ ok: true, value: 1999 });
  });
});

describe("formatAmount", () => {
  it("formats minor units as currency", () => {
    expect(formatAmount(123456, "USD", "en-US")).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatAmount(0, "USD", "en-US")).toBe("$0.00");
  });

  it("formats negatives", () => {
    expect(formatAmount(-500, "USD", "en-US")).toBe("-$5.00");
  });
});

describe("directionFor", () => {
  it("is +1 for income", () => {
    expect(directionFor("income")).toBe(1);
  });

  it("is -1 for expense", () => {
    expect(directionFor("expense")).toBe(-1);
  });

  it("defaults a transfer to -1; the paired inflow row overrides it to +1", () => {
    expect(directionFor("transfer")).toBe(-1);
  });
});

describe("parseAmount with JPY (0 minor digits)", () => {
  it("parses whole amounts", () => {
    expect(parseAmount("1234", "JPY")).toEqual({ ok: true, value: 1234 });
  });

  it("rejects decimals", () => {
    expect(parseAmount("12.34", "JPY")).toMatchObject({ ok: false });
  });
});

describe("parseAmount with KWD (3 minor digits)", () => {
  it("accepts three decimal places", () => {
    expect(parseAmount("12.345", "KWD")).toEqual({ ok: true, value: 12345 });
  });

  it("rejects four decimal places", () => {
    expect(parseAmount("12.3456", "KWD")).toMatchObject({ ok: false });
  });
});

describe("formatAmount with JPY", () => {
  it("formats JPY amounts without decimals", () => {
    expect(formatAmount(1234, "JPY", "en-US")).toBe("¥1,234");
  });
});

describe("formatAmount with KWD", () => {
  it("formats KWD amounts with three decimal places", () => {
    const result = formatAmount(12345, "KWD", "en-US");
    expect(result).toMatch(/KWD\s+12\.345/);
  });
});

describe("minorUnitExponent", () => {
  it("returns 2 for USD", () => {
    expect(minorUnitExponent("USD")).toBe(2);
  });

  it("returns 0 for JPY", () => {
    expect(minorUnitExponent("JPY")).toBe(0);
  });

  it("returns 3 for KWD", () => {
    expect(minorUnitExponent("KWD")).toBe(3);
  });
});

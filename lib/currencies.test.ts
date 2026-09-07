import { describe, it, expect } from "vitest";
import {
  CURRENCY_CODES,
  CURRENCY_LABELS,
  isCurrencyCode,
} from "./currencies";
import { formatAmount, minorUnitExponent, parseAmount } from "./money";

describe("supported currencies", () => {
  it("offers the dollar and the won", () => {
    expect(CURRENCY_CODES).toEqual(["USD", "KRW"]);
  });

  it("accepts a supported code and rejects anything else", () => {
    expect(isCurrencyCode("KRW")).toBe(true);
    expect(isCurrencyCode("krw")).toBe(false);
    expect(isCurrencyCode("XYZ")).toBe(false);
    expect(isCurrencyCode("")).toBe(false);
  });

  // The reason this list is closed at all: minorUnitExponent asks Intl to
  // authorize the code, and Intl throws on one it does not know — from inside
  // formatAmount, which every page that shows money calls. A code that got
  // into users.base_currency without passing through here would take down the
  // app, not the form.
  it.each(CURRENCY_CODES)("%s is a code Intl authorizes", (code) => {
    expect(() => minorUnitExponent(code)).not.toThrow();
    expect(() => formatAmount(1234, code)).not.toThrow();
  });

  it("every code has a label naming its symbol", () => {
    expect(Object.keys(CURRENCY_LABELS)).toEqual([...CURRENCY_CODES]);
    expect(CURRENCY_LABELS.USD).toContain("$");
    expect(CURRENCY_LABELS.KRW).toContain("₩");
  });
});

describe("switching base currency relabels rather than converts", () => {
  // The design decision behind the settings copy, pinned so it cannot drift:
  // the stored integer is untouched, and only its scale and symbol change.
  it("reads one stored integer two ways", () => {
    const stored = 1234;
    expect(formatAmount(stored, "USD")).toBe("$12.34");
    expect(formatAmount(stored, "KRW")).toBe("₩1,234");
  });

  it("takes decimals under the dollar and refuses them under the won", () => {
    expect(parseAmount("12.34", "USD")).toEqual({ ok: true, value: 1234 });

    const won = parseAmount("12.34", "KRW");
    expect(won.ok).toBe(false);

    expect(parseAmount("1234", "KRW")).toEqual({ ok: true, value: 1234 });
  });
});

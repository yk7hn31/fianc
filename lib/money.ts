export type ParseAmountResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/** Digits with optional comma grouping and at most two decimals. */
const AMOUNT = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

export function parseAmount(input: string): ParseAmountResult {
  const raw = input.trim().replace(/\s/g, "").replace(/^[^\d.,-]+/, "");

  if (raw === "") return { ok: false, error: "Enter an amount" };
  if (raw.startsWith("-")) {
    return { ok: false, error: "Enter a positive amount" };
  }
  if (!AMOUNT.test(raw)) {
    return { ok: false, error: "Use digits and up to two decimals, e.g. 1234.56" };
  }

  const [whole, frac = ""] = raw.replace(/,/g, "").split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));

  if (!Number.isSafeInteger(minor)) {
    return { ok: false, error: "That amount is too large" };
  }
  return { ok: true, value: minor };
}

export function formatAmount(
  minor: number,
  currency = "USD",
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minor / 100);
}

/**
 * The sign an account balance should apply to a transaction of this type.
 * A transfer defaults to an outflow; `createTransfer` sets the paired inflow
 * row to +1 explicitly.
 */
export function directionFor(type: "income" | "expense" | "transfer"): 1 | -1 {
  return type === "income" ? 1 : -1;
}

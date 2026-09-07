export type ParseAmountResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Returns the number of minor digits for a currency.
 * Derives from Intl.NumberFormat which authorizes the currency code.
 */
export function minorUnitExponent(currency: string): number {
  const resolved = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).resolvedOptions();
  return resolved.maximumFractionDigits!;
}

export function parseAmount(input: string, currency = "USD"): ParseAmountResult {
  const raw = input.trim().replace(/\s/g, "").replace(/^[^\d.,-]+/, "");

  if (raw === "") return { ok: false, error: "Enter an amount" };
  if (raw.startsWith("-")) {
    return { ok: false, error: "Enter a positive amount" };
  }

  const exponent = minorUnitExponent(currency);
  const fractionBound = exponent === 0 ? "0" : `0,${exponent}`;
  const AMOUNT = new RegExp(
    `^(?:\\d+|\\d{1,3}(?:,\\d{3})+)(?:\\.\\d{${fractionBound}})?$`,
  );

  if (!AMOUNT.test(raw)) {
    return {
      ok: false,
      error: `Use digits and up to ${exponent} decimals, e.g. ${exponent === 0 ? "1234" : `1234.${Array(exponent).fill("5").join("")}`}`,
    };
  }

  const [whole, frac = ""] = raw.replace(/,/g, "").split(".");
  const multiplier = Math.pow(10, exponent);
  const minor = Number(whole) * multiplier + Number(frac.padEnd(exponent, "0"));

  if (!Number.isSafeInteger(minor)) {
    return { ok: false, error: "That amount is too large" };
  }
  return { ok: true, value: minor };
}

/**
 * Minor units as the plain, un-grouped string an amount `<input>` expects —
 * the exact round trip of `parseAmount`, so `parseAmount(toAmountInput(m, c), c)`
 * gives back `m`.
 *
 * Not `formatAmount`: that adds a currency symbol and thousands separators,
 * which `parseAmount` would reject on the way back in. And not a hardcoded
 * `(minor / 100).toFixed(2)`, which every prefilled edit field used to do:
 * under a zero-decimal currency that renders 1000 minor units as "10.00",
 * `parseAmount` reads it back as 1000 again only by accident of the divisor
 * and the exponent agreeing — under JPY it becomes 1000 → "10.00" → rejected,
 * and under a 3-decimal currency it silently corrupts by 10x. The exponent
 * has to come from the same place both directions.
 */
export function toAmountInput(minor: number, currency = "USD"): string {
  const exponent = minorUnitExponent(currency);
  return (minor / Math.pow(10, exponent)).toFixed(exponent);
}

export function formatAmount(
  minor: number,
  currency = "USD",
  locale = "en-US",
): string {
  const exponent = minorUnitExponent(currency);
  const divisor = Math.pow(10, exponent);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minor / divisor);
}

/**
 * The sign an account balance should apply to a transaction of this type.
 * A transfer defaults to an outflow; `createTransfer` sets the paired inflow
 * row to +1 explicitly.
 */
export function directionFor(type: "income" | "expense" | "transfer"): 1 | -1 {
  return type === "income" ? 1 : -1;
}

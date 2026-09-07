/**
 * The currencies a user may pick as their base.
 *
 * Deliberately a closed set rather than free text. `minorUnitExponent` asks
 * `Intl.NumberFormat` to authorize the code, and Intl throws a RangeError on
 * one it does not recognise — from inside `formatAmount`, which every page
 * that shows money calls. An unvalidated code in `users.base_currency` would
 * therefore take down the whole app rather than fail in the settings form.
 */
export const CURRENCY_LABELS = {
  USD: "US dollar ($)",
  KRW: "Korean won (₩)",
} as const;

export type CurrencyCode = keyof typeof CURRENCY_LABELS;

export const CURRENCY_CODES = Object.keys(CURRENCY_LABELS) as [
  CurrencyCode,
  ...CurrencyCode[],
];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCY_LABELS;
}

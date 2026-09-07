export interface BudgetRow {
  /** "YYYY-MM" */
  month: string;
  amountMinor: number;
  rollover: boolean;
}

export interface SpendRow {
  month: string;
  spentMinor: number;
}

export interface MonthState {
  month: string;
  budgetMinor: number;
  carryMinor: number;
  availableMinor: number;
  spentMinor: number;
  remainingMinor: number;
  /**
   * The rollover setting in force for this month — the month's own budget
   * row when it has one, otherwise the last explicit setting carried forward
   * from an earlier month. This is the flag the fold actually applied, so it
   * is also what a UI toggle must show: a month with no row still carries,
   * and rendering its switch as "off" would both contradict the carry shown
   * beside it and, on the next save, write `rollover = false` and destroy
   * the chain.
   */
  rollover: boolean;
}

export function monthKey(date: Date | string): string {
  const iso = typeof date === "string" ? date : date.toISOString();
  return iso.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const mon = (total % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

/**
 * The first and last calendar dates of a month, as ISO date strings.
 *
 * The last day comes from `Date.UTC(y, m, 0)` — day zero of the *following*
 * month — so February and leap years need no table and no special case. UTC
 * throughout, because a local-time construction shifts the boundary by a day
 * for anyone not on GMT.
 */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/**
 * Folds rollover forward across a contiguous month range for ONE category.
 *
 *   available(m) = budget(m) + carry(m)
 *   carry(m)     = rollover(m) ? remaining(m-1) : 0
 *   remaining(m) = available(m) - spent(m)
 *
 * `carry` is negative after an overspent month, so overspending eats into the
 * next month. Nothing is persisted: correcting an old transaction fixes every
 * later month automatically.
 *
 * A month with no budget row contributes `budget = 0` but still carries, as
 * the spec requires. A budget row only exists once the user typed an amount
 * or used "Copy last month", so a skipped month is the ordinary case, not an
 * edge one — reading `rollover` off the missing row (`row?.rollover`) made it
 * `false` and silently reset the chain to zero, destroying every earlier
 * month's unspent balance. `rollover(m)` is therefore the month's own row
 * when it has one and otherwise the last setting the user explicitly chose
 * for this category; switching rollover off is still an explicit setting, so
 * a row with `rollover: false` stops the carry from that month on.
 */
export function foldRollover(
  budgets: BudgetRow[],
  spend: SpendRow[],
  months: string[],
): MonthState[] {
  const budgetByMonth = new Map(budgets.map((b) => [b.month, b]));
  const spentByMonth = new Map(spend.map((s) => [s.month, s.spentMinor]));

  let previousRemaining = 0;
  // The last rollover setting this category was explicitly given. Months with
  // no budget row inherit it rather than resetting it to false.
  let rollingOver = false;
  return months.map((month) => {
    const row = budgetByMonth.get(month);
    if (row) rollingOver = row.rollover;
    const budgetMinor = row?.amountMinor ?? 0;
    const carryMinor = rollingOver ? previousRemaining : 0;
    const spentMinor = spentByMonth.get(month) ?? 0;
    const availableMinor = budgetMinor + carryMinor;
    const remainingMinor = availableMinor - spentMinor;

    previousRemaining = remainingMinor;
    return {
      month,
      budgetMinor,
      carryMinor,
      availableMinor,
      spentMinor,
      remainingMinor,
      rollover: rollingOver,
    };
  });
}

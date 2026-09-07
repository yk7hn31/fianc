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
 */
export function foldRollover(
  budgets: BudgetRow[],
  spend: SpendRow[],
  months: string[],
): MonthState[] {
  const budgetByMonth = new Map(budgets.map((b) => [b.month, b]));
  const spentByMonth = new Map(spend.map((s) => [s.month, s.spentMinor]));

  let previousRemaining = 0;
  return months.map((month) => {
    const row = budgetByMonth.get(month);
    const budgetMinor = row?.amountMinor ?? 0;
    const carryMinor = row?.rollover ? previousRemaining : 0;
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
    };
  });
}

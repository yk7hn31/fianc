import { formatAmount } from "@/lib/money";
import { CategoryIcon } from "@/components/category-icon";
import type { Account, Category } from "@/lib/db/schema";
import type { TxRow } from "@/lib/queries/transactions";
import { RowActions } from "./row-actions";

/**
 * A "YYYY-MM-DD" heading, read as a calendar day rather than an instant.
 *
 * `new Date("2026-01-15")` is parsed as UTC midnight, so west of Greenwich
 * `toLocaleDateString` prints the 14th — every heading in the list off by one
 * for half the world. Splitting the parts and handing them to the
 * multi-argument constructor builds local midnight instead.
 *
 * The locale is pinned for the same reason `formatAmount` pins one: these are
 * server components, so an unpinned locale would render in whatever locale the
 * server happens to run under, not the reader's.
 */
function dayHeading(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function groupByDate(rows: TxRow[]): [string, TxRow[]][] {
  // A Map keeps insertion order, and the query already sorts by date
  // descending, so the groups come out newest first with no second sort.
  const byDate = new Map<string, TxRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }
  return [...byDate.entries()];
}

export function TransactionList({
  rows,
  currency,
  accounts,
  categories,
}: {
  rows: TxRow[];
  currency: string;
  accounts: Account[];
  categories: Category[];
}) {
  return (
    <div className="space-y-4 md:hidden">
      {groupByDate(rows).map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-2 px-1 text-caption uppercase text-muted-foreground">
            {dayHeading(date)}
          </h2>
          <ul className="divide-y divide-border rounded-card border border-border bg-card shadow-card">
            {items.map((t) => (
              <li
                key={t.id}
                className="flex min-h-[56px] items-center gap-3 p-4"
              >
                <CategoryIcon name={t.categoryIcon ?? "Circle"} />
                <div className="min-w-0 flex-1">
                  {/*
                    The last fallback reads the row's type, matching the table.
                    A flat "Transfer" labelled every payee-less, category-less
                    row a transfer — no form produces one today, but CSV import
                    and recurring rules both will.
                  */}
                  <p className="truncate">
                    {t.payee ||
                      t.categoryName ||
                      (t.type === "transfer" ? "Transfer" : "Uncategorised")}
                  </p>
                  <p className="truncate text-caption text-muted-foreground">
                    {t.accountName}
                  </p>
                </div>
                {/*
                  Signed from `direction`, not from `type`: both halves of a
                  transfer are type "transfer" and differ only in direction, so
                  keying off the type would print the same unsigned amount
                  twice and hide which account lost the money.
                */}
                <span className="shrink-0 tabular-nums">
                  {t.direction === 1 ? "+" : "−"}
                  {formatAmount(t.amountMinor, currency)}
                </span>
                <RowActions row={t} accounts={accounts} categories={categories} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

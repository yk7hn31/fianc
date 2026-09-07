"use client";

import { useMemo, useState } from "react";
import { formatAmount } from "@/lib/money";
import { CategoryIcon } from "@/components/category-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Account, Category } from "@/lib/db/schema";
import type { TxRow } from "@/lib/queries/transactions";
import { SelectionBar } from "./selection-bar";
import { SortHeader } from "./sort-header";
import { RowActions } from "./row-actions";

export function TransactionTable({
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /*
   * Filtering, sorting, and paging are all soft navigations to the same
   * route at the same position in the tree, so React keeps this component
   * — and `selected` — mounted across them while `rows` is swapped out from
   * under it. Left unchecked, three rows selected on page 1 stay "selected"
   * after clicking Next, pointing at ids that are no longer rendered; a
   * bulk delete from page 2 would then destroy page-1 rows the user cannot
   * see and never re-confirmed. Deriving the *visible* selection as the
   * intersection with the current `rows` — rather than trying to clear
   * `selected` on every navigation — means the bar, the "select all"
   * checkbox, and the delete action itself can never see a stale id.
   */
  const visibleSelected = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    return new Set([...selected].filter((id) => ids.has(id)));
  }, [selected, rows]);

  const allSelected =
    rows.length > 0 && rows.every((r) => visibleSelected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="hidden md:block">
      <SelectionBar
        selected={[...visibleSelected]}
        onCleared={() => setSelected(new Set())}
      />
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  aria-label="Select all transactions"
                  className="size-4 rounded-small border-border accent-foreground"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead className="pl-0">
                <SortHeader column="date">Date</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader column="payee">Payee</SortHeader>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="inline-flex w-full justify-end">
                  <SortHeader column="amount">Amount</SortHeader>
                </span>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} data-state={visibleSelected.has(t.id) ? "selected" : undefined}>
                <TableCell className="pl-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${t.payee || t.categoryName || "transaction"}`}
                    className="size-4 rounded-small border-border accent-foreground"
                    checked={visibleSelected.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                  />
                </TableCell>
                {/*
                  The stored ISO day, not a localised one: this column is scanned
                  as a column, and a fixed-width sortable-looking date is easier
                  to read down than "Jan 15, 2026" of varying length.
                */}
                <TableCell className="pl-0 tabular-nums text-muted-foreground">
                  {t.date}
                </TableCell>
                {/*
                  Capped and truncated, because `TableCell` is `whitespace-nowrap`
                  and a payee is free text: one long line pushed Category,
                  Account and the Amount out of the viewport and into the table's
                  horizontal scroller, which draws no visible bar on macOS. The
                  inner span carries the cap — `max-width` on a `td` under the
                  default auto table layout is treated as a hint.
                */}
                <TableCell>
                  <span
                    className="block max-w-[26ch] truncate"
                    title={t.payee || undefined}
                  >
                    {t.payee || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <CategoryIcon name={t.categoryIcon ?? "Circle"} />
                    {t.categoryName ??
                      (t.type === "transfer" ? "Transfer" : "Uncategorised")}
                  </span>
                </TableCell>
                <TableCell>{t.accountName}</TableCell>
                {/* Signed from `direction`; see the note in transaction-list.tsx. */}
                <TableCell className="pr-4 text-right tabular-nums">
                  {t.direction === 1 ? "+" : "−"}
                  {formatAmount(t.amountMinor, currency)}
                </TableCell>
                <TableCell>
                  <RowActions
                    row={t}
                    currency={currency}
                    accounts={accounts}
                    categories={categories}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

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
import type { TxRow } from "@/lib/queries/transactions";

export function TransactionTable({
  rows,
  currency,
}: {
  rows: TxRow[];
  currency: string;
}) {
  return (
    <div className="hidden overflow-hidden rounded-card border border-border bg-card shadow-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Payee</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="pr-4 text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id}>
              {/*
                The stored ISO day, not a localised one: this column is scanned
                as a column, and a fixed-width sortable-looking date is easier
                to read down than "Jan 15, 2026" of varying length.
              */}
              <TableCell className="pl-4 tabular-nums text-muted-foreground">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

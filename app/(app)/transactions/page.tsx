import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { listTransactions, normaliseFilters } from "@/lib/queries/transactions";
import { listActiveAccounts } from "@/lib/queries/accounts";
import { listCategories } from "@/lib/queries/categories";
import { AppHeader } from "@/components/app-shell/app-header";
import { AddFabTrigger } from "@/components/app-shell/add-fab";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { TransactionTable } from "./transaction-table";

/**
 * A repeated query parameter arrives as an array — `?q=a&q=b` — and every
 * filter reader downstream expects a string; `q.trim()` on an array throws and
 * takes the whole page down with it. Last value wins, as with a form post.
 */
function firstValues(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.at(-1) : value,
    ]),
  );
}

function entries(count: number): string {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const filters = normaliseFilters(firstValues(await searchParams));
  const [{ rows, total }, accounts, categories] = await Promise.all([
    listTransactions(user.id, filters),
    listActiveAccounts(user.id),
    listCategories(user.id),
  ]);

  // Every transaction lands in an account, so with none there is nothing the
  // form could save: its account Select would have no options and the submit
  // could only ever come back with "Choose an account". Say what is missing.
  if (accounts.length === 0) {
    return (
      <>
        <AppHeader title="Transactions" />
        <Card>
          <CardContent className="p-5">
            <p className="text-body-lg font-medium">No accounts yet</p>
            <p className="mt-1 text-muted-foreground">
              A transaction has to land somewhere. Add an account first, then
              come back and record what you spent.
            </p>
            <Link
              href="/accounts"
              className={cn(buttonVariants(), "mt-4 h-11 gap-1.5 px-4")}
            >
              <Wallet className="size-4" strokeWidth={1.5} />
              Add an account
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Transactions" />

      {/*
        Two instances of the same form, one per trigger. They cannot collide on
        the duplicate element ids inside: ResponsiveDialog mounts its children
        only while open, each trigger is hidden at the breakpoint the other
        belongs to, and a dialog opened from one is modal.
      */}
      <div className="mb-5 hidden md:block">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          trigger={
            <Button>
              <Plus className="size-4" strokeWidth={1.5} />
              New transaction
            </Button>
          }
        />
      </div>

      <div className="md:hidden">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          trigger={<AddFabTrigger />}
        />
      </div>

      {/*
        `total`, not `rows.length`: the query pages, so an out-of-range page
        comes back with no rows while plenty of transactions match. Branching
        on the rows told a user with a full ledger that they had never
        recorded anything.
      */}
      {total === 0 ? (
        <p className="text-muted-foreground">
          No transactions yet. Add your first one.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing on page {filters.page}. The list has {entries(total)}, on
          earlier pages.
        </p>
      ) : (
        <>
          <TransactionList rows={rows} currency={user.baseCurrency} />
          <TransactionTable rows={rows} currency={user.baseCurrency} />
          {/*
            What is on screen out of what matches. The bare total read as the
            whole list while the query had already truncated it to a page, so
            51 transactions showed 50 rows above the words "51 transactions"
            and the 51st was simply gone. "Entries", not "transactions",
            because a transfer is one row per account here — two entries for
            one movement of money, the way a bank statement shows it.
          */}
          <p className="mt-3 text-caption text-muted-foreground">
            Showing {rows.length} of {entries(total)}
          </p>
        </>
      )}
    </>
  );
}

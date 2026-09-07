"use client";

import { useEffect, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FieldShell,
  FormField,
  fieldErrorReader,
  useResettableActionState,
} from "@/components/form-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import { toAmountInput } from "@/lib/money";
import type { Account, Category } from "@/lib/db/schema";
import type { TxRow } from "@/lib/queries/transactions";
import { updateTransaction, deleteTransactions } from "./actions";

export function RowActions({
  row,
  currency,
  accounts,
  categories,
}: {
  row: TxRow;
  currency: string;
  accounts: Account[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending, resetState] =
    useResettableActionState(updateTransaction);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      toast.success("Transaction updated");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  // The dialog unmounts its fields on close but this state outlives it, so
  // without dropping the last result the next Edit would open a form already
  // marked invalid over values the user never submitted.
  function changeEditing(next: boolean) {
    if (!next) resetState();
    setEditing(next);
  }

  const isTransfer = row.transferGroupId !== null;
  const fieldError = fieldErrorReader(state);
  const relevant = categories.filter((c) =>
    row.type === "income" ? c.kind === "income" : c.kind === "expense",
  );
  const label = row.payee || row.categoryName || "transaction";

  /*
   * Base UI resolves a *closed* trigger's text from `items`, not from the
   * mounted options — see the identical note in transaction-form.tsx. Without
   * these maps every trigger here would show a raw account/category uuid the
   * instant the dialog opened, for every non-transfer row (the common case).
   */
  const accountLabels = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryLabels = Object.fromEntries(
    categories.map((c) => [c.id, c.name]),
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              className="size-11"
              aria-label={`Actions for ${label}`}
            >
              <MoreHorizontal className="size-4" strokeWidth={1.5} />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {/*
            onClick, not onSelect: Base UI's Menu.Item (unlike Radix's, which
            this reads like) has no "select" event — an item click only ever
            fires its plain `onClick`. `onSelect` on a <div> is not a real DOM
            event, so it silently never ran; the menu still closed (that part
            is Base UI's own default behaviour), but neither Edit nor Delete
            ever executed.
          */}
          <DropdownMenuItem onClick={() => setEditing(true)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            disabled={busy}
            onClick={() => {
              // Deleting a transaction destroys a financial record — a
              // mis-tap here is recoverable only by editing the database.
              if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
                return;
              }
              startTransition(async () => {
                const res = await deleteTransactions([row.id]);
                if (res.ok) toast.success("Transaction deleted");
                else toast.error(res.error);
              });
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog
        open={editing}
        onOpenChange={changeEditing}
        title="Edit transaction"
        description={isTransfer ? "Transfers are edited as a pair." : undefined}
      >
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={row.id} />
          <input
            type="hidden"
            name="type"
            value={isTransfer ? "expense" : row.type}
          />

          {/*
            FormField / FieldShell, not a hand-rolled Label + Input + <p>:
            this form had an error paragraph on `amount` only, so a rejected
            date, account, category, payee or note produced a bare "Check the
            form" toast and no indication of which field was wrong. The
            shared components also wire `aria-describedby` to the message,
            which the hand-rolled markup never did.
          */}
          <FormField
            label="Amount"
            name="amount"
            inputMode="decimal"
            // Not `(amountMinor / 100).toFixed(2)`: `updateTransaction`
            // parses this value back with the user's own currency, so a
            // hardcoded two-decimal divisor round-trips a zero-decimal
            // currency out by 100x on every edit.
            defaultValue={toAmountInput(row.amountMinor, currency)}
            className="h-11 tabular-nums"
            error={fieldError("amount")}
          />

          {/*
            A disabled Base UI Select puts `disabled` straight onto its own
            hidden submission input, so a disabled control is never a
            successful one: `name="accountId"` here would make
            `new FormData(form)` omit accountId entirely, and every
            transfer edit would fail validation before ever reaching the
            transfer branch below. The visible control stays disabled (a
            transfer's account belongs to the pair, not to one row) but
            carries no name; a plain hidden input submits the real value
            instead.
          */}
          <FieldShell
            label="Account"
            name="accountId"
            error={fieldError("accountId")}
          >
            <Select
              name={isTransfer ? undefined : "accountId"}
              items={accountLabels}
              defaultValue={row.accountId}
              disabled={isTransfer}
            >
              <SelectTrigger
                id="accountId"
                aria-invalid={Boolean(fieldError("accountId"))}
                aria-describedby={
                  fieldError("accountId") ? "accountId-error" : undefined
                }
                className="h-11 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isTransfer && (
              <input type="hidden" name="accountId" value={row.accountId} />
            )}
          </FieldShell>

          {!isTransfer && (
            <FieldShell
              label="Category"
              name="categoryId"
              error={fieldError("categoryId")}
            >
              <Select
                name="categoryId"
                items={categoryLabels}
                defaultValue={row.categoryId ?? undefined}
              >
                <SelectTrigger
                  id="categoryId"
                  aria-invalid={Boolean(fieldError("categoryId"))}
                  aria-describedby={
                    fieldError("categoryId") ? "categoryId-error" : undefined
                  }
                  className="h-11 w-full"
                >
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  {relevant.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          )}

          <FormField
            label="Date"
            name="date"
            type="date"
            defaultValue={row.date}
            error={fieldError("date")}
          />

          <FormField
            label="Payee"
            name="payee"
            defaultValue={row.payee}
            error={fieldError("payee")}
          />

          {/*
            Rendered, not omitted: updateTransaction writes `note`
            unconditionally, and this dialog is the only place a note can be
            reviewed or corrected once CSV import starts writing them. A form
            that never showed the field would silently blank an existing
            note on every save.
          */}
          <FormField
            label="Note"
            name="note"
            defaultValue={row.note}
            error={fieldError("note")}
          />

          <Button type="submit" className="w-full h-11" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </ResponsiveDialog>
    </>
  );
}

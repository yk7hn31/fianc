"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Account, Category } from "@/lib/db/schema";
import type { TxRow } from "@/lib/queries/transactions";
import { updateTransaction, deleteTransactions } from "./actions";

export function RowActions({
  row,
  accounts,
  categories,
}: {
  row: TxRow;
  accounts: Account[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateTransaction, null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      toast.success("Transaction updated");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const isTransfer = row.transferGroupId !== null;
  const err = (k: string) =>
    state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;
  const relevant = categories.filter((c) =>
    row.type === "income" ? c.kind === "income" : c.kind === "expense",
  );
  const label = row.payee || row.categoryName || "transaction";

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
            onClick={() =>
              startTransition(async () => {
                const res = await deleteTransactions([row.id]);
                if (res.ok) toast.success("Transaction deleted");
                else toast.error(res.error);
              })
            }
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog
        open={editing}
        onOpenChange={setEditing}
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

          <div className="space-y-1.5">
            <Label htmlFor={`amount-${row.id}`}>Amount</Label>
            <Input
              id={`amount-${row.id}`}
              name="amount"
              inputMode="decimal"
              defaultValue={(row.amountMinor / 100).toFixed(2)}
              className="h-11 tabular-nums"
              aria-invalid={Boolean(err("amount"))}
            />
            {err("amount") && (
              <p className="text-destructive text-caption">{err("amount")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`account-${row.id}`}>Account</Label>
            <Select
              name="accountId"
              defaultValue={row.accountId}
              disabled={isTransfer}
            >
              <SelectTrigger id={`account-${row.id}`} className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isTransfer && (
            <div className="space-y-1.5">
              <Label htmlFor={`category-${row.id}`}>Category</Label>
              <Select name="categoryId" defaultValue={row.categoryId ?? undefined}>
                <SelectTrigger id={`category-${row.id}`} className="h-11">
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  {relevant.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`date-${row.id}`}>Date</Label>
            <Input
              id={`date-${row.id}`}
              name="date"
              type="date"
              defaultValue={row.date}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`payee-${row.id}`}>Payee</Label>
            <Input
              id={`payee-${row.id}`}
              name="payee"
              defaultValue={row.payee}
              className="h-11"
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </ResponsiveDialog>
    </>
  );
}

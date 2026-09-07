"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "@/components/category-icon";
import { BudgetProgressBar } from "@/components/budget-progress-bar";
import { formatAmount } from "@/lib/money";
import { setBudget } from "./actions";
import type { CategoryBudget } from "@/lib/queries/budgets";

export function BudgetRow({
  row,
  month,
  currency,
}: {
  row: CategoryBudget;
  month: string;
  currency: string;
}) {
  // Two flags, not one shared `pending`: clicking the Switch blurs the Input
  // first, and a single shared flag meant that blur's save disabled the
  // Switch — via a synchronous React re-render — before the browser even
  // got to dispatch the click's mouseup/click pair. A disabled Base UI
  // Switch drops that click on the floor at the DOM level, so its own
  // `onCheckedChange` never fired at all; toggling rollover right after
  // typing an amount silently did nothing. Each control now only disables
  // for its OWN in-flight save.
  const [amountPending, setAmountPending] = useState(false);
  const [rolloverPending, setRolloverPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The two saves still have to land in the order they were queued: even
  // with separate disabled states, both writes touch the same
  // (user, category, month) row and `setBudget` upserts both fields from
  // whatever it's given, so if the amount save's write (carrying the OLD
  // rollover flag) completed after the rollover save's write, it would
  // silently revert rollover back off. Chaining onto this ref guarantees
  // the second save only starts once the first has actually finished.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  function queueSave(
    amount: string,
    rollover: boolean,
    setBusy: (pending: boolean) => void,
  ): void {
    const run = async () => {
      setBusy(true);
      try {
        const form = new FormData();
        form.set("categoryId", row.categoryId);
        form.set("month", month);
        form.set("amount", amount);
        form.set("rollover", rollover ? "on" : "off");
        const result = await setBudget(form);
        if (!result.ok) toast.error(result.error);
      } catch {
        // setBudget already returns `fail(...)` for anything it anticipates;
        // this only catches a genuinely unexpected throw (a dropped
        // connection, an aborted request) so `setBusy` still clears below
        // instead of leaving the control disabled forever.
        toast.error("Could not save. Try again.");
      } finally {
        setBusy(false);
      }
    };
    // `run` never rejects (it catches internally), but chaining onto both
    // branches keeps the queue moving even if that ever changes.
    queueRef.current = queueRef.current.then(run, run);
  }

  return (
    <li className="p-4 space-y-2">
      <div className="flex items-center gap-3">
        <CategoryIcon name={row.icon} />
        <span className="flex-1 min-w-0 truncate">{row.name}</span>
        <Input
          ref={inputRef}
          aria-label={`${row.name} budget`}
          defaultValue={row.budgetMinor ? (row.budgetMinor / 100).toFixed(2) : ""}
          placeholder="0.00"
          inputMode="decimal"
          disabled={amountPending}
          onBlur={(e) => queueSave(e.target.value, row.rollover, setAmountPending)}
          className="h-11 w-28 text-right tabular-nums"
        />
      </div>

      <BudgetProgressBar spentMinor={row.spentMinor} availableMinor={row.availableMinor} />

      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <span className={row.remainingMinor < 0 ? "text-destructive" : undefined}>
          {formatAmount(row.spentMinor, currency)} of{" "}
          {formatAmount(row.availableMinor, currency)}
          {row.carryMinor !== 0 &&
            ` (${row.carryMinor > 0 ? "+" : "−"}${formatAmount(Math.abs(row.carryMinor), currency)} carried)`}
        </span>
        <label className="flex items-center gap-2">
          Rollover
          <Switch
            checked={row.rollover}
            disabled={rolloverPending}
            // Reads the input's current DOM value, not the server-rendered
            // `row.budgetMinor` prop: that prop is only as fresh as the last
            // completed save, so toggling right after typing a new amount
            // (but before the blur-triggered save has landed and revalidated)
            // would otherwise send the OLD amount and silently revert what
            // the user just typed.
            onCheckedChange={(v) => queueSave(inputRef.current?.value ?? "", v, setRolloverPending)}
          />
        </label>
      </div>
    </li>
  );
}

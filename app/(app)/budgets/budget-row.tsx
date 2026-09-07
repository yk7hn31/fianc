"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "@/components/category-icon";
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
  const [pending, setPending] = useState(false);

  async function save(amount: string, rollover: boolean) {
    setPending(true);
    const form = new FormData();
    form.set("categoryId", row.categoryId);
    form.set("month", month);
    form.set("amount", amount);
    form.set("rollover", rollover ? "on" : "off");
    const result = await setBudget(form);
    setPending(false);
    if (!result.ok) toast.error(result.error);
  }

  const over = row.remainingMinor < 0;
  const pct =
    row.availableMinor > 0
      ? Math.min(100, (row.spentMinor / row.availableMinor) * 100)
      : row.spentMinor > 0
        ? 100
        : 0;

  return (
    <li className="p-4 space-y-2">
      <div className="flex items-center gap-3">
        <CategoryIcon name={row.icon} />
        <span className="flex-1 min-w-0 truncate">{row.name}</span>
        <Input
          aria-label={`${row.name} budget`}
          defaultValue={row.budgetMinor ? (row.budgetMinor / 100).toFixed(2) : ""}
          placeholder="0.00"
          inputMode="decimal"
          disabled={pending}
          onBlur={(e) => save(e.target.value, row.rollover)}
          className="h-11 w-28 text-right tabular-nums"
        />
      </div>

      <div className="h-1.5 rounded-pill bg-muted overflow-hidden">
        <div
          className={over ? "h-full bg-destructive" : "h-full bg-foreground"}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <span className={over ? "text-destructive" : undefined}>
          {formatAmount(row.spentMinor, currency)} of{" "}
          {formatAmount(row.availableMinor, currency)}
          {row.carryMinor !== 0 &&
            ` (${row.carryMinor > 0 ? "+" : "−"}${formatAmount(Math.abs(row.carryMinor), currency)} carried)`}
        </span>
        <label className="flex items-center gap-2">
          Rollover
          <Switch
            checked={row.rollover}
            disabled={pending}
            onCheckedChange={(v) =>
              save((row.budgetMinor / 100).toFixed(2), v)
            }
          />
        </label>
      </div>
    </li>
  );
}

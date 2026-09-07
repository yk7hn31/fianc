"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FieldShell,
  fieldErrorReader,
  useResettableActionState,
} from "@/components/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_LABELS } from "@/lib/currencies";
import { updateBaseCurrency } from "./actions";

export function CurrencyForm({ current }: { current: string }) {
  const [state, formAction, pending] =
    useResettableActionState(updateBaseCurrency);

  useEffect(() => {
    if (state?.ok) toast.success("Currency saved");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  const fieldError = fieldErrorReader(state);
  const error = fieldError("baseCurrency");

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <FieldShell label="Base currency" name="baseCurrency" error={error}>
        {/*
          `items` is what the closed trigger reads its text from — Base UI
          resolves the label from this map, not from the options, which have
          not mounted yet. Without it the trigger would read "KRW".
        */}
        <Select
          name="baseCurrency"
          items={CURRENCY_LABELS}
          defaultValue={current}
        >
          <SelectTrigger
            id="baseCurrency"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "baseCurrency-error" : undefined}
            className="h-11 w-full sm:w-72"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
              <SelectItem key={code} value={code}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>

      <p className="text-muted-foreground">
        Amounts already recorded are relabelled, not converted. Every amount is
        stored as a whole number of minor units, so 1234 shows as $12.34 under
        the dollar and ₩1,234 under the won. Nothing is multiplied by an
        exchange rate.
      </p>

      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Saving…" : "Save currency"}
      </Button>
    </form>
  );
}

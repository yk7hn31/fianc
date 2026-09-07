"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FieldShell,
  FormField,
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
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import { createAccount } from "./actions";

/*
 * Base UI resolves the closed trigger's text from `items`, not from the
 * mounted options — the popup has not rendered yet. Without it the trigger
 * falls back to stringifying the value and reads "credit_card".
 */
const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  cash: "Cash",
  credit_card: "Credit card",
  investment: "Investment",
};

export function AccountForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending, resetState] =
    useResettableActionState(createAccount);

  // Closing has to drop the last result, not just hide it: the fields unmount
  // with the dialog but this state does not, so the next open would reopen an
  // empty form still carrying the previous submit's field errors.
  function changeOpen(next: boolean) {
    if (!next) resetState();
    setOpen(next);
  }

  useEffect(() => {
    if (state?.ok) {
      // No reset here: a successful result carries no field errors, so there
      // is nothing stale for the next open to inherit.
      setOpen(false);
      toast.success("Account added");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const fieldError = fieldErrorReader(state);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={changeOpen}
      title="New account"
      description="Cash, a card, or anything you want a balance for."
      trigger={
        <Button>
          <Plus className="size-4" strokeWidth={1.5} />
          New account
        </Button>
      }
    >
      <form action={formAction} aria-busy={pending} className="space-y-3">
        <FormField label="Name" name="name" error={fieldError("name")} />

        <FieldShell label="Type" name="type" error={fieldError("type")}>
          <Select name="type" items={TYPE_LABELS} defaultValue="checking">
            <SelectTrigger
              id="type"
              aria-invalid={Boolean(fieldError("type"))}
              aria-describedby={fieldError("type") ? "type-error" : undefined}
              className="h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>

        <FormField
          label="Opening balance"
          name="openingBalance"
          inputMode="decimal"
          placeholder="0.00"
          error={fieldError("openingBalance")}
        />

        <Button type="submit" className="w-full h-11" disabled={pending}>
          {pending ? "Saving…" : "Add account"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}

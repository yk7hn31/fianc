"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FieldShell,
  FormField,
  fieldErrorReader,
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

export function AccountForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAccount, null);

  useEffect(() => {
    if (state?.ok) {
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
      onOpenChange={setOpen}
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
          <Select name="type" defaultValue="checking">
            <SelectTrigger id="type" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit_card">Credit card</SelectItem>
              <SelectItem value="investment">Investment</SelectItem>
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

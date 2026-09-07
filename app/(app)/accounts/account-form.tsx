"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="openingBalance">Opening balance</Label>
          <Input
            id="openingBalance"
            name="openingBalance"
            inputMode="decimal"
            placeholder="0.00"
            className="h-11"
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={pending}>
          {pending ? "Saving…" : "Add account"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}

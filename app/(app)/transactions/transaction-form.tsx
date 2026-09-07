"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import { CategoryIcon } from "@/components/category-icon";
import type { Account, Category } from "@/lib/db/schema";
import { createTransaction, createTransfer } from "./actions";

type Mode = "expense" | "income" | "transfer";

const MODES: { value: Mode; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

/** A transfer is uncategorised, so it borrows the expense list and ignores it. */
function categoriesFor(categories: Category[], mode: Mode): Category[] {
  const kind = mode === "income" ? "income" : "expense";
  return categories.filter((c) => c.kind === kind);
}

/**
 * Today as the user's calendar reckons it.
 *
 * `new Date().toISOString().slice(0, 10)` is UTC, so anywhere west of
 * Greenwich it prefills tomorrow's date for the last hours of the evening —
 * the one moment a "what did I just spend" entry is most likely to be made.
 */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function TransactionForm({
  accounts,
  categories,
  trigger,
}: {
  accounts: Account[];
  categories: Category[];
  // ResponsiveDialog hands this straight to Base UI as `render={trigger}`,
  // which clones a single element — a ReactNode would type-check and then
  // fail at runtime on a string or a fragment.
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("expense");
  const [categoryId, setCategoryId] = useState(
    () => categoriesFor(categories, "expense")[0]?.id ?? "",
  );

  const [state, formAction, pending, resetState] = useResettableActionState(
    mode === "transfer" ? createTransfer : createTransaction,
  );

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
      toast.success("Transaction saved");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const fieldError = fieldErrorReader(state);
  const relevant = categoriesFor(categories, mode);

  /*
   * Base UI resolves the closed trigger's text from `items`, not from the
   * mounted options — the popup has not rendered yet. Without these maps the
   * trigger falls back to stringifying the value, and every account and
   * category would read as a raw uuid until the list was opened.
   */
  const accountLabels = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryLabels = Object.fromEntries(
    categories.map((c) => [c.id, c.name]),
  );

  /**
   * The category has to be controlled, not merely defaulted: switching Expense
   * to Income swaps the option list underneath an uncontrolled Select, which
   * keeps its stale value. `createTransaction` deliberately does not require a
   * category's kind to match the transaction type, so that stale id would save
   * an income row filed under an expense category.
   */
  function switchMode(next: Mode) {
    setMode(next);
    setCategoryId(categoriesFor(categories, next)[0]?.id ?? "");
    // The rejection belongs to the form the user has just left: an amount
    // error raised against an expense would otherwise still be sitting under
    // the Transfer form's amount field, describing a submit that never
    // happened here.
    resetState();
  }

  // A transfer needs somewhere to move the money to, and the destination list
  // is the same list as the source. With one account every choice is the
  // source itself, which the same-account guard rejects, and leaving it blank
  // fails validation — a tab whose every path is an error.
  const canTransfer = accounts.length >= 2;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={changeOpen}
      title="New transaction"
      description="Money out, money in, or a move between your own accounts."
      trigger={trigger}
    >
      <form action={formAction} aria-busy={pending} className="space-y-3">
        {/*
          Not `FieldShell`: it names its control with `<label for>`, and a
          tablist is not a labelable element, so the attribute would be inert
          and the document invalid. `aria-labelledby` points the very words on
          screen at the tablist and is valid for any role.
        */}
        <div className="space-y-1.5">
          <span
            id="mode-label"
            className="block text-sm leading-none font-medium select-none"
          >
            Type
          </span>
          <Tabs value={mode} onValueChange={(v) => switchMode(String(v) as Mode)}>
            {/*
              The default list is 32px tall and its triggers fill it minus the
              inset, which left each tab a 23px hit area — half a nav item, on
              the control that decides which of three actions runs. The tabs
              are sized to the 44px every input in this form uses, and the list
              takes its height from them: `h-auto` has to carry the same
              `group-data-horizontal/tabs` modifier as the 32px it replaces, or
              tailwind-merge keeps both and the variant's specificity wins.
              18px corners are what DESIGN.md gives interactive elements.
            */}
            <TabsList
              aria-labelledby="mode-label"
              className="w-full rounded-pill group-data-horizontal/tabs:h-auto"
            >
              {MODES.map((m) => (
                <TabsTrigger
                  key={m.value}
                  value={m.value}
                  disabled={m.value === "transfer" && !canTransfer}
                  className="h-11 flex-1 rounded-pill"
                >
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {!canTransfer && (
            <p className="text-caption text-muted-foreground">
              Transfers need a second account to move money into.
            </p>
          )}
        </div>

        {mode !== "transfer" && <input type="hidden" name="type" value={mode} />}

        <FormField
          label="Amount"
          name="amount"
          // Opens the numeric keypad on a phone; `type="number"` would too, but
          // it also brings spinners, scroll-wheel edits and a locale-dependent
          // decimal separator that `parseAmount` does not accept.
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          className="h-11 text-heading-sm tabular-nums"
          error={fieldError("amount")}
        />

        <FieldShell
          label={mode === "transfer" ? "From account" : "Account"}
          name="accountId"
          error={fieldError("accountId")}
        >
          <Select
            name="accountId"
            items={accountLabels}
            defaultValue={accounts[0]?.id}
          >
            <SelectTrigger
              id="accountId"
              aria-invalid={Boolean(fieldError("accountId"))}
              aria-describedby={
                fieldError("accountId") ? "accountId-error" : undefined
              }
              className="h-11 w-full"
            >
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>

        {mode === "transfer" ? (
          // Keyed, and not for a list: the two branches sit at the same
          // position, so React would otherwise reconcile one Select into the
          // other — the controlled category Select becomes the uncontrolled
          // destination Select, Base UI warns about the switch, and the
          // destination never takes a value.
          <FieldShell
            key="toAccountId"
            label="To account"
            name="toAccountId"
            error={fieldError("toAccountId")}
          >
            <Select
              name="toAccountId"
              items={accountLabels}
              defaultValue={accounts[1]?.id}
            >
              <SelectTrigger
                id="toAccountId"
                aria-invalid={Boolean(fieldError("toAccountId"))}
                aria-describedby={
                  fieldError("toAccountId") ? "toAccountId-error" : undefined
                }
                className="h-11 w-full"
              >
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
        ) : (
          <FieldShell
            key="categoryId"
            label="Category"
            name="categoryId"
            error={fieldError("categoryId")}
          >
            <Select
              name="categoryId"
              items={categoryLabels}
              value={categoryId}
              onValueChange={(v) => setCategoryId(String(v))}
            >
              <SelectTrigger
                id="categoryId"
                aria-invalid={Boolean(fieldError("categoryId"))}
                aria-describedby={
                  fieldError("categoryId") ? "categoryId-error" : undefined
                }
                className="h-11 w-full"
              >
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {relevant.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <CategoryIcon name={c.icon} />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
        )}

        <FormField
          label="Date"
          name="date"
          type="date"
          defaultValue={localToday()}
          error={fieldError("date")}
        />

        <FormField
          label="Payee"
          name="payee"
          placeholder={mode === "income" ? "Where it came from" : "Where it went"}
          autoComplete="off"
          error={fieldError("payee")}
        />

        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Saving…" : "Save transaction"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}

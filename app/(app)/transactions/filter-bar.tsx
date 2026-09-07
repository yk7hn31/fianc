"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, Category } from "@/lib/db/schema";

const ANY = "__any";

const TYPE_LABELS: Record<string, string> = {
  [ANY]: "All types",
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

export function FilterBar({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  /*
   * Base UI resolves a *closed* trigger's text from `items`, not from the
   * mounted options — the popup has not rendered yet, so
   * `resolveSelectedLabel` falls through to stringifying the raw value.
   * Without these maps every one of these triggers reads "__any" when no
   * filter is set, and a raw uuid once one is. Same maps, same reason, as
   * TransactionForm and RowActions.
   */
  const accountLabels: Record<string, string> = {
    [ANY]: "All accounts",
    ...Object.fromEntries(accounts.map((a) => [a.id, a.name])),
  };
  const categoryLabels: Record<string, string> = {
    [ANY]: "All categories",
    ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
  };

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === "" || value === ANY) next.delete(key);
    else next.set(key, value);
    next.delete("page"); // a new filter always starts at page one
    router.push(`/transactions?${next.toString()}`);
  }

  const active = ["from", "to", "accountId", "categoryId", "type", "q"].some(
    (k) => params.get(k),
  );

  return (
    <div className="mb-5 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Payee or note"
          className="h-11"
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", e.currentTarget.value);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="date"
          defaultValue={params.get("from") ?? ""}
          className="h-11"
          onChange={(e) => set("from", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="date"
          defaultValue={params.get("to") ?? ""}
          className="h-11"
          onChange={(e) => set("to", e.target.value)}
        />
      </div>

      {/*
        Ids (and label text) here cannot reuse "accountId"/"Account" or
        "categoryId"/"Category": those are exactly what TransactionForm and
        RowActions give their own Account/Category fields, and unlike the
        form's own twin instances — which never collide because
        ResponsiveDialog mounts its fields only while open — this bar is
        always mounted on the same page. A duplicate id breaks the *other*
        field's label association (a `<label for>` resolves against the first
        element in the document with that id), and even with unique ids, an
        identical label *text* is still a second accessible-name match while
        a dialog with its own "Category" field is open — Base UI's Dialog
        does not remove the rest of the page from the accessibility tree, so
        both a duplicate id and a duplicate label turned "open the New
        transaction dialog, then ask for the field labelled Category" into
        either the wrong control or a strict-mode "resolved to 2 elements"
        error. Plural labels — already the wording of the "All accounts" /
        "All categories" options below — read naturally for a filter and
        share no substring with the singular field labels the form uses.
      */}
      <div className="space-y-1.5">
        <Label htmlFor="filterAccountId">Accounts</Label>
        <Select
          items={accountLabels}
          value={params.get("accountId") ?? ANY}
          onValueChange={(v) => set("accountId", String(v))}
        >
          <SelectTrigger id="filterAccountId" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filterCategoryId">Categories</Label>
        <Select
          items={categoryLabels}
          value={params.get("categoryId") ?? ANY}
          onValueChange={(v) => set("categoryId", String(v))}
        >
          <SelectTrigger id="filterCategoryId" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/*
        Spec: "Filters for date range, account, category, type, and free
        text." `normaliseFilters` and `buildTxWhere` have always understood
        `type` — and FilterBar's own `active` check has always listed it —
        but nothing on screen ever set it, so the filter was reachable only
        by hand-editing the URL.

        "Types", not "Type": TransactionForm labels its expense/income/
        transfer tablist "Type", and Base UI's Dialog leaves the rest of the
        page in the accessibility tree, so an identical name here would be a
        second match while that dialog is open. Same reasoning, and the same
        plural, as the Accounts and Categories filters above.
      */}
      <div className="space-y-1.5">
        <Label htmlFor="filterType">Types</Label>
        <Select
          items={TYPE_LABELS}
          value={params.get("type") ?? ANY}
          onValueChange={(v) => set("type", String(v))}
        >
          <SelectTrigger id="filterType" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="flex items-end">
          <Button
            variant="ghost"
            className="h-11"
            onClick={() => router.push("/transactions")}
          >
            <X className="size-4" strokeWidth={1.5} />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

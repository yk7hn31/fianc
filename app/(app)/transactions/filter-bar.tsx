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

export function FilterBar({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const params = useSearchParams();

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

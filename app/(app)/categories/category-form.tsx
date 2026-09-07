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
import { CategoryIcon } from "@/components/category-icon";
import { ICON_CHOICES } from "@/lib/category-icons";
import { createCategory } from "./actions";


// "UtensilsCrossed" -> "Utensils Crossed" — a screen reader should hear a
// name, not a raw PascalCase icon identifier.
function humanizeIconName(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function CategoryForm() {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState("Circle");
  const [state, formAction, pending] = useActionState(createCategory, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setIcon("Circle");
      toast.success("Category added");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const fieldError = fieldErrorReader(state);

  function handleIconKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();

    const next =
      (ICON_CHOICES.indexOf(icon) + step + ICON_CHOICES.length) %
      ICON_CHOICES.length;
    setIcon(ICON_CHOICES[next]);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="New category"
      description="Group your transactions the way you actually think about them."
      trigger={
        <Button>
          <Plus className="size-4" strokeWidth={1.5} />
          New category
        </Button>
      }
    >
      <form action={formAction} aria-busy={pending} className="space-y-3">
        <FormField label="Name" name="name" error={fieldError("name")} />

        <FieldShell label="Kind" name="kind" error={fieldError("kind")}>
          <Select name="kind" defaultValue="expense">
            <SelectTrigger
              id="kind"
              aria-invalid={Boolean(fieldError("kind"))}
              aria-describedby={fieldError("kind") ? "kind-error" : undefined}
              className="h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </FieldShell>

        <FieldShell label="Icon" name="icon" error={fieldError("icon")}>
          <input type="hidden" name="icon" value={icon} />
          {/*
            A radiogroup, not sixteen toggle buttons: exactly one icon is
            chosen at a time, so aria-pressed would announce each as an
            independent toggle and leave sixteen tab stops inside the form.
          */}
          <div
            role="radiogroup"
            aria-label="Icon"
            onKeyDown={handleIconKeyDown}
            className="grid grid-cols-6 gap-2 md:grid-cols-8"
          >
            {ICON_CHOICES.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={icon === name}
                aria-label={humanizeIconName(name)}
                // Roving focus: the group is one tab stop, arrows move within.
                tabIndex={icon === name ? 0 : -1}
                onClick={() => setIcon(name)}
                className={
                  icon === name
                    ? "grid size-11 place-items-center rounded-pill bg-primary text-primary-foreground"
                    : "grid size-11 place-items-center rounded-pill bg-muted text-foreground"
                }
              >
                <CategoryIcon name={name} />
              </button>
            ))}
          </div>
        </FieldShell>

        <Button type="submit" className="w-full h-11" disabled={pending}>
          {pending ? "Saving…" : "Add category"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}

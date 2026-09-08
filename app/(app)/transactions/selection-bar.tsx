"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteTransactions } from "./actions";

export function SelectionBar({
  selected,
  onCleared,
}: {
  selected: string[];
  onCleared: () => void;
}) {
  const [pending, startTransition] = useTransition();
  /*
   * The transitions.dev toast: the bar rises from below with a fade, a slight
   * scale and a cross-blur as soon as a row is ticked.
   *
   * `.is-open` is added a frame after mount rather than on the first render.
   * A transition needs two painted states to tween between, and an element
   * that has never been laid out in its closed state has only one — the
   * browser would resolve straight to the open values and nothing would move.
   *
   * The bar still unmounts the moment the selection empties: no exit clock.
   * Clearing a selection is usually the prelude to picking a different one,
   * and a bar that lingered a third of a second would be sliding out under
   * the row the user is already reaching for.
   */
  const [open, setOpen] = useState(false);
  const anySelected = selected.length > 0;

  useEffect(() => {
    if (!anySelected) {
      setOpen(false);
      return;
    }
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [anySelected]);

  if (selected.length === 0) return null;

  return (
    <div
      className={cn(
        "t-toast mb-3 flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3 shadow-card",
        open && "is-open",
      )}
    >
      <span>{selected.length} selected</span>
      <Button
        variant="destructive"
        className="h-11"
        disabled={pending}
        onClick={() => {
          // These rows are gone for good once deleted — a mis-tap on a bulk
          // selection is far costlier than on a single row.
          const count = selected.length;
          if (
            !window.confirm(
              `Delete ${count} ${count === 1 ? "transaction" : "transactions"}? This cannot be undone.`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            const res = await deleteTransactions(selected);
            if (res.ok) {
              toast.success("Deleted");
              onCleared();
            } else {
              toast.error(res.error);
            }
          });
        }}
      >
        <Trash2 className="size-4" strokeWidth={1.5} />
        Delete
      </Button>
    </div>
  );
}

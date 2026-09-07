"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTransactions } from "./actions";

export function SelectionBar({
  selected,
  onCleared,
}: {
  selected: string[];
  onCleared: () => void;
}) {
  const [pending, startTransition] = useTransition();
  if (selected.length === 0) return null;

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3 shadow-card">
      <span>{selected.length} selected</span>
      <Button
        variant="destructive"
        className="h-11"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await deleteTransactions(selected);
            if (res.ok) {
              toast.success("Deleted");
              onCleared();
            } else {
              toast.error(res.error);
            }
          })
        }
      >
        <Trash2 className="size-4" strokeWidth={1.5} />
        Delete
      </Button>
    </div>
  );
}

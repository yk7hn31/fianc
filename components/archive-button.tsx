"use client";

import { useTransition } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

export function ArchiveButton({
  label,
  onArchive,
}: {
  label: string;
  onArchive: () => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-11"
      aria-label={`Archive ${label}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await onArchive();
          if (res.ok) toast.success(`${label} archived`);
          else toast.error(res.error);
        })
      }
    >
      <Archive className="size-4" strokeWidth={1.5} />
    </Button>
  );
}

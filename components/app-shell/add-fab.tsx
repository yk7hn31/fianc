import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The mobile "add" affordance, sitting one bar-height above the bottom nav.
 *
 * Deliberately not a client component: it is handed to `ResponsiveDialog` as
 * `trigger`, which reaches Base UI as `render={trigger}` and clones the
 * element to attach the open handler and a ref. Behind a client boundary the
 * clone would target this wrapper, which does not forward props, and the
 * button would render but never open anything.
 *
 * No radius class here on purpose. `buttonVariants` already applies
 * `rounded-pill` — the 18px DESIGN.md mandates for every interactive element —
 * and adding `rounded-full` does not override it: tailwind-merge does not know
 * this project's custom `rounded-pill`, so it treats the two as unrelated,
 * keeps both, and the cascade decides. The 18px squircle is the correct
 * result; the extra class only looked load-bearing.
 */
export function AddFabTrigger() {
  return (
    <Button
      aria-label="Add transaction"
      className="fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 size-14 p-0 shadow-card md:hidden"
    >
      <Plus className="size-6" strokeWidth={1.5} />
    </Button>
  );
}

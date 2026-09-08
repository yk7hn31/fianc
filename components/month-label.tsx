"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * The month-switcher's label, swapped in place rather than cut (the
 * transitions.dev "text states swap"): the old month exits upward with a
 * blur, the new one enters from below.
 *
 * A client component because the swap is a three-phase DOM sequence and the
 * switcher itself is server-rendered. `display` — not the `label` prop — is
 * what gets painted, so the outgoing text survives its own exit; React would
 * otherwise have replaced the characters the moment the new page's props
 * arrived, and the exit would animate the text it was supposed to replace.
 *
 * `flushSync` is what makes phase 2 an atomic beat. The snippet's ordering —
 * change the text, jump to "below, no transition", force a reflow, release —
 * only holds if the text is on screen before the reflow; a plain `setState`
 * inside the timeout commits after this callback returns, so the reflow would
 * capture the *old* text and the new month would fade in from nowhere.
 */
export function MonthLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(label);

  useEffect(() => {
    const el = ref.current;
    if (!el || display === label) return;

    const dur =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--text-swap-dur",
        ),
      ) || 150;

    el.classList.add("is-exit");
    const timer = setTimeout(() => {
      flushSync(() => setDisplay(label));
      el.classList.remove("is-exit");
      el.classList.add("is-enter-start");
      void el.offsetHeight; // force reflow so the next change transitions
      el.classList.remove("is-enter-start");
    }, dur);

    return () => {
      clearTimeout(timer);
      // A month switched mid-swap would otherwise leave the label parked at
      // the exit state — faded out — with nothing scheduled to bring it back.
      el.classList.remove("is-exit", "is-enter-start");
    };
  }, [label, display]);

  return (
    <span ref={ref} className={cn("t-text-swap", className)}>
      {display}
    </span>
  );
}

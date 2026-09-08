"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";

type FormAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

/**
 * `useActionState` plus the reset React does not give it.
 *
 * Every form here lives in a dialog that unmounts its fields on close while
 * this state survives in the parent, so a rejected submit's field errors come
 * back with the next open: a blank form whose amount input is already
 * `aria-invalid`, wired to a visible `#amount-error`, announcing why the last
 * value was wrong before a key is pressed. The transaction form needs the same
 * clearing on a mode switch — those errors belong to the form the user left.
 *
 * Dismissal records the state *object* rather than flipping a flag, because
 * the flag would have to be re-armed on submit and `useActionState` keeps the
 * previous state for the whole pending window — the discarded errors would
 * flash back while the next save was in flight. Identity holds because `fail`
 * and `ok` build a fresh object per call.
 */
export function useResettableActionState(
  action: FormAction,
): [ActionResult | null, (formData: FormData) => void, boolean, () => void] {
  const [state, formAction, pending] = useActionState(action, null);
  const [dismissed, setDismissed] = useState<ActionResult | null>(null);

  return [
    state === dismissed ? null : state,
    formAction,
    pending,
    () => setDismissed(state),
  ];
}

/**
 * Reads the first message for a field out of an action's result.
 *
 * Every form in the app pairs a zod schema with `fail(msg, fieldErrors)`, so
 * without this the specific reason a value was rejected — which decimal place
 * was wrong, which field was empty — stays on the server and the user gets
 * only the generic top-level message.
 */
export function fieldErrorReader(
  state: ActionResult | null,
): (name: string) => string | undefined {
  return (name) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;
}

/**
 * Label, control and error message wired together. Use this when the control
 * is not a plain input — a Select, a radio group — and `FormField` when it is.
 */
export function FieldShell({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    /*
      `.t-input-wrap` / `.is-error` are the transitions.dev error-state shake's
      outer hooks — they own the message reveal. The shake itself lives on
      `.t-input`, which `FormField` puts on the input it renders; a FieldShell
      wrapping a Select or a tablist has no single bordered box to shake, and
      a transform on a wrapper would become the containing block for anything
      inside it that positions itself.
    */
    <div className={cn("t-input-wrap space-y-1.5", error && "is-error")}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && (
        <p
          id={`${name}-error`}
          className="t-error-msg text-destructive text-caption"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function FormField({
  label,
  name,
  error,
  className,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & Omit<ComponentProps<typeof Input>, "name">) {
  const ref = useRef<HTMLInputElement>(null);

  /*
   * Replay the shake whenever this field is newly rejected. The class has to
   * come off, the layout has to be read back, and only then can it go on
   * again — re-adding a class that is already there is not a state change, so
   * without the reflow the animation would run once and never again.
   *
   * The trigger is the error *value* changing, which covers the two cases
   * that matter: a clean field being rejected, and a rejected field being
   * rejected for a new reason. Submitting the same wrong value twice reports
   * the same string both times and shakes once — an action result carries no
   * attempt counter to distinguish the second submit from a re-render.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el || !error) return;

    el.classList.remove("is-shaking");
    void el.offsetWidth; // force reflow
    el.classList.add("is-shaking");

    const cs = getComputedStyle(document.documentElement);
    const ms = (name: string, fallback: number) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };
    const shakeMs = ms("--shake-dur-a", 80) * 2 + ms("--shake-dur-b", 60) * 2;

    const timer = setTimeout(
      () => el.classList.remove("is-shaking"),
      shakeMs + 20,
    );
    return () => {
      clearTimeout(timer);
      el.classList.remove("is-shaking");
    };
  }, [error]);

  return (
    <FieldShell label={label} name={name} error={error}>
      <Input
        ref={ref}
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        // Without this a screen reader announces the field as invalid but
        // never reads why — the reason sits in a sibling paragraph.
        aria-describedby={error ? `${name}-error` : undefined}
        // `.t-input` owns the shake and the border-color tween; `.is-error`
        // switches that tween to the slower clock the message fades on.
        className={cn("t-input h-11", error && "is-error", className)}
        {...props}
      />
    </FieldShell>
  );
}

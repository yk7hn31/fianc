"use client";

import {
  useActionState,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && (
        <p id={`${name}-error`} className="text-destructive text-caption">
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
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & Omit<ComponentProps<typeof Input>, "name">) {
  return (
    <FieldShell label={label} name={name} error={error}>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        // Without this a screen reader announces the field as invalid but
        // never reads why — the reason sits in a sibling paragraph.
        aria-describedby={error ? `${name}-error` : undefined}
        className="h-11"
        {...props}
      />
    </FieldShell>
  );
}

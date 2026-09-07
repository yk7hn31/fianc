"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, fieldErrorReader } from "@/components/form-field";
import type { ActionResult } from "@/lib/action-result";

type Action = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  // React resets an uncontrolled form after every action cycle, so a rejected
  // signup code would also wipe the name and email the user typed correctly.
  // Only these two are held — clearing the password and the code on a failed
  // attempt is the behaviour we want.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const fieldError = fieldErrorReader(state);

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="p-5">
        <h1 className="text-heading-sm font-semibold mb-1">
          {mode === "login" ? "Sign in to fianc" : "Create your fianc account"}
        </h1>
        <p className="text-muted-foreground mb-5">
          {mode === "login"
            ? "Enter your email and password."
            : "You need the signup code."}
        </p>

        <form action={formAction} aria-busy={pending} className="space-y-3">
          {mode === "signup" && (
            <FormField
              label="Name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldError("name")}
            />
          )}
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError("email")}
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            error={fieldError("password")}
          />
          {mode === "signup" && (
            <FormField label="Signup code" name="code" error={fieldError("code")} />
          )}

          {state && !state.ok && (
            <p role="alert" className="text-destructive text-body">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full h-11" disabled={pending}>
            {pending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-muted-foreground mt-4">
          {mode === "login" ? (
            <>
              No account? <Link href="/signup" className="text-foreground underline">Sign up</Link>
            </>
          ) : (
            <>
              Have an account? <Link href="/login" className="text-foreground underline">Sign in</Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

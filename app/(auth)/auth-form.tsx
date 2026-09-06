"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  const fieldError = (k: string) =>
    state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

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

        <form action={formAction} className="space-y-3">
          {mode === "signup" && (
            <Field label="Name" name="name" error={fieldError("name")} />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            error={fieldError("email")}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            error={fieldError("password")}
          />
          {mode === "signup" && (
            <Field label="Signup code" name="code" error={fieldError("code")} />
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

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className="h-11"
      />
      {error && <p className="text-destructive text-caption">{error}</p>}
    </div>
  );
}

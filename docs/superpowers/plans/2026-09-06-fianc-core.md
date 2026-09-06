# fianc Core (Ledger + Budgets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, installable-later money app where one user can log in, keep accounts and categories, record income/expense/transfer transactions, set per-category monthly budgets with rollover, and see a month dashboard.

**Architecture:** Next.js 15 App Router with server actions as the only mutation path. All business logic lives in pure modules under `lib/` (money parsing, budget rollover) so it is unit-testable without a database; `lib/queries/*` holds the read models and takes `userId` as its first argument. Auth is hand-rolled: argon2id password hashes and opaque session tokens stored hashed in Postgres. The UI is authored mobile-first, with layout differences expressed as CSS breakpoints and only structural swaps (drawer vs dialog, bottom bar vs sidebar) going through a media-query hook.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, Tailwind v4, shadcn/ui, Lucide icons, Neon Postgres, Drizzle ORM + postgres.js, Zod, Recharts, `@node-rs/argon2`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-money-app-design.md`

**Follow-on plan:** `docs/superpowers/plans/2026-09-06-fianc-import-recurring-pwa.md` (CSV import, recurring rules, PWA). Do not start it until this plan is green.

## Global Constraints

These apply to every task. They are copied from the spec; do not re-derive them.

- App name is **fianc** (lowercase).
- **Icons: Lucide only. Never use emoji anywhere in the UI**, including empty states, toasts, and commit-adjacent UI copy.
- Light theme only. No dark mode in v1. Do not add `dark:` variants.
- All visual values come from `DESIGN.md`. Interactive elements (buttons, inputs, badges) use 18px radius; containers (cards) use 24px. Never square corners. The only chromatic color is `#e7000b`, used exclusively for destructive and error states.
- Body text is 14px minimum. Muted text is `#737373`; never lighter.
- **Money is always integer minor units** (`bigint` in Postgres, `number` in TypeScript via Drizzle `mode: "number"`). Never a float, never a formatted string in the database. `transactions.amount_minor` is always positive; direction comes from `type`.
- Every query and mutation is scoped by `user_id`. A row owned by another user must behave as **not found**, never as forbidden.
- Server actions return `ActionResult` (defined in Task 1). They never throw across the client boundary.
- Mobile-first: author at the phone width, expand at `md` and up. Touch targets ≥ 44px.
- Node runtime for anything touching argon2 or the database. `middleware.ts` must not import the database or the hash library.
- Commit after every task. Conventional Commits.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/money.ts` | Parse and format minor units. Pure. |
| `lib/budgets.ts` | The rollover fold and month-range helpers. Pure. |
| `lib/action-result.ts` | The `ActionResult` union and helpers. Pure. |
| `lib/db/schema.ts` | Drizzle table definitions. Single source of truth for the schema. |
| `lib/db/index.ts` | The postgres.js connection and Drizzle client. Server-only. |
| `lib/auth/password.ts` | argon2id hash and verify. |
| `lib/auth/token.ts` | Token generation, SHA-256 hashing, expiry math. Pure. |
| `lib/auth/session.ts` | Session rows, cookie read/write, `getSession()`. Server-only. |
| `lib/auth/guard.ts` | `requireUser()` for layouts and actions. |
| `lib/queries/*.ts` | Read models. Each takes `userId` first. |
| `components/ui/*` | shadcn primitives (generated). |
| `components/responsive/*` | `useMediaQuery`, `ResponsiveDialog`. |
| `components/app-shell/*` | Sidebar (desktop), bottom nav (mobile), header. |
| `app/(auth)/*` | Login and signup. No app chrome. |
| `app/(app)/*` | Guarded routes; one folder per page with its own `actions.ts`. |

---

### Task 1: Project scaffold, tooling, and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (all via `create-next-app`)
- Create: `vitest.config.ts`, `.env.example`, `lib/action-result.ts`
- Test: `lib/action-result.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ActionResult<T>`, `ok<T>(data: T)`, `fail(error: string, fieldErrors?: Record<string, string[]>)` from `@/lib/action-result`. Every server action in every later task returns this type. Also produces the npm scripts `dev`, `build`, `test`, `test:e2e`, `db:push`.

- [ ] **Step 1: Scaffold Next.js into the existing repo**

`create-next-app` refuses to write into a directory containing `docs/`, so scaffold beside it and merge.

```bash
npx create-next-app@latest .scaffold \
  --typescript --tailwind --app --eslint \
  --no-src-dir --import-alias "@/*" --use-npm --yes
rsync -a --exclude .git --exclude .gitignore .scaffold/ .
rm -rf .scaffold
npm install
```

- [ ] **Step 2: Verify the app boots**

Run: `npm run dev` then open `http://localhost:3000`
Expected: the default Next.js page renders. Stop the server with Ctrl-C.

- [ ] **Step 3: Install test tooling and configure Vitest**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
npx playwright install chromium
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    environmentMatchGlobs: [["components/**", "jsdom"]],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"db:push": "drizzle-kit push"
```

- [ ] **Step 4: Write the failing test for `ActionResult`**

Create `lib/action-result.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ok, fail, type ActionResult } from "./action-result";

describe("action-result", () => {
  it("wraps a success value", () => {
    const r: ActionResult<number> = ok(42);
    expect(r).toEqual({ ok: true, data: 42 });
  });

  it("wraps a failure message", () => {
    expect(fail("Nope")).toEqual({ ok: false, error: "Nope" });
  });

  it("carries field errors when given", () => {
    expect(fail("Invalid", { email: ["Required"] })).toEqual({
      ok: false,
      error: "Invalid",
      fieldErrors: { email: ["Required"] },
    });
  });
});
```

- [ ] **Step 5: Run the test and confirm it fails**

Run: `npm test -- lib/action-result.test.ts`
Expected: FAIL — `Failed to resolve import "./action-result"`.

- [ ] **Step 6: Implement `lib/action-result.ts`**

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 8: Write `.env.example`**

```bash
# Neon → Project Dashboard → Connection Details
# Pooled (host contains -pooler) — used by the app at runtime
DATABASE_URL="postgresql://USER:PASSWORD@ep-NAME-pooler.REGION.aws.neon.tech/fianc?sslmode=require"
# Direct (no -pooler) — used by drizzle-kit for schema push only
DIRECT_URL="postgresql://USER:PASSWORD@ep-NAME.REGION.aws.neon.tech/fianc?sslmode=require"
# Shared secret required to create an account. Any long random string.
SIGNUP_CODE="change-me"
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Playwright"
```

---

### Task 2: Design tokens, fonts, and shadcn primitives

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `components.json` (via shadcn init), `components/ui/*`
- Create: `app/page.tsx` (replace with a token smoke page)

**Interfaces:**
- Consumes: Task 1's scaffold.
- Produces: the CSS custom properties named in `DESIGN.md`, the Tailwind utilities `rounded-card` (24px) and `rounded-pill` (18px), the `--font-geist` family applied to `<body>`, and the shadcn primitives `Button`, `Card`, `Input`, `Label`, `Badge`, `Dialog`, `Drawer`, `Sheet`, `Select`, `Table`, `Sonner` (toaster), `Switch`, `Popover`, `Calendar`, `Tabs`, `Separator`, `Skeleton`.

- [ ] **Step 1: Initialise shadcn and add the primitives**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input label badge dialog drawer sheet select table sonner switch popover calendar tabs separator skeleton dropdown-menu
npm install lucide-react
```

- [ ] **Step 2: Replace the theme block in `app/globals.css`**

Keep the `@import "tailwindcss";` line and shadcn's `@layer base` reset at the bottom. Replace the token definitions with the `DESIGN.md` values:

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --font-sans: var(--font-geist);

  --radius-pill: 18px;
  --radius-card: 24px;
  --radius-nested: 10px;
  --radius-small: 6px;

  --color-canvas: #f5f5f5;
  --color-paper: #ffffff;
  --color-surface-alt: #fafafa;
  --color-ink: #0a0a0a;
  --color-ink-soft: #171717;
  --color-mid-gray: #737373;
  --color-hairline: #e5e5e5;
  --color-ember: #e7000b;

  --color-background: var(--color-canvas);
  --color-foreground: var(--color-ink);
  --color-card: var(--color-paper);
  --color-card-foreground: var(--color-ink);
  --color-popover: var(--color-paper);
  --color-popover-foreground: var(--color-ink);
  --color-primary: var(--color-ink);
  --color-primary-foreground: var(--color-surface-alt);
  --color-secondary: var(--color-canvas);
  --color-secondary-foreground: var(--color-ink);
  --color-muted: var(--color-canvas);
  --color-muted-foreground: var(--color-mid-gray);
  --color-accent: var(--color-canvas);
  --color-accent-foreground: var(--color-ink);
  --color-destructive: var(--color-ember);
  --color-border: var(--color-hairline);
  --color-input: var(--color-canvas);
  --color-ring: var(--color-hairline);
  --color-sidebar: var(--color-surface-alt);

  --text-caption: 12px;
  --text-caption--line-height: 1.33;
  --text-caption--letter-spacing: 0.6px;
  --text-body: 14px;
  --text-body--line-height: 1.43;
  --text-heading-sm: 24px;
  --text-heading-sm--line-height: 1.33;
  --text-heading-sm--letter-spacing: -0.6px;
  --text-heading: 30px;
  --text-heading--line-height: 1.2;
  --text-heading--letter-spacing: -0.75px;
  --text-heading-lg: 36px;
  --text-heading-lg--line-height: 1.11;
  --text-heading-lg--letter-spacing: -0.9px;
  --text-display: 48px;
  --text-display--line-height: 1.1;
  --text-display--letter-spacing: -2.4px;

  --shadow-card:
    0 0 0 1px rgb(23 23 23 / 0.05),
    0 1px 3px rgb(0 0 0 / 0.1),
    0 1px 2px -1px rgb(0 0 0 / 0.1);
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground text-body antialiased;
    font-feature-settings: "ss01" on, "cv11" on;
  }
}
```

- [ ] **Step 3: Load Geist in `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "fianc",
  description: "Personal money manager",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Normalise the primitive radii**

In `components/ui/button.tsx`, `input.tsx`, and `badge.tsx`, replace every `rounded-md` / `rounded-lg` on the root element with `rounded-pill`. In `components/ui/card.tsx`, replace it with `rounded-card shadow-card border-border`. Per `DESIGN.md` a card keeps **both** the 1px hairline border and the stacked shadow — do not drop the border.

- [ ] **Step 5: Replace `app/page.tsx` with a token smoke page**

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1280px] p-6 space-y-6">
      <h1 className="text-display font-semibold">fianc</h1>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-5">
          <Wallet className="size-4" strokeWidth={1.5} />
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Delete</Button>
          <Input placeholder="Search" className="max-w-48" />
          <Badge>Tag</Badge>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Verify visually**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: `#f5f5f5` page, white card with a hairline border and faint shadow, fully pill-shaped buttons and input, Geist type, one red destructive button, a Lucide wallet icon. No emoji anywhere.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: apply DESIGN.md tokens and shadcn primitives"
```

---

### Task 3: Money module

**Files:**
- Create: `lib/money.ts`
- Test: `lib/money.test.ts`

**Interfaces:**
- Consumes: `ActionResult` conventions only (this module has its own result type).
- Produces: `parseAmount(input: string): ParseAmountResult`, `formatAmount(minor: number, currency?: string, locale?: string): string`, `directionFor(type: "income" | "expense" | "transfer"): 1 | -1`. Every form that accepts money calls `parseAmount`; every display calls `formatAmount`; every transaction insert sets `direction` from `directionFor` (Task 4 explains why the column exists).

- [ ] **Step 1: Write the failing tests**

Create `lib/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAmount, formatAmount, directionFor } from "./money";

describe("parseAmount", () => {
  it("parses whole numbers to minor units", () => {
    expect(parseAmount("12")).toEqual({ ok: true, value: 1200 });
  });

  it("parses two decimal places", () => {
    expect(parseAmount("12.34")).toEqual({ ok: true, value: 1234 });
  });

  it("pads a single decimal place", () => {
    expect(parseAmount("12.3")).toEqual({ ok: true, value: 1230 });
  });

  it("accepts comma thousands separators", () => {
    expect(parseAmount("1,234.56")).toEqual({ ok: true, value: 123456 });
  });

  it("strips a leading currency symbol", () => {
    expect(parseAmount("$12.34")).toEqual({ ok: true, value: 1234 });
  });

  it("rejects an empty string", () => {
    expect(parseAmount("   ")).toMatchObject({ ok: false });
  });

  it("rejects more than two decimals", () => {
    expect(parseAmount("1.234")).toMatchObject({ ok: false });
  });

  it("rejects comma-as-decimal because it is ambiguous", () => {
    expect(parseAmount("1,23")).toMatchObject({ ok: false });
  });

  it("rejects European grouping because it is ambiguous", () => {
    expect(parseAmount("1.234,56")).toMatchObject({ ok: false });
  });

  it("rejects negative input; direction comes from the transaction type", () => {
    expect(parseAmount("-5")).toMatchObject({ ok: false });
  });

  it("rejects amounts beyond safe integer minor units", () => {
    expect(parseAmount("999999999999999999")).toMatchObject({ ok: false });
  });

  it("does not lose cents to floating point", () => {
    expect(parseAmount("0.07")).toEqual({ ok: true, value: 7 });
    expect(parseAmount("19.99")).toEqual({ ok: true, value: 1999 });
  });
});

describe("formatAmount", () => {
  it("formats minor units as currency", () => {
    expect(formatAmount(123456, "USD", "en-US")).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatAmount(0, "USD", "en-US")).toBe("$0.00");
  });

  it("formats negatives", () => {
    expect(formatAmount(-500, "USD", "en-US")).toBe("-$5.00");
  });
});

describe("directionFor", () => {
  it("is +1 for income", () => {
    expect(directionFor("income")).toBe(1);
  });

  it("is -1 for expense", () => {
    expect(directionFor("expense")).toBe(-1);
  });

  it("defaults a transfer to -1; the paired inflow row overrides it to +1", () => {
    expect(directionFor("transfer")).toBe(-1);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- lib/money.test.ts`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Implement `lib/money.ts`**

```ts
export type ParseAmountResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/** Digits with optional comma grouping and at most two decimals. */
const AMOUNT = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

export function parseAmount(input: string): ParseAmountResult {
  const raw = input.trim().replace(/\s/g, "").replace(/^[^\d.,-]+/, "");

  if (raw === "") return { ok: false, error: "Enter an amount" };
  if (raw.startsWith("-")) {
    return { ok: false, error: "Enter a positive amount" };
  }
  if (!AMOUNT.test(raw)) {
    return { ok: false, error: "Use digits and up to two decimals, e.g. 1234.56" };
  }

  const [whole, frac = ""] = raw.replace(/,/g, "").split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));

  if (!Number.isSafeInteger(minor)) {
    return { ok: false, error: "That amount is too large" };
  }
  return { ok: true, value: minor };
}

export function formatAmount(
  minor: number,
  currency = "USD",
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minor / 100);
}

/**
 * The sign an account balance should apply to a transaction of this type.
 * A transfer defaults to an outflow; `createTransfer` sets the paired inflow
 * row to +1 explicitly.
 */
export function directionFor(type: "income" | "expense" | "transfer"): 1 | -1 {
  return type === "income" ? 1 : -1;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- lib/money.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts lib/money.test.ts
git commit -m "feat: add money parsing and formatting in minor units"
```

---

### Task 4: Database schema and client

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`
- Test: `lib/db/schema.test.ts`

**Interfaces:**
- Consumes: `.env.example` from Task 1.
- Produces: the Drizzle tables `users`, `sessions`, `accounts`, `categories`, `transactions`, `budgets`, `recurringRules`, `importBatches`; the enums `accountType`, `categoryKind`, `txType`, `recurringFreq`; the inferred types `User`, `NewUser`, `Account`, `Category`, `Transaction`, `Budget`; and `db` from `@/lib/db`. Every later task imports tables from `@/lib/db/schema` and the client from `@/lib/db`.

- [ ] **Step 1: Install database dependencies**

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

- [ ] **Step 2: Write the failing schema test**

This test guards the column names and money types the rest of the plan depends on. Create `lib/db/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { transactions, budgets, users } from "./schema";

describe("schema", () => {
  it("stores money as bigint minor units", () => {
    const cols = getTableConfig(transactions).columns;
    const amount = cols.find((c) => c.name === "amount_minor");
    expect(amount?.getSQLType()).toBe("bigint");
  });

  it("scopes transactions by user", () => {
    const names = getTableConfig(transactions).columns.map((c) => c.name);
    expect(names).toContain("user_id");
    expect(names).toContain("transfer_group_id");
    expect(names).toContain("dedupe_hash");
  });

  it("carries an explicit direction so transfers can be signed", () => {
    const names = getTableConfig(transactions).columns.map((c) => c.name);
    expect(names).toContain("direction");
  });

  it("keys budgets by category and month", () => {
    const names = getTableConfig(budgets).columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(["category_id", "month", "amount_minor", "rollover"]),
    );
  });

  it("keeps email unique", () => {
    const email = getTableConfig(users).columns.find((c) => c.name === "email");
    expect(email?.isUnique).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm test -- lib/db/schema.test.ts`
Expected: FAIL — cannot resolve `./schema`.

- [ ] **Step 4: Implement `lib/db/schema.ts`**

```ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  bigint,
  integer,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accountType = pgEnum("account_type", [
  "checking",
  "savings",
  "cash",
  "credit_card",
  "investment",
]);
export const categoryKind = pgEnum("category_kind", ["income", "expense"]);
export const txType = pgEnum("tx_type", ["income", "expense", "transfer"]);
export const recurringFreq = pgEnum("recurring_freq", [
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

const money = (name: string) => bigint(name, { mode: "number" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  baseCurrency: text("base_currency").notNull().default("USD"),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: accountType("type").notNull(),
    openingBalance: money("opening_balance").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: categoryKind("kind").notNull(),
    parentId: uuid("parent_id"),
    icon: text("icon").notNull().default("Circle"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("categories_user_idx").on(t.userId)],
);

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  rowCount: integer("row_count").notNull(),
  createdAt: createdAt(),
});

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    type: txType("type").notNull(),
    amountMinor: money("amount_minor").notNull(),
    payee: text("payee").notNull().default(""),
    note: text("note").notNull().default(""),
    freq: recurringFreq("freq").notNull(),
    interval: integer("interval").notNull().default(1),
    anchorDay: integer("anchor_day").notNull().default(1),
    anchorMonth: integer("anchor_month"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    lastPostedDate: date("last_posted_date"),
    paused: boolean("paused").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("recurring_user_idx").on(t.userId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    type: txType("type").notNull(),
    /** Always positive. The sign lives in `direction`. */
    amountMinor: money("amount_minor").notNull(),
    /**
     * +1 inflow, -1 outflow. Derivable from `type` for income and expense,
     * but not for a transfer: both halves of a transfer are `type = 'transfer'`
     * and differ only in direction. Storing it keeps every balance query a
     * plain `sum(direction * amount_minor)` with no case analysis.
     */
    direction: integer("direction").notNull(),
    date: date("date").notNull(),
    payee: text("payee").notNull().default(""),
    note: text("note").notNull().default(""),
    transferGroupId: uuid("transfer_group_id"),
    recurringRuleId: uuid("recurring_rule_id").references(
      () => recurringRules.id,
      { onDelete: "set null" },
    ),
    occurrenceDate: date("occurrence_date"),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "cascade",
    }),
    dedupeHash: text("dedupe_hash"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tx_user_date_idx").on(t.userId, t.date.desc()),
    index("tx_user_category_date_idx").on(t.userId, t.categoryId, t.date),
    index("tx_user_account_date_idx").on(t.userId, t.accountId, t.date),
    index("tx_transfer_group_idx").on(t.transferGroupId),
    uniqueIndex("tx_recurring_occurrence_idx").on(
      t.recurringRuleId,
      t.occurrenceDate,
    ),
    uniqueIndex("tx_user_dedupe_idx")
      .on(t.userId, t.dedupeHash)
      .where(sql`${t.dedupeHash} is not null`),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** Always the first day of the month. */
    month: date("month").notNull(),
    amountMinor: money("amount_minor").notNull(),
    rollover: boolean("rollover").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("budgets_user_category_month_idx").on(
      t.userId,
      t.categoryId,
      t.month,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test -- lib/db/schema.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Implement the client and drizzle config**

`lib/db/index.ts`:

```ts
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// `prepare: false` is required: Neon's pooled endpoint cannot hold prepared
// statements between queries.
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
```

```bash
npm install server-only
```

`drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DIRECT_URL! },
});
```

Add `import "dotenv/config";` at the top of `drizzle.config.ts` and `npm install -D dotenv`.

- [ ] **Step 7: Push the schema to Neon**

Copy `.env.example` to `.env.local`, fill in the real Neon values, then:

```bash
cp .env.local .env   # drizzle-kit reads .env
npm run db:push
```

Expected: drizzle-kit reports the eight tables and the enums as created. Verify in the Neon SQL editor.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema and Neon client"
```

---

### Task 5: Auth primitives (password and token)

**Files:**
- Create: `lib/auth/password.ts`, `lib/auth/token.ts`
- Test: `lib/auth/password.test.ts`, `lib/auth/token.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(hash: string, plain: string): Promise<boolean>`, `generateToken(): string`, `hashToken(token: string): string`, `sessionExpiry(now?: Date): Date`, `isExpired(expiresAt: Date, now?: Date): boolean`, `shouldRefresh(expiresAt: Date, now?: Date): boolean`. Task 6 composes these into session rows.

- [ ] **Step 1: Install argon2**

```bash
npm install @node-rs/argon2
```

- [ ] **Step 2: Write the failing tests**

`lib/auth/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("produces an argon2id hash, not the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("correct horse");
  });

  it("verifies the right password", async () => {
    const hash = await hashPassword("s3cret-passphrase");
    await expect(verifyPassword(hash, "s3cret-passphrase")).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("s3cret-passphrase");
    await expect(verifyPassword(hash, "s3cret-passphras")).resolves.toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const a = await hashPassword("same-password-twice");
    const b = await hashPassword("same-password-twice");
    expect(a).not.toBe(b);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    await expect(verifyPassword("not-a-hash", "whatever")).resolves.toBe(false);
  });
});
```

`lib/auth/token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  sessionExpiry,
  isExpired,
  shouldRefresh,
} from "./token";

describe("token", () => {
  it("generates a distinct high-entropy token each call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes, base64url
  });

  it("hashes deterministically to 64 hex characters", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never returns the token as its own hash", () => {
    const t = generateToken();
    expect(hashToken(t)).not.toBe(t);
  });

  it("expires sessions 30 days out", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(sessionExpiry(now).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("detects expiry", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(isExpired(new Date("2026-01-09T23:59:00Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-01-10T00:01:00Z"), now)).toBe(false);
  });

  it("refreshes once more than half the lifetime has elapsed", () => {
    const now = new Date("2026-01-20T00:00:00Z");
    // 20 days left of 30: less than half elapsed.
    expect(shouldRefresh(new Date("2026-02-09T00:00:00Z"), now)).toBe(false);
    // 10 days left of 30: more than half elapsed.
    expect(shouldRefresh(new Date("2026-01-30T00:00:00Z"), now)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test -- lib/auth`
Expected: FAIL — cannot resolve `./password` and `./token`.

- [ ] **Step 4: Implement both modules**

`lib/auth/password.ts`:

```ts
import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    // A malformed stored hash must read as "wrong password", not a crash.
    return false;
  }
}
```

`lib/auth/token.ts`:

```ts
import { randomBytes, createHash } from "node:crypto";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "fianc_session";

/** The value that goes in the cookie. Never stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What gets stored in `sessions.token_hash`. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function shouldRefresh(expiresAt: Date, now: Date = new Date()): boolean {
  const remaining = expiresAt.getTime() - now.getTime();
  return remaining > 0 && remaining < SESSION_TTL_MS / 2;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test -- lib/auth`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/auth
git commit -m "feat: add argon2id password hashing and session token primitives"
```

---

### Task 6: Sessions, login, signup, and the route guard

**Files:**
- Create: `lib/auth/session.ts`, `lib/auth/guard.ts`, `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/actions.ts`, `app/(auth)/auth-form.tsx`, `middleware.ts`
- Create: `playwright.config.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` (Task 5), `generateToken`, `hashToken`, `sessionExpiry`, `isExpired`, `shouldRefresh`, `SESSION_COOKIE` (Task 5), `db` and `users`/`sessions` (Task 4), `ok`/`fail` (Task 1).
- Produces: `getSession(): Promise<{ user: User } | null>` (cached per request), `createSession(userId: string): Promise<void>`, `destroySession(): Promise<void>` from `@/lib/auth/session`; `requireUser(): Promise<User>` from `@/lib/auth/guard`. **Every server action in Tasks 8–13 starts with `const user = await requireUser()`.**

- [ ] **Step 1: Implement the session module**

`lib/auth/session.ts`:

```ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import {
  SESSION_COOKIE,
  generateToken,
  hashToken,
  isExpired,
  sessionExpiry,
  shouldRefresh,
} from "./token";

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = sessionExpiry();

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Validates the session cookie against the database.
 * Cached per request so a layout and three actions cost one query.
 */
export const getSession = cache(async (): Promise<{ user: User } | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;

  if (isExpired(row.session.expiresAt)) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }

  if (shouldRefresh(row.session.expiresAt)) {
    const expiresAt = sessionExpiry();
    await db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.id, row.session.id));
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }

  return { user: row.user };
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
```

`lib/auth/guard.ts`:

```ts
import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { User } from "@/lib/db/schema";

export async function requireUser(): Promise<User> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
```

- [ ] **Step 2: Implement the auth actions**

`app/(auth)/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  purgeExpiredSessions,
} from "@/lib/auth/session";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { seedDefaultCategories } from "@/lib/queries/categories";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters"),
});

const signupInput = credentials.extend({
  name: z.string().trim().min(1, "Enter a name"),
  code: z.string().min(1, "Enter the signup code"),
});

export async function signup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signupInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", parsed.error.flatten().fieldErrors);
  }
  const { email, password, name, code } = parsed.data;

  if (!process.env.SIGNUP_CODE || code !== process.env.SIGNUP_CODE) {
    return fail("That signup code is not valid");
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return fail("That email is already registered");

  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash: await hashPassword(password) })
    .returning();

  await seedDefaultCategories(user.id);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", parsed.error.flatten().fieldErrors);
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // One message for both branches: do not reveal which emails exist.
  const invalid = fail("Email or password is incorrect");
  if (!user) return invalid;
  if (!(await verifyPassword(user.passwordHash, password))) return invalid;

  await purgeExpiredSessions();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
```

Note: `redirect()` throws a control-flow signal, so the `ActionResult` return type is only reached on failure. That is intended.

- [ ] **Step 3: Build the auth form and pages**

`app/(auth)/auth-form.tsx`:

```tsx
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
```

`app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh grid place-items-center p-4">{children}</main>
  );
}
```

`app/(auth)/login/page.tsx`:

```tsx
import { AuthForm } from "../auth-form";
import { login } from "../actions";

export default function LoginPage() {
  return <AuthForm mode="login" action={login} />;
}
```

`app/(auth)/signup/page.tsx`:

```tsx
import { AuthForm } from "../auth-form";
import { signup } from "../actions";

export default function SignupPage() {
  return <AuthForm mode="signup" action={signup} />;
}
```

- [ ] **Step 4: Add the middleware**

`middleware.ts` — cookie presence only. It must not import `@/lib/db` or argon2; middleware runs on the edge runtime where neither works.

```ts
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fianc_session";

export function middleware(request: NextRequest) {
  const hasCookie = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!hasCookie && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
```

- [ ] **Step 5: Write the failing e2e test**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

`e2e/auth.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const code = process.env.SIGNUP_CODE ?? "change-me";

function uniqueEmail() {
  return `e2e+${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`;
}

test("signup with the code lands on the dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("signup without the right code is rejected", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill("wrong-code");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("signup code");
});

test("a signed-out visitor is redirected to login", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login/);
});

test("login then logout", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
```

- [ ] **Step 6: Run the e2e test and confirm it fails**

Run: `npm run test:e2e -- --project=desktop e2e/auth.spec.ts`
Expected: FAIL — `/dashboard` does not exist yet and there is no "Sign out" button. The signup-rejection and redirect tests should already pass.

Task 7 creates the shell that makes the remaining assertions pass. Leave this test failing at the end of this task and note it in the commit body.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add session auth with login, signup, and route guard

The dashboard-dependent e2e assertions fail until the app shell lands
in the next task."
```

---

### Task 7: App shell — responsive navigation

**Files:**
- Create: `components/responsive/use-media-query.ts`, `components/responsive/responsive-dialog.tsx`, `components/app-shell/nav-items.ts`, `components/app-shell/sidebar-nav.tsx`, `components/app-shell/bottom-nav.tsx`, `components/app-shell/app-header.tsx`, `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`
- Test: `components/responsive/use-media-query.test.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 6), `logout` (Task 6).
- Produces: `useMediaQuery(query: string): boolean`, `useIsDesktop(): boolean` from `@/components/responsive/use-media-query`; `<ResponsiveDialog open onOpenChange title description trigger>` from `@/components/responsive/responsive-dialog` — **every add/edit form in Tasks 8–13 uses this**; `NAV_ITEMS` from `@/components/app-shell/nav-items`.

- [ ] **Step 1: Write the failing hook test**

`components/responsive/use-media-query.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "./use-media-query";

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal("matchMedia", () => mql);
  return {
    set(value: boolean) {
      mql.matches = value;
      listeners.forEach((l) => l());
    },
  };
}

describe("useMediaQuery", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("reports the current match", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("updates when the query starts matching", () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
    act(() => mql.set(true));
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- components/responsive`
Expected: FAIL — cannot resolve `./use-media-query`.

- [ ] **Step 3: Implement the hook**

`components/responsive/use-media-query.ts`. `useSyncExternalStore` is what keeps this hydration-safe: the server snapshot is a constant `false`, so the server and the first client render agree.

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // server snapshot: assume mobile, the default layout
  );
}

/** Tailwind's `md` breakpoint. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- components/responsive`
Expected: PASS, 2 tests.

- [ ] **Step 5: Implement `ResponsiveDialog`**

Only one variant is mounted at a time. Rendering both and hiding one with CSS would duplicate the focus trap and double the DOM — do not do that.

`components/responsive/responsive-dialog.tsx`:

```tsx
"use client";

import { useIsDesktop } from "./use-media-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 6: Implement the navigation**

`components/app-shell/nav-items.ts`:

```ts
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Wallet,
  Tags,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar rather than under "More". */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, primary: true },
  { href: "/budgets", label: "Budgets", icon: Target, primary: true },
  { href: "/accounts", label: "Accounts", icon: Wallet, primary: false },
  { href: "/categories", label: "Categories", icon: Tags, primary: false },
  { href: "/settings", label: "Settings", icon: Settings, primary: false },
];
```

`components/app-shell/sidebar-nav.tsx` — hidden below `md` with pure CSS, so it costs no JavaScript:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col bg-sidebar min-h-dvh p-4">
      <div className="px-2 py-3">
        <span className="text-subheading font-semibold tracking-tight">fianc</span>
      </div>
      <nav className="flex flex-col gap-1 mt-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-pill px-3 py-2 text-body",
                active
                  ? "bg-paper text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-3 text-caption text-muted-foreground">{userName}</p>
    </aside>
  );
}
```

`components/app-shell/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => i.primary);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-paper border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-caption",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={1.5} />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/settings"
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-caption text-muted-foreground"
          >
            <MoreHorizontal className="size-5" strokeWidth={1.5} />
            More
          </Link>
        </li>
      </ul>
    </nav>
  );
}
```

`components/app-shell/app-header.tsx`:

```tsx
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-3 mb-5">
      <h1 className="text-heading-sm font-semibold">{title}</h1>
      <form action={logout}>
        <Button variant="ghost" size="sm" type="submit">
          Sign out
        </Button>
      </form>
    </header>
  );
}
```

- [ ] **Step 7: Implement the guarded layout and a placeholder dashboard**

`app/(app)/layout.tsx`:

```tsx
import { requireUser } from "@/lib/auth/guard";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <SidebarNav userName={user.name} />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-6 md:pb-6">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
```

`app/(app)/dashboard/page.tsx` (placeholder; Task 13 fills it in):

```tsx
import { AppHeader } from "@/components/app-shell/app-header";

export default function DashboardPage() {
  return (
    <>
      <AppHeader title="Dashboard" />
      <p className="text-muted-foreground">Nothing here yet.</p>
    </>
  );
}
```

- [ ] **Step 8: Run the e2e suite from Task 6 and confirm it now passes**

Run: `npm run test:e2e -- --project=desktop e2e/auth.spec.ts`
Expected: PASS, 4 tests.

Then run the mobile project to confirm the bottom bar does not cover the sign-out control:
Run: `npm run test:e2e -- --project=mobile e2e/auth.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add responsive app shell with sidebar and bottom nav"
```

---

### Task 8: Accounts

**Files:**
- Create: `lib/queries/accounts.ts`, `app/(app)/accounts/page.tsx`, `app/(app)/accounts/actions.ts`, `app/(app)/accounts/account-form.tsx`, `app/(app)/accounts/account-list.tsx`
- Test: `e2e/accounts.spec.ts`

**Interfaces:**
- Consumes: `requireUser`, `db`, `accounts`, `transactions`, `parseAmount`, `formatAmount`, `directionFor`, `ResponsiveDialog`, `ok`/`fail`.
- Produces: `listAccountsWithBalance(userId: string): Promise<AccountWithBalance[]>` where `AccountWithBalance = Account & { balanceMinor: number }`, and `listActiveAccounts(userId: string): Promise<Account[]>` from `@/lib/queries/accounts`. Tasks 10 and 13 use both. Also produces the actions `createAccount`, `updateAccount`, `archiveAccount`.

- [ ] **Step 1: Implement the query module**

`lib/queries/accounts.ts`:

```ts
import "server-only";
import { and, eq, isNull, sql, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, transactions, type Account } from "@/lib/db/schema";

export type AccountWithBalance = Account & { balanceMinor: number };

/**
 * Balance is never stored: it is the opening balance plus the signed sum of
 * the account's transactions. Transfers are ordinary rows here — each half
 * carries its own `direction` — which is the whole point of the two-row model.
 */
export async function listAccountsWithBalance(
  userId: string,
): Promise<AccountWithBalance[]> {
  const delta = db
    .select({
      accountId: transactions.accountId,
      sum: sql<number>`sum(${transactions.direction} * ${transactions.amountMinor})`.as("sum"),
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.accountId)
    .as("delta");

  const rows = await db
    .select({
      account: accounts,
      delta: sql<number>`coalesce(${delta.sum}, 0)`,
    })
    .from(accounts)
    .leftJoin(delta, eq(delta.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));

  return rows.map(({ account, delta }) => ({
    ...account,
    balanceMinor: Number(account.openingBalance) + Number(delta),
  }));
}

export async function listActiveAccounts(userId: string): Promise<Account[]> {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
}
```

- [ ] **Step 2: Implement the actions**

`app/(app)/accounts/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { parseAmount } from "@/lib/money";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const accountInput = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  type: z.enum(["checking", "savings", "cash", "credit_card", "investment"]),
  openingBalance: z.string().default("0"),
});

export async function createAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = accountInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", parsed.error.flatten().fieldErrors);
  }

  const raw = parsed.data.openingBalance.trim();
  let openingBalance = 0;
  if (raw !== "") {
    const negative = raw.startsWith("-");
    const amount = parseAmount(negative ? raw.slice(1) : raw);
    if (!amount.ok) {
      return fail("Check the form", { openingBalance: [amount.error] });
    }
    openingBalance = negative ? -amount.value : amount.value;
  }

  await db.insert(accounts).values({
    userId: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    openingBalance,
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return ok();
}

export async function archiveAccount(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const [row] = await db
    .update(accounts)
    .set({ archivedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
    .returning({ id: accounts.id });

  // Another user's row must read as missing, not as forbidden.
  if (!row) return fail("Account not found");

  revalidatePath("/accounts");
  return ok();
}
```

- [ ] **Step 3: Implement the page**

`app/(app)/accounts/account-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import { createAccount } from "./actions";

export function AccountForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAccount, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      toast.success("Account added");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="New account"
      description="Cash, a card, or anything you want a balance for."
      trigger={
        <Button>
          <Plus className="size-4" strokeWidth={1.5} />
          New account
        </Button>
      }
    >
      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select name="type" defaultValue="checking">
            <SelectTrigger id="type" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit_card">Credit card</SelectItem>
              <SelectItem value="investment">Investment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="openingBalance">Opening balance</Label>
          <Input
            id="openingBalance"
            name="openingBalance"
            inputMode="decimal"
            placeholder="0.00"
            className="h-11"
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={pending}>
          {pending ? "Saving…" : "Add account"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}
```

`app/(app)/accounts/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth/guard";
import { listAccountsWithBalance } from "@/lib/queries/accounts";
import { formatAmount } from "@/lib/money";
import { AppHeader } from "@/components/app-shell/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { AccountForm } from "./account-form";

export default async function AccountsPage() {
  const user = await requireUser();
  const accounts = await listAccountsWithBalance(user.id);

  return (
    <>
      <AppHeader title="Accounts" />
      <div className="mb-5">
        <AccountForm />
      </div>

      {accounts.length === 0 ? (
        <p className="text-muted-foreground">
          No accounts yet. Add one to start recording transactions.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="p-5">
                  <p className="text-caption uppercase text-muted-foreground">
                    {a.type.replace("_", " ")}
                  </p>
                  <p className="text-body-lg font-medium">{a.name}</p>
                  <p className="text-heading font-semibold tabular-nums">
                    {formatAmount(a.balanceMinor, user.baseCurrency)}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 4: Write the e2e test**

`e2e/accounts.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("create an account and see its opening balance", async ({ page }) => {
  await signUp(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Name").fill("Everyday Checking");
  await page.getByLabel("Opening balance").fill("1,250.50");
  await page.getByRole("button", { name: "Add account" }).click();

  await expect(page.getByText("Everyday Checking")).toBeVisible();
  await expect(page.getByText("$1,250.50")).toBeVisible();
});
```

Create `e2e/helpers.ts`:

```ts
import type { Page } from "@playwright/test";

const code = process.env.SIGNUP_CODE ?? "change-me";

export async function signUp(page: Page): Promise<string> {
  const email = `e2e+${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);
  return email;
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm run test:e2e -- e2e/accounts.spec.ts`
Expected: PASS on both the desktop and mobile projects.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add accounts with computed balances"
```

---

### Task 9: Categories and first-login seed

**Files:**
- Create: `lib/queries/categories.ts`, `app/(app)/categories/page.tsx`, `app/(app)/categories/actions.ts`, `app/(app)/categories/category-form.tsx`, `components/category-icon.tsx`
- Test: `lib/queries/categories.test.ts`, `e2e/categories.spec.ts`

**Interfaces:**
- Consumes: `requireUser`, `db`, `categories`.
- Produces: `DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense"; icon: string }[]`, `seedDefaultCategories(userId: string): Promise<void>` (already called by Task 6's signup action), `listCategories(userId, kind?): Promise<Category[]>` from `@/lib/queries/categories`; `<CategoryIcon name={string} />` from `@/components/category-icon`. Tasks 10, 12, and 13 use `listCategories` and `CategoryIcon`.

- [ ] **Step 1: Write the failing test for the seed list**

`lib/queries/categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as icons from "lucide-react";
import { DEFAULT_CATEGORIES } from "./categories.data";

describe("DEFAULT_CATEGORIES", () => {
  it("seeds at least one income category and several expense categories", () => {
    const income = DEFAULT_CATEGORIES.filter((c) => c.kind === "income");
    const expense = DEFAULT_CATEGORIES.filter((c) => c.kind === "expense");
    expect(income.length).toBeGreaterThanOrEqual(1);
    expect(expense.length).toBeGreaterThanOrEqual(6);
  });

  it("has no duplicate names", () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names only icons that exist in lucide-react", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(icons, `${c.name} → ${c.icon}`).toHaveProperty(c.icon);
    }
  });
});
```

The data lives in its own file (`categories.data.ts`) so the test can import it without pulling in `server-only`.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- lib/queries/categories.test.ts`
Expected: FAIL — cannot resolve `./categories.data`.

- [ ] **Step 3: Implement the data and query modules**

`lib/queries/categories.data.ts`:

```ts
export interface DefaultCategory {
  name: string;
  kind: "income" | "expense";
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Salary", kind: "income", icon: "Banknote" },
  { name: "Groceries", kind: "expense", icon: "ShoppingCart" },
  { name: "Rent", kind: "expense", icon: "House" },
  { name: "Transport", kind: "expense", icon: "Bus" },
  { name: "Dining", kind: "expense", icon: "UtensilsCrossed" },
  { name: "Utilities", kind: "expense", icon: "Plug" },
  { name: "Health", kind: "expense", icon: "HeartPulse" },
  { name: "Shopping", kind: "expense", icon: "ShoppingBag" },
  { name: "Other", kind: "expense", icon: "Circle" },
];
```

`lib/queries/categories.ts`:

```ts
import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, type Category } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES } from "./categories.data";

export { DEFAULT_CATEGORIES };

/** Called once, from signup. An empty ledger with no categories is unusable. */
export async function seedDefaultCategories(userId: string): Promise<void> {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
}

export async function listCategories(
  userId: string,
  kind?: "income" | "expense",
): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        isNull(categories.archivedAt),
        kind ? eq(categories.kind, kind) : undefined,
      ),
    )
    .orderBy(asc(categories.kind), asc(categories.name));
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- lib/queries/categories.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Implement the icon component and the page**

`components/category-icon.tsx`:

```tsx
import { Circle, icons } from "lucide-react";

export function CategoryIcon({
  name,
  className = "size-4",
}: {
  name: string;
  className?: string;
}) {
  const Icon = (icons as Record<string, typeof Circle>)[name] ?? Circle;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
```

`app/(app)/categories/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const categoryInput = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  kind: z.enum(["income", "expense"]),
  icon: z.string().trim().min(1).default("Circle"),
});

export async function createCategory(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categoryInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", parsed.error.flatten().fieldErrors);
  }

  await db.insert(categories).values({ ...parsed.data, userId: user.id });
  revalidatePath("/categories");
  revalidatePath("/budgets");
  return ok();
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const [row] = await db
    .update(categories)
    .set({ archivedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
    .returning({ id: categories.id });

  if (!row) return fail("Category not found");
  revalidatePath("/categories");
  return ok();
}
```

`app/(app)/categories/category-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import { CategoryIcon } from "@/components/category-icon";
import { createCategory } from "./actions";

const ICON_CHOICES = [
  "Circle", "ShoppingCart", "House", "Bus", "UtensilsCrossed", "Plug",
  "HeartPulse", "ShoppingBag", "Banknote", "Plane", "Dumbbell", "Gift",
  "GraduationCap", "PawPrint", "Wrench", "Film",
];

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

  const err = (k: string) =>
    state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="New category"
      description="Categories group your spending and carry your budgets."
      trigger={
        <Button>
          <Plus className="size-4" strokeWidth={1.5} />
          New category
        </Button>
      }
    >
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="icon" value={icon} />

        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            className="h-11"
            aria-invalid={Boolean(err("name"))}
          />
          {err("name") && (
            <p className="text-destructive text-caption">{err("name")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kind">Kind</Label>
          <Select name="kind" defaultValue="expense">
            <SelectTrigger id="kind" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Icon</Label>
          <div className="grid grid-cols-8 gap-1">
            {ICON_CHOICES.map((name) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={icon === name}
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
        </div>

        <Button type="submit" className="w-full h-11" disabled={pending}>
          {pending ? "Saving…" : "Add category"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}
```

`app/(app)/categories/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth/guard";
import { listCategories } from "@/lib/queries/categories";
import { AppHeader } from "@/components/app-shell/app-header";
import { CategoryIcon } from "@/components/category-icon";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryForm } from "./category-form";

export default async function CategoriesPage() {
  const user = await requireUser();
  const all = await listCategories(user.id);
  const groups = [
    { kind: "income" as const, label: "Income" },
    { kind: "expense" as const, label: "Expense" },
  ];

  return (
    <>
      <AppHeader title="Categories" />
      <div className="mb-5">
        <CategoryForm />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {groups.map(({ kind, label }) => (
          <Card key={kind}>
            <CardContent className="p-5">
              <p className="text-caption uppercase text-muted-foreground mb-3">
                {label}
              </p>
              <ul className="space-y-2">
                {all
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <CategoryIcon name={c.icon} />
                      {c.name}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 6: Write and run the e2e test**

`e2e/categories.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("a new account is seeded with default categories", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await expect(page.getByText("Groceries")).toBeVisible();
  await expect(page.getByText("Salary")).toBeVisible();
});

test("add a category", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("Name").fill("Gifts");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Gifts")).toBeVisible();
});
```

Run: `npm run test:e2e -- e2e/categories.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add categories with default seed on signup"
```

---

### Task 10: Transactions — queries and mutations

**Files:**
- Create: `lib/queries/transactions.ts`, `app/(app)/transactions/actions.ts`
- Test: `lib/queries/transactions.test.ts`

**Interfaces:**
- Consumes: `db`, `transactions`, `categories`, `accounts`, `requireUser`, `parseAmount`, `directionFor`.
- Produces: `type TxFilters = { from?: string; to?: string; accountId?: string; categoryId?: string; type?: "income" | "expense" | "transfer"; q?: string; page: number; pageSize: number }`, `listTransactions(userId, filters): Promise<{ rows: TxRow[]; total: number }>` where `TxRow = Transaction & { categoryName: string | null; categoryIcon: string | null; accountName: string }`, and `buildTxWhere(userId, filters)` (exported for testing). Also the actions `createTransaction`, `createTransfer`, `deleteTransaction`. Task 11's list page and Task 13's dashboard consume these.

- [ ] **Step 1: Write the failing test for filter construction**

Filters are the part with real logic; the SQL itself is covered end to end. `lib/queries/transactions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normaliseFilters } from "./transactions.filters";

describe("normaliseFilters", () => {
  it("defaults to page 1 with a 50-row page", () => {
    expect(normaliseFilters({})).toMatchObject({ page: 1, pageSize: 50 });
  });

  it("clamps a page below 1", () => {
    expect(normaliseFilters({ page: "0" }).page).toBe(1);
  });

  it("clamps an oversized page size", () => {
    expect(normaliseFilters({ pageSize: "5000" }).pageSize).toBe(200);
  });

  it("drops a non-date range value", () => {
    expect(normaliseFilters({ from: "not-a-date" }).from).toBeUndefined();
  });

  it("keeps an ISO date range", () => {
    expect(normaliseFilters({ from: "2026-01-01", to: "2026-01-31" })).toMatchObject({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("swaps a reversed range rather than returning nothing", () => {
    expect(normaliseFilters({ from: "2026-02-01", to: "2026-01-01" })).toMatchObject({
      from: "2026-01-01",
      to: "2026-02-01",
    });
  });

  it("drops an unknown type", () => {
    expect(normaliseFilters({ type: "refund" }).type).toBeUndefined();
  });

  it("trims the text query and drops it when empty", () => {
    expect(normaliseFilters({ q: "  coffee " }).q).toBe("coffee");
    expect(normaliseFilters({ q: "   " }).q).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- lib/queries/transactions.test.ts`
Expected: FAIL — cannot resolve `./transactions.filters`.

- [ ] **Step 3: Implement the filter module**

`lib/queries/transactions.filters.ts` (no `server-only`; it is pure and testable):

```ts
export interface TxFilters {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense" | "transfer";
  q?: string;
  page: number;
  pageSize: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(["income", "expense", "transfer"]);
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function date(v: unknown): string | undefined {
  return typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v))
    ? v
    : undefined;
}

function uuid(v: unknown): string | undefined {
  return typeof v === "string" && UUID.test(v) ? v : undefined;
}

export function normaliseFilters(
  input: Record<string, string | undefined>,
): TxFilters {
  let from = date(input.from);
  let to = date(input.to);
  if (from && to && from > to) [from, to] = [to, from];

  const page = Math.max(1, Number.parseInt(input.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, Number.parseInt(input.pageSize ?? "50", 10) || 50),
  );

  const q = input.q?.trim();
  const type =
    input.type && TYPES.has(input.type)
      ? (input.type as TxFilters["type"])
      : undefined;

  return {
    from,
    to,
    accountId: uuid(input.accountId),
    categoryId: uuid(input.categoryId),
    type,
    q: q ? q : undefined,
    page,
    pageSize,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- lib/queries/transactions.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Implement the query module**

`lib/queries/transactions.ts`:

```ts
import "server-only";
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  categories,
  transactions,
  type Transaction,
} from "@/lib/db/schema";
import type { TxFilters } from "./transactions.filters";

export type { TxFilters };
export { normaliseFilters } from "./transactions.filters";

export type TxRow = Transaction & {
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string;
};

function where(userId: string, f: TxFilters) {
  return and(
    eq(transactions.userId, userId),
    f.from ? gte(transactions.date, f.from) : undefined,
    f.to ? lte(transactions.date, f.to) : undefined,
    f.accountId ? eq(transactions.accountId, f.accountId) : undefined,
    f.categoryId ? eq(transactions.categoryId, f.categoryId) : undefined,
    f.type ? eq(transactions.type, f.type) : undefined,
    f.q
      ? or(
          ilike(transactions.payee, `%${f.q}%`),
          ilike(transactions.note, `%${f.q}%`),
        )
      : undefined,
  );
}

export async function listTransactions(
  userId: string,
  f: TxFilters,
): Promise<{ rows: TxRow[]; total: number }> {
  const clause = where(userId, f);

  const rows = await db
    .select({
      tx: transactions,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(clause)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(transactions)
    .where(clause);

  return {
    rows: rows.map((r) => ({
      ...r.tx,
      categoryName: r.categoryName,
      categoryIcon: r.categoryIcon,
      accountName: r.accountName,
    })),
    total: Number(total),
  };
}

/** Month-to-date totals. Transfers are excluded: they move money, not earn or spend it. */
export async function monthTotals(
  userId: string,
  month: string, // "YYYY-MM"
): Promise<{ incomeMinor: number; expenseMinor: number }> {
  const from = `${month}-01`;
  const to = sql`(${from}::date + interval '1 month' - interval '1 day')::date`;

  const [row] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountMinor} else 0 end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountMinor} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, from),
        sql`${transactions.date} <= ${to}`,
      ),
    );

  return { incomeMinor: Number(row.income), expenseMinor: Number(row.expense) };
}

export async function spendByCategory(
  userId: string,
  month: string,
): Promise<{ categoryId: string | null; name: string; icon: string; spentMinor: number }[]> {
  const from = `${month}-01`;
  const to = sql`(${from}::date + interval '1 month' - interval '1 day')::date`;

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      name: sql<string>`coalesce(${categories.name}, 'Uncategorised')`,
      icon: sql<string>`coalesce(${categories.icon}, 'Circle')`,
      spent: sql<number>`sum(${transactions.amountMinor})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        sql`${transactions.date} <= ${to}`,
      ),
    )
    .groupBy(transactions.categoryId, categories.name, categories.icon)
    .orderBy(desc(sql`sum(${transactions.amountMinor})`));

  return rows.map((r) => ({ ...r, spentMinor: Number(r.spent) }));
}
```

- [ ] **Step 6: Implement the actions, including the two-row transfer**

`app/(app)/transactions/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { parseAmount, directionFor } from "@/lib/money";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const base = z.object({
  accountId: z.string().uuid("Choose an account"),
  amount: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  payee: z.string().trim().default(""),
  note: z.string().trim().default(""),
});

const txInput = base.extend({
  type: z.enum(["income", "expense"]),
  categoryId: z.string().uuid().optional().or(z.literal("")),
});

const transferInput = base.extend({
  toAccountId: z.string().uuid("Choose a destination account"),
});

async function assertOwnsAccount(userId: string, accountId: string) {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function createTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = txInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", parsed.error.flatten().fieldErrors);
  }
  const { accountId, amount, date, payee, note, type, categoryId } = parsed.data;

  const money = parseAmount(amount);
  if (!money.ok) return fail("Check the form", { amount: [money.error] });
  if (!(await assertOwnsAccount(user.id, accountId))) {
    return fail("Account not found");
  }

  await db.insert(transactions).values({
    userId: user.id,
    accountId,
    categoryId: categoryId ? categoryId : null,
    type,
    direction: directionFor(type),
    amountMinor: money.value,
    date,
    payee,
    note,
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  return ok();
}

/**
 * A transfer is two rows sharing a group id, written atomically: an outflow on
 * the source account and an inflow on the destination. Balances stay a plain
 * SUM; only the UI has to re-pair them.
 */
export async function createTransfer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = transferInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", parsed.error.flatten().fieldErrors);
  }
  const { accountId, toAccountId, amount, date, payee, note } = parsed.data;

  if (accountId === toAccountId) {
    return fail("Check the form", {
      toAccountId: ["Pick a different destination account"],
    });
  }
  const money = parseAmount(amount);
  if (!money.ok) return fail("Check the form", { amount: [money.error] });
  if (
    !(await assertOwnsAccount(user.id, accountId)) ||
    !(await assertOwnsAccount(user.id, toAccountId))
  ) {
    return fail("Account not found");
  }

  const transferGroupId = randomUUID();
  const shared = {
    userId: user.id,
    type: "transfer" as const,
    amountMinor: money.value,
    date,
    payee,
    note,
    transferGroupId,
    categoryId: null,
  };

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values([
      { ...shared, accountId, direction: -1 },
      { ...shared, accountId: toAccountId, direction: 1 },
    ]);
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return ok();
}

/** Deleting either half of a transfer deletes both. */
export async function deleteTransaction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const [row] = await db
    .select({ transferGroupId: transactions.transferGroupId })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .limit(1);

  if (!row) return fail("Transaction not found");

  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        row.transferGroupId
          ? eq(transactions.transferGroupId, row.transferGroupId)
          : eq(transactions.id, id),
      ),
    );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  return ok();
}
```

- [ ] **Step 7: Run the full unit suite**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add transaction queries and mutations with atomic transfers"
```

---

### Task 11: Transactions page — mobile list and desktop table

**Files:**
- Create: `app/(app)/transactions/page.tsx`, `app/(app)/transactions/transaction-form.tsx`, `app/(app)/transactions/transaction-list.tsx`, `app/(app)/transactions/transaction-table.tsx`, `app/(app)/transactions/filters.tsx`, `components/app-shell/add-fab.tsx`
- Test: `e2e/transactions.spec.ts`

**Interfaces:**
- Consumes: `listTransactions`, `normaliseFilters`, `createTransaction`, `createTransfer`, `deleteTransaction`, `listActiveAccounts`, `listCategories`, `formatAmount`, `ResponsiveDialog`, `CategoryIcon`.
- Produces: `<TransactionForm accounts categories />` — reused by the dashboard's add button in Task 13.

- [ ] **Step 1: Implement the transaction form**

`app/(app)/transactions/transaction-form.tsx`. The amount field must open a numeric keypad on mobile (`inputMode="decimal"`).

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import type { Account, Category } from "@/lib/db/schema";
import { createTransaction, createTransfer } from "./actions";

type Mode = "expense" | "income" | "transfer";

export function TransactionForm({
  accounts,
  categories,
  trigger,
}: {
  accounts: Account[];
  categories: Category[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("expense");

  const action = mode === "transfer" ? createTransfer : createTransaction;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      toast.success("Transaction saved");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const err = (k: string) =>
    state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const relevant = categories.filter((c) =>
    mode === "income" ? c.kind === "income" : c.kind === "expense",
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="New transaction"
      trigger={trigger}
    >
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="expense" className="flex-1">Expense</TabsTrigger>
          <TabsTrigger value="income" className="flex-1">Income</TabsTrigger>
          <TabsTrigger value="transfer" className="flex-1">Transfer</TabsTrigger>
        </TabsList>
      </Tabs>

      <form action={formAction} className="space-y-3 mt-4">
        {mode !== "transfer" && <input type="hidden" name="type" value={mode} />}

        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            className="h-11 text-heading-sm tabular-nums"
            aria-invalid={Boolean(err("amount"))}
          />
          {err("amount") && (
            <p className="text-destructive text-caption">{err("amount")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="accountId">
            {mode === "transfer" ? "From account" : "Account"}
          </Label>
          <Select name="accountId" defaultValue={accounts[0]?.id}>
            <SelectTrigger id="accountId" className="h-11">
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === "transfer" ? (
          <div className="space-y-1.5">
            <Label htmlFor="toAccountId">To account</Label>
            <Select name="toAccountId" defaultValue={accounts[1]?.id}>
              <SelectTrigger id="toAccountId" className="h-11">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("toAccountId") && (
              <p className="text-destructive text-caption">{err("toAccountId")}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <Select name="categoryId" defaultValue={relevant[0]?.id}>
              <SelectTrigger id="categoryId" className="h-11">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {relevant.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={today} className="h-11" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payee">Payee</Label>
          <Input id="payee" name="payee" className="h-11" />
        </div>

        <Button type="submit" className="w-full h-11" disabled={pending}>
          {pending ? "Saving…" : "Save transaction"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}
```

- [ ] **Step 2: Implement the mobile list and the desktop table**

Both are rendered from the same data; only one is visible at a time, by CSS. That is deliberate: the two are different DOM shapes, not the same shape restyled, and neither is interactive enough to need a focus trap.

`app/(app)/transactions/transaction-list.tsx`:

```tsx
import { formatAmount } from "@/lib/money";
import { CategoryIcon } from "@/components/category-icon";
import type { TxRow } from "@/lib/queries/transactions";

export function TransactionList({
  rows,
  currency,
}: {
  rows: TxRow[];
  currency: string;
}) {
  const byDate = new Map<string, TxRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  return (
    <div className="md:hidden space-y-4">
      {[...byDate.entries()].map(([date, items]) => (
        <section key={date}>
          <h2 className="text-caption uppercase text-muted-foreground px-1 mb-2">
            {new Date(date).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </h2>
          <ul className="rounded-card bg-card border border-border shadow-card divide-y divide-border">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4 min-h-[56px]">
                <CategoryIcon name={t.categoryIcon ?? "Circle"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{t.payee || t.categoryName || "Transfer"}</p>
                  <p className="text-caption text-muted-foreground truncate">
                    {t.accountName}
                  </p>
                </div>
                <span className="tabular-nums shrink-0">
                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                  {formatAmount(t.amountMinor, currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

`app/(app)/transactions/transaction-table.tsx`:

```tsx
import { formatAmount } from "@/lib/money";
import { CategoryIcon } from "@/components/category-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TxRow } from "@/lib/queries/transactions";

export function TransactionTable({
  rows,
  currency,
}: {
  rows: TxRow[];
  currency: string;
}) {
  return (
    <div className="hidden md:block rounded-card bg-card border border-border shadow-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Payee</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="tabular-nums text-muted-foreground">
                {t.date}
              </TableCell>
              <TableCell>{t.payee || "—"}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <CategoryIcon name={t.categoryIcon ?? "Circle"} />
                  {t.categoryName ?? (t.type === "transfer" ? "Transfer" : "Uncategorised")}
                </span>
              </TableCell>
              <TableCell>{t.accountName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                {formatAmount(t.amountMinor, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Implement the page and the mobile FAB**

`components/app-shell/add-fab.tsx`:

```tsx
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddFabTrigger() {
  return (
    <Button
      aria-label="Add transaction"
      className="md:hidden fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 size-14 rounded-full p-0 shadow-card"
    >
      <Plus className="size-6" strokeWidth={1.5} />
    </Button>
  );
}
```

`app/(app)/transactions/page.tsx`:

```tsx
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { listTransactions, normaliseFilters } from "@/lib/queries/transactions";
import { listActiveAccounts } from "@/lib/queries/accounts";
import { listCategories } from "@/lib/queries/categories";
import { AppHeader } from "@/components/app-shell/app-header";
import { AddFabTrigger } from "@/components/app-shell/add-fab";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { TransactionTable } from "./transaction-table";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const filters = normaliseFilters(await searchParams);
  const [{ rows, total }, accounts, categories] = await Promise.all([
    listTransactions(user.id, filters),
    listActiveAccounts(user.id),
    listCategories(user.id),
  ]);

  return (
    <>
      <AppHeader title="Transactions" />

      <div className="mb-5 hidden md:block">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          trigger={
            <Button>
              <Plus className="size-4" strokeWidth={1.5} />
              New transaction
            </Button>
          }
        />
      </div>

      <div className="md:hidden">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          trigger={<AddFabTrigger />}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          No transactions yet. Add your first one.
        </p>
      ) : (
        <>
          <TransactionList rows={rows} currency={user.baseCurrency} />
          <TransactionTable rows={rows} currency={user.baseCurrency} />
          <p className="text-caption text-muted-foreground mt-3">
            {total} transaction{total === 1 ? "" : "s"}
          </p>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 4: Write the e2e test**

`e2e/transactions.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signUp, addAccount } from "./helpers";

test("add an expense and see it in the list", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "500");

  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByLabel("Amount").fill("12.34");
  await page.getByLabel("Payee").fill("Corner Store");
  await page.getByRole("button", { name: "Save transaction" }).click();

  await expect(page.getByText("Corner Store")).toBeVisible();
  await expect(page.getByText("$12.34")).toBeVisible();
});

test("a transfer moves money between accounts and nets to zero", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "500");
  await addAccount(page, "Savings", "0");

  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByRole("tab", { name: "Transfer" }).click();
  await page.getByLabel("Amount").fill("100");
  await page.getByLabel("From account").click();
  await page.getByRole("option", { name: "Checking" }).click();
  await page.getByLabel("To account").click();
  await page.getByRole("option", { name: "Savings" }).click();
  await page.getByRole("button", { name: "Save transaction" }).click();

  await page.goto("/accounts");
  await expect(page.getByText("$400.00")).toBeVisible();
  await expect(page.getByText("$100.00")).toBeVisible();
});
```

Add to `e2e/helpers.ts`:

```ts
export async function addAccount(page: Page, name: string, opening: string) {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Opening balance").fill(opening);
  await page.getByRole("button", { name: "Add account" }).click();
  await page.getByText(name).waitFor();
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm run test:e2e -- e2e/transactions.spec.ts`
Expected: PASS on both projects. The transfer test is the proof that the two-row model keeps balances correct.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add transactions page with mobile list and desktop table"
```

---

### Task 12: Budget rollover module

**Files:**
- Create: `lib/budgets.ts`
- Test: `lib/budgets.test.ts`

**Interfaces:**
- Consumes: nothing. Pure.
- Produces: `monthKey(date: Date | string): string`, `addMonths(month: string, n: number): string`, `monthRange(from: string, to: string): string[]`, `foldRollover(budgets: BudgetRow[], spend: SpendRow[], months: string[]): MonthState[]`, and the types `BudgetRow`, `SpendRow`, `MonthState`. Task 13 calls `foldRollover` from the budgets page.

- [ ] **Step 1: Write the failing tests**

`lib/budgets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { monthKey, addMonths, monthRange, foldRollover } from "./budgets";

describe("month helpers", () => {
  it("derives a month key from a date string", () => {
    expect(monthKey("2026-03-17")).toBe("2026-03");
  });

  it("adds months across a year boundary", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("builds an inclusive contiguous range", () => {
    expect(monthRange("2025-12", "2026-02")).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns a single month when from equals to", () => {
    expect(monthRange("2026-02", "2026-02")).toEqual(["2026-02"]);
  });
});

describe("foldRollover", () => {
  const months = monthRange("2026-01", "2026-04");

  it("without rollover, each month stands alone", () => {
    const result = foldRollover(
      months.map((month) => ({ month, amountMinor: 10000, rollover: false })),
      [{ month: "2026-01", spentMinor: 4000 }],
      months,
    );
    expect(result[0]).toMatchObject({ carryMinor: 0, remainingMinor: 6000 });
    expect(result[1]).toMatchObject({ carryMinor: 0, remainingMinor: 10000 });
  });

  it("with rollover, unspent budget carries forward", () => {
    const result = foldRollover(
      months.map((month) => ({ month, amountMinor: 10000, rollover: true })),
      [{ month: "2026-01", spentMinor: 4000 }],
      months,
    );
    expect(result[1]).toMatchObject({
      carryMinor: 6000,
      availableMinor: 16000,
      remainingMinor: 16000,
    });
  });

  it("with rollover, overspend eats into the next month", () => {
    const result = foldRollover(
      months.map((month) => ({ month, amountMinor: 10000, rollover: true })),
      [{ month: "2026-01", spentMinor: 13000 }],
      months,
    );
    expect(result[0].remainingMinor).toBe(-3000);
    expect(result[1]).toMatchObject({ carryMinor: -3000, availableMinor: 7000 });
  });

  it("carries across a month that has no budget row", () => {
    const result = foldRollover(
      [
        { month: "2026-01", amountMinor: 10000, rollover: true },
        { month: "2026-03", amountMinor: 10000, rollover: true },
      ],
      [],
      months,
    );
    // Jan leaves 10000; Feb has no row so it neither budgets nor carries…
    expect(result[1]).toMatchObject({ budgetMinor: 0, carryMinor: 0, remainingMinor: 0 });
    // …and March starts from February's remaining, not January's.
    expect(result[2]).toMatchObject({ budgetMinor: 10000, carryMinor: 0 });
  });

  it("stops carrying the month rollover is switched off", () => {
    const result = foldRollover(
      [
        { month: "2026-01", amountMinor: 10000, rollover: true },
        { month: "2026-02", amountMinor: 10000, rollover: false },
      ],
      [{ month: "2026-01", spentMinor: 0 }],
      monthRange("2026-01", "2026-02"),
    );
    expect(result[1]).toMatchObject({ carryMinor: 0, availableMinor: 10000 });
  });

  it("treats a month with no spend as zero spent", () => {
    const result = foldRollover(
      [{ month: "2026-01", amountMinor: 5000, rollover: false }],
      [],
      ["2026-01"],
    );
    expect(result[0]).toMatchObject({ spentMinor: 0, remainingMinor: 5000 });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- lib/budgets.test.ts`
Expected: FAIL — cannot resolve `./budgets`.

- [ ] **Step 3: Implement `lib/budgets.ts`**

```ts
export interface BudgetRow {
  /** "YYYY-MM" */
  month: string;
  amountMinor: number;
  rollover: boolean;
}

export interface SpendRow {
  month: string;
  spentMinor: number;
}

export interface MonthState {
  month: string;
  budgetMinor: number;
  carryMinor: number;
  availableMinor: number;
  spentMinor: number;
  remainingMinor: number;
}

export function monthKey(date: Date | string): string {
  const iso = typeof date === "string" ? date : date.toISOString();
  return iso.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const mon = (total % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/**
 * Folds rollover forward across a contiguous month range for ONE category.
 *
 *   available(m) = budget(m) + carry(m)
 *   carry(m)     = rollover(m) ? remaining(m-1) : 0
 *   remaining(m) = available(m) - spent(m)
 *
 * `carry` is negative after an overspent month, so overspending eats into the
 * next month. Nothing is persisted: correcting an old transaction fixes every
 * later month automatically.
 */
export function foldRollover(
  budgets: BudgetRow[],
  spend: SpendRow[],
  months: string[],
): MonthState[] {
  const budgetByMonth = new Map(budgets.map((b) => [b.month, b]));
  const spentByMonth = new Map(spend.map((s) => [s.month, s.spentMinor]));

  let previousRemaining = 0;
  return months.map((month) => {
    const row = budgetByMonth.get(month);
    const budgetMinor = row?.amountMinor ?? 0;
    const carryMinor = row?.rollover ? previousRemaining : 0;
    const spentMinor = spentByMonth.get(month) ?? 0;
    const availableMinor = budgetMinor + carryMinor;
    const remainingMinor = availableMinor - spentMinor;

    previousRemaining = remainingMinor;
    return {
      month,
      budgetMinor,
      carryMinor,
      availableMinor,
      spentMinor,
      remainingMinor,
    };
  });
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- lib/budgets.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/budgets.ts lib/budgets.test.ts
git commit -m "feat: add budget rollover fold"
```

---

### Task 13: Budgets page and dashboard

**Files:**
- Create: `lib/queries/budgets.ts`, `app/(app)/budgets/page.tsx`, `app/(app)/budgets/actions.ts`, `app/(app)/budgets/budget-row.tsx`, `app/(app)/dashboard/page.tsx` (replace), `app/(app)/dashboard/spend-donut.tsx`, `components/month-switcher.tsx`, `components/stat-block.tsx`
- Test: `e2e/budgets.spec.ts`, `e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `foldRollover`, `monthKey`, `monthRange`, `addMonths`, `listCategories`, `monthTotals`, `spendByCategory`, `formatAmount`, `parseAmount`, `requireUser`.
- Produces: `getBudgetMonth(userId, month): Promise<CategoryBudget[]>` where `CategoryBudget = { categoryId: string; name: string; icon: string; budgetMinor: number; carryMinor: number; availableMinor: number; spentMinor: number; remainingMinor: number; rollover: boolean }`; the actions `setBudget`, `toggleRollover`, `copyLastMonth`; `<MonthSwitcher month={string} basePath={string} />`; `<StatBlock label value hint />`.

- [ ] **Step 1: Implement the budget query**

`lib/queries/budgets.ts`:

```ts
import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { budgets, categories, transactions } from "@/lib/db/schema";
import { foldRollover, monthRange, type BudgetRow, type SpendRow } from "@/lib/budgets";

export interface CategoryBudget {
  categoryId: string;
  name: string;
  icon: string;
  budgetMinor: number;
  carryMinor: number;
  availableMinor: number;
  spentMinor: number;
  remainingMinor: number;
  rollover: boolean;
}

/**
 * Reads every budget row and every month of spend for the user up to `month`,
 * then folds rollover forward per category. Reading history is what makes the
 * carry correct without storing it.
 */
export async function getBudgetMonth(
  userId: string,
  month: string, // "YYYY-MM"
): Promise<CategoryBudget[]> {
  const monthEnd = `${month}-01`;

  const [budgetRows, spendRows, categoryRows] = await Promise.all([
    db
      .select({
        categoryId: budgets.categoryId,
        month: sql<string>`to_char(${budgets.month}, 'YYYY-MM')`,
        amountMinor: budgets.amountMinor,
        rollover: budgets.rollover,
      })
      .from(budgets)
      .where(and(eq(budgets.userId, userId), lte(budgets.month, monthEnd))),
    db
      .select({
        categoryId: transactions.categoryId,
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        spentMinor: sql<number>`sum(${transactions.amountMinor})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          sql`to_char(${transactions.date}, 'YYYY-MM') <= ${month}`,
        ),
      )
      .groupBy(transactions.categoryId, sql`to_char(${transactions.date}, 'YYYY-MM')`),
    db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.kind, "expense")))
      .orderBy(asc(categories.name)),
  ]);

  const earliest =
    budgetRows.map((b) => b.month).sort()[0] ?? month;
  const months = monthRange(earliest <= month ? earliest : month, month);

  return categoryRows
    .filter((c) => !c.archivedAt)
    .map((category) => {
      const b: BudgetRow[] = budgetRows
        .filter((r) => r.categoryId === category.id)
        .map((r) => ({
          month: r.month,
          amountMinor: Number(r.amountMinor),
          rollover: r.rollover,
        }));
      const s: SpendRow[] = spendRows
        .filter((r) => r.categoryId === category.id)
        .map((r) => ({ month: r.month, spentMinor: Number(r.spentMinor) }));

      const state = foldRollover(b, s, months).at(-1)!;
      return {
        categoryId: category.id,
        name: category.name,
        icon: category.icon,
        rollover: b.find((r) => r.month === month)?.rollover ?? false,
        ...state,
      };
    });
}
```

- [ ] **Step 2: Implement the budget actions**

`app/(app)/budgets/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { budgets, categories } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { parseAmount } from "@/lib/money";
import { addMonths } from "@/lib/budgets";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const setBudgetInput = z.object({
  categoryId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.string(),
  rollover: z.enum(["on", "off"]).default("off"),
});

async function ownsCategory(userId: string, categoryId: string) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function setBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = setBudgetInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the amount");

  const { categoryId, month, amount, rollover } = parsed.data;
  if (!(await ownsCategory(user.id, categoryId))) return fail("Category not found");

  const money = parseAmount(amount === "" ? "0" : amount);
  if (!money.ok) return fail(money.error);

  await db
    .insert(budgets)
    .values({
      userId: user.id,
      categoryId,
      month: `${month}-01`,
      amountMinor: money.value,
      rollover: rollover === "on",
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.month],
      set: { amountMinor: money.value, rollover: rollover === "on" },
    });

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return ok();
}

/** Seeds this month from the previous month's caps, leaving existing rows alone. */
export async function copyLastMonth(month: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month)) return fail("Bad month");
  const previous = addMonths(month, -1);

  await db.execute(sql`
    insert into budgets (user_id, category_id, month, amount_minor, rollover)
    select user_id, category_id, ${`${month}-01`}::date, amount_minor, rollover
    from budgets
    where user_id = ${user.id} and month = ${`${previous}-01`}::date
    on conflict (user_id, category_id, month) do nothing
  `);

  revalidatePath("/budgets");
  return ok();
}
```

- [ ] **Step 3: Implement the shared display components**

`components/stat-block.tsx` — typographic only, no card chrome, per `DESIGN.md`:

```tsx
export function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-caption uppercase text-muted-foreground">{label}</p>
      <p className="text-heading-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground">{hint}</p>}
    </div>
  );
}
```

`components/month-switcher.tsx`:

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths } from "@/lib/budgets";
import { Button } from "@/components/ui/button";

export function MonthSwitcher({
  month,
  basePath,
}: {
  month: string;
  basePath: string;
}) {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label="Previous month">
        <Link href={`${basePath}?month=${addMonths(month, -1)}`}>
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </Link>
      </Button>
      <span className="min-w-40 text-center">{label}</span>
      <Button asChild variant="ghost" size="icon" aria-label="Next month">
        <Link href={`${basePath}?month=${addMonths(month, 1)}`}>
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Implement the budgets page**

`app/(app)/budgets/budget-row.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "@/components/category-icon";
import { formatAmount } from "@/lib/money";
import { setBudget } from "./actions";
import type { CategoryBudget } from "@/lib/queries/budgets";

export function BudgetRow({
  row,
  month,
  currency,
}: {
  row: CategoryBudget;
  month: string;
  currency: string;
}) {
  const [pending, setPending] = useState(false);

  async function save(amount: string, rollover: boolean) {
    setPending(true);
    const form = new FormData();
    form.set("categoryId", row.categoryId);
    form.set("month", month);
    form.set("amount", amount);
    form.set("rollover", rollover ? "on" : "off");
    const result = await setBudget(form);
    setPending(false);
    if (!result.ok) toast.error(result.error);
  }

  const over = row.remainingMinor < 0;
  const pct =
    row.availableMinor > 0
      ? Math.min(100, (row.spentMinor / row.availableMinor) * 100)
      : row.spentMinor > 0
        ? 100
        : 0;

  return (
    <li className="p-4 space-y-2">
      <div className="flex items-center gap-3">
        <CategoryIcon name={row.icon} />
        <span className="flex-1 min-w-0 truncate">{row.name}</span>
        <Input
          aria-label={`${row.name} budget`}
          defaultValue={row.budgetMinor ? (row.budgetMinor / 100).toFixed(2) : ""}
          placeholder="0.00"
          inputMode="decimal"
          disabled={pending}
          onBlur={(e) => save(e.target.value, row.rollover)}
          className="h-11 w-28 text-right tabular-nums"
        />
      </div>

      <div className="h-1.5 rounded-pill bg-muted overflow-hidden">
        <div
          className={over ? "h-full bg-destructive" : "h-full bg-foreground"}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <span className={over ? "text-destructive" : undefined}>
          {formatAmount(row.spentMinor, currency)} of{" "}
          {formatAmount(row.availableMinor, currency)}
          {row.carryMinor !== 0 &&
            ` (${row.carryMinor > 0 ? "+" : "−"}${formatAmount(Math.abs(row.carryMinor), currency)} carried)`}
        </span>
        <label className="flex items-center gap-2">
          Rollover
          <Switch
            checked={row.rollover}
            disabled={pending}
            onCheckedChange={(v) =>
              save((row.budgetMinor / 100).toFixed(2), v)
            }
          />
        </label>
      </div>
    </li>
  );
}
```

`app/(app)/budgets/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth/guard";
import { getBudgetMonth } from "@/lib/queries/budgets";
import { monthKey } from "@/lib/budgets";
import { AppHeader } from "@/components/app-shell/app-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { Button } from "@/components/ui/button";
import { BudgetRow } from "./budget-row";
import { copyLastMonth } from "./actions";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : monthKey(new Date());
  const rows = await getBudgetMonth(user.id, month);

  return (
    <>
      <AppHeader title="Budgets" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <MonthSwitcher month={month} basePath="/budgets" />
        <form action={copyLastMonth.bind(null, month)}>
          <Button variant="secondary" type="submit">
            Copy last month
          </Button>
        </form>
      </div>

      <ul className="rounded-card bg-card border border-border shadow-card divide-y divide-border">
        {rows.map((row) => (
          <BudgetRow
            key={row.categoryId}
            row={row}
            month={month}
            currency={user.baseCurrency}
          />
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 5: Implement the dashboard**

`app/(app)/dashboard/spend-donut.tsx`:

```tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatAmount } from "@/lib/money";

// Monochrome ramp: DESIGN.md forbids chromatic decoration.
const SHADES = ["#0a0a0a", "#3f3f3f", "#5c5c5c", "#737373", "#9a9a9a", "#c4c4c4"];

export function SpendDonut({
  data,
  currency,
}: {
  data: { name: string; spentMinor: number }[];
  currency: string;
}) {
  if (data.length === 0) {
    return <p className="text-muted-foreground">No spending this month.</p>;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="spentMinor"
            nameKey="name"
            innerRadius="60%"
            outerRadius="90%"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SHADES[i % SHADES.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => formatAmount(Number(v), currency)}
            contentStyle={{
              borderRadius: 18,
              border: "1px solid #e5e5e5",
              fontSize: 14,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Install Recharts: `npm install recharts`.

`app/(app)/dashboard/page.tsx` (replacing the Task 7 placeholder):

```tsx
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { monthTotals, spendByCategory, listTransactions, normaliseFilters } from "@/lib/queries/transactions";
import { getBudgetMonth } from "@/lib/queries/budgets";
import { listActiveAccounts } from "@/lib/queries/accounts";
import { listCategories } from "@/lib/queries/categories";
import { monthKey } from "@/lib/budgets";
import { formatAmount } from "@/lib/money";
import { AppHeader } from "@/components/app-shell/app-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { StatBlock } from "@/components/stat-block";
import { AddFabTrigger } from "@/components/app-shell/add-fab";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "../transactions/transaction-form";
import { TransactionList } from "../transactions/transaction-list";
import { TransactionTable } from "../transactions/transaction-table";
import { SpendDonut } from "./spend-donut";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : monthKey(new Date());
  const currency = user.baseCurrency;

  const [totals, byCategory, budgetRows, recent, accounts, categories] =
    await Promise.all([
      monthTotals(user.id, month),
      spendByCategory(user.id, month),
      getBudgetMonth(user.id, month),
      listTransactions(user.id, normaliseFilters({ pageSize: "10" })),
      listActiveAccounts(user.id),
      listCategories(user.id),
    ]);

  const net = totals.incomeMinor - totals.expenseMinor;
  const budgetRemaining = budgetRows.reduce((sum, r) => sum + r.remainingMinor, 0);

  return (
    <>
      <AppHeader title="Dashboard" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher month={month} basePath="/dashboard" />
        <div className="hidden md:block">
          <TransactionForm
            accounts={accounts}
            categories={categories}
            trigger={
              <Button>
                <Plus className="size-4" strokeWidth={1.5} />
                New transaction
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-4 mb-8">
        <StatBlock label="Income" value={formatAmount(totals.incomeMinor, currency)} />
        <StatBlock label="Expense" value={formatAmount(totals.expenseMinor, currency)} />
        <StatBlock label="Net" value={formatAmount(net, currency)} />
        <StatBlock
          label="Budget left"
          value={formatAmount(budgetRemaining, currency)}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 mb-8">
        <Card>
          <CardContent className="p-5">
            <p className="text-caption uppercase text-muted-foreground mb-3">
              Spend by category
            </p>
            <SpendDonut data={byCategory} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-caption uppercase text-muted-foreground mb-3">
              Budgets
            </p>
            <ul className="space-y-3">
              {budgetRows
                .filter((r) => r.availableMinor > 0 || r.spentMinor > 0)
                .slice(0, 6)
                .map((r) => {
                  const over = r.remainingMinor < 0;
                  const pct =
                    r.availableMinor > 0
                      ? Math.min(100, (r.spentMinor / r.availableMinor) * 100)
                      : 100;
                  return (
                    <li key={r.categoryId}>
                      <div className="flex justify-between mb-1">
                        <span>{r.name}</span>
                        <span
                          className={
                            over ? "text-destructive tabular-nums" : "tabular-nums"
                          }
                        >
                          {formatAmount(r.remainingMinor, currency)} left
                        </span>
                      </div>
                      <div className="h-1.5 rounded-pill bg-muted overflow-hidden">
                        <div
                          className={over ? "h-full bg-destructive" : "h-full bg-foreground"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-subheading font-medium mb-3">Recent</h2>
      <TransactionList rows={recent.rows} currency={currency} />
      <TransactionTable rows={recent.rows} currency={currency} />

      <div className="md:hidden">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          trigger={<AddFabTrigger />}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 6: Write the e2e tests**

`e2e/budgets.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

test("setting a budget shows spend against it", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "40.00", "Market");

  await page.goto("/budgets");
  await page.getByLabel("Groceries budget").fill("100.00");
  await page.getByLabel("Groceries budget").blur();

  await expect(page.getByText("of $100.00")).toBeVisible();
});

test("overspending shows in the destructive colour", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "150.00", "Market");

  await page.goto("/budgets");
  await page.getByLabel("Groceries budget").fill("100.00");
  await page.getByLabel("Groceries budget").blur();

  const line = page.getByText("$150.00 of $100.00");
  await expect(line).toBeVisible();
  await expect(line).toHaveCSS("color", "rgb(231, 0, 11)");
});
```

`e2e/dashboard.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

test("the dashboard reflects a new expense without a reload", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "25.00", "Coffee");

  await page.goto("/dashboard");
  await expect(page.getByText("Expense")).toBeVisible();
  await expect(page.getByText("$25.00").first()).toBeVisible();
  await expect(page.getByText("Coffee")).toBeVisible();
});
```

Add to `e2e/helpers.ts`:

```ts
export async function addExpense(page: Page, amount: string, payee: string) {
  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Payee").fill(payee);
  await page.getByRole("button", { name: "Save transaction" }).click();
  await page.getByText(payee).waitFor();
}
```

- [ ] **Step 7: Run everything**

```bash
npm test
npm run test:e2e
npm run build
```

Expected: all unit tests pass, all e2e specs pass on both projects, and the production build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add budgets page and month dashboard"
```

---

### Task 14: Transaction editing, filters, sorting, pagination, and archiving

The spec asks for more of the transactions page than Task 11 delivered, and for archive controls the actions already support. This task closes those gaps.

**Files:**
- Modify: `lib/queries/transactions.filters.ts`, `lib/queries/transactions.ts`, `app/(app)/transactions/actions.ts`, `app/(app)/transactions/page.tsx`, `app/(app)/transactions/transaction-table.tsx`, `app/(app)/transactions/transaction-list.tsx`, `app/(app)/accounts/page.tsx`, `app/(app)/categories/page.tsx`
- Create: `app/(app)/transactions/filter-bar.tsx`, `app/(app)/transactions/pagination.tsx`, `app/(app)/transactions/row-actions.tsx`, `app/(app)/transactions/sort-header.tsx`, `app/(app)/transactions/selection-bar.tsx`, `components/archive-button.tsx`
- Test: `lib/queries/transactions.test.ts` (extend), `e2e/transactions-edit.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 8–11.
- Produces: `TxFilters` gains `sort: "date" | "amount" | "payee"` and `dir: "asc" | "desc"`; the actions `updateTransaction`, `deleteTransactions(ids: string[])`; `<FilterBar accounts categories filters />`, `<Pagination page pageSize total />`, `<ArchiveButton label onArchive />`.

- [ ] **Step 1: Extend the filter tests**

Append to `lib/queries/transactions.test.ts`:

```ts
describe("normaliseFilters — sorting", () => {
  it("defaults to newest first", () => {
    expect(normaliseFilters({})).toMatchObject({ sort: "date", dir: "desc" });
  });

  it("accepts the sortable columns", () => {
    expect(normaliseFilters({ sort: "amount" }).sort).toBe("amount");
    expect(normaliseFilters({ sort: "payee" }).sort).toBe("payee");
  });

  it("falls back to date for an unknown column", () => {
    expect(normaliseFilters({ sort: "dropTable" }).sort).toBe("date");
  });

  it("falls back to desc for an unknown direction", () => {
    expect(normaliseFilters({ dir: "sideways" }).dir).toBe("desc");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- lib/queries/transactions.test.ts`
Expected: FAIL — `sort` and `dir` are undefined.

- [ ] **Step 3: Extend the filter module**

In `lib/queries/transactions.filters.ts`, add to the `TxFilters` interface:

```ts
  sort: "date" | "amount" | "payee";
  dir: "asc" | "desc";
```

and to the returned object in `normaliseFilters`:

```ts
    sort:
      input.sort === "amount" || input.sort === "payee" ? input.sort : "date",
    dir: input.dir === "asc" ? "asc" : "desc",
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- lib/queries/transactions.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Apply the sort in the query**

In `lib/queries/transactions.ts`, replace the fixed `.orderBy(...)` in `listTransactions` with:

```ts
  const column =
    f.sort === "amount"
      ? transactions.amountMinor
      : f.sort === "payee"
        ? transactions.payee
        : transactions.date;
  const order = f.dir === "asc" ? asc : desc;
```

declared above the query, then `.orderBy(order(column), desc(transactions.createdAt))`. Add `asc` to the `drizzle-orm` import.

- [ ] **Step 6: Add the edit and bulk-delete actions**

Append to `app/(app)/transactions/actions.ts`:

```ts
const updateInput = txInput.extend({ id: z.string().uuid() });

/**
 * Editing either half of a transfer edits both, so the pair can never drift
 * apart in amount or date.
 */
export async function updateTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", parsed.error.flatten().fieldErrors);
  }
  const { id, accountId, amount, date, payee, note, type, categoryId } = parsed.data;

  const money = parseAmount(amount);
  if (!money.ok) return fail("Check the form", { amount: [money.error] });

  const [existing] = await db
    .select({
      id: transactions.id,
      transferGroupId: transactions.transferGroupId,
    })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .limit(1);
  if (!existing) return fail("Transaction not found");

  if (existing.transferGroupId) {
    // Only the shared fields are editable on a transfer; the accounts and
    // directions belong to the pair, not to one row.
    await db
      .update(transactions)
      .set({ amountMinor: money.value, date, payee, note, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.transferGroupId, existing.transferGroupId),
        ),
      );
  } else {
    if (!(await assertOwnsAccount(user.id, accountId))) {
      return fail("Account not found");
    }
    await db
      .update(transactions)
      .set({
        accountId,
        categoryId: categoryId ? categoryId : null,
        type,
        direction: directionFor(type),
        amountMinor: money.value,
        date,
        payee,
        note,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  return ok();
}

/** Deletes the given rows, pulling in the other half of any transfer. */
export async function deleteTransactions(ids: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return fail("Nothing selected");

  const rows = await db
    .select({
      id: transactions.id,
      transferGroupId: transactions.transferGroupId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        inArray(transactions.id, parsed.data),
      ),
    );
  if (rows.length === 0) return fail("Transaction not found");

  const groups = rows
    .map((r) => r.transferGroupId)
    .filter((g): g is string => g !== null);

  await db.transaction(async (tx) => {
    await tx
      .delete(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          inArray(
            transactions.id,
            rows.map((r) => r.id),
          ),
        ),
      );
    if (groups.length > 0) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            inArray(transactions.transferGroupId, groups),
          ),
        );
    }
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  return ok();
}
```

Add `inArray` to the `drizzle-orm` import at the top of the file.

- [ ] **Step 7: Build the filter bar and pagination**

`app/(app)/transactions/filter-bar.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, Category } from "@/lib/db/schema";

const ANY = "__any";

export function FilterBar({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === "" || value === ANY) next.delete(key);
    else next.set(key, value);
    next.delete("page"); // a new filter always starts at page one
    router.push(`/transactions?${next.toString()}`);
  }

  const active = ["from", "to", "accountId", "categoryId", "type", "q"].some(
    (k) => params.get(k),
  );

  return (
    <div className="mb-5 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Payee or note"
          className="h-11"
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", e.currentTarget.value);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="date"
          defaultValue={params.get("from") ?? ""}
          className="h-11"
          onChange={(e) => set("from", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="date"
          defaultValue={params.get("to") ?? ""}
          className="h-11"
          onChange={(e) => set("to", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accountId">Account</Label>
        <Select
          value={params.get("accountId") ?? ANY}
          onValueChange={(v) => set("accountId", v)}
        >
          <SelectTrigger id="accountId" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <Select
          value={params.get("categoryId") ?? ANY}
          onValueChange={(v) => set("categoryId", v)}
        >
          <SelectTrigger id="categoryId" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="flex items-end">
          <Button
            variant="ghost"
            className="h-11"
            onClick={() => router.push("/transactions")}
          >
            <X className="size-4" strokeWidth={1.5} />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
```

`app/(app)/transactions/pagination.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage === 1) return null;

  function go(to: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(to));
    router.push(`/transactions?${next.toString()}`);
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button
        variant="outline"
        className="h-11"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} />
        Previous
      </Button>
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {lastPage}
      </span>
      <Button
        variant="outline"
        className="h-11"
        disabled={page >= lastPage}
        onClick={() => go(page + 1)}
      >
        Next
        <ChevronRight className="size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
```

- [ ] **Step 8: Add row actions, sortable headers, and selection**

`app/(app)/transactions/row-actions.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import type { Account, Category } from "@/lib/db/schema";
import type { TxRow } from "@/lib/queries/transactions";
import { updateTransaction, deleteTransactions } from "./actions";

export function RowActions({
  row,
  accounts,
  categories,
}: {
  row: TxRow;
  accounts: Account[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateTransaction, null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      toast.success("Transaction updated");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const isTransfer = row.transferGroupId !== null;
  const err = (k: string) =>
    state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;
  const relevant = categories.filter((c) =>
    row.type === "income" ? c.kind === "income" : c.kind === "expense",
  );
  const label = row.payee || row.categoryName || "transaction";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Actions for ${label}`}>
            <MoreHorizontal className="size-4" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            disabled={busy}
            onSelect={() =>
              startTransition(async () => {
                const res = await deleteTransactions([row.id]);
                if (res.ok) toast.success("Transaction deleted");
                else toast.error(res.error);
              })
            }
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit transaction"
        description={isTransfer ? "Transfers are edited as a pair." : undefined}
      >
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={row.id} />
          <input
            type="hidden"
            name="type"
            value={isTransfer ? "expense" : row.type}
          />

          <div className="space-y-1.5">
            <Label htmlFor={`amount-${row.id}`}>Amount</Label>
            <Input
              id={`amount-${row.id}`}
              name="amount"
              inputMode="decimal"
              defaultValue={(row.amountMinor / 100).toFixed(2)}
              className="h-11 tabular-nums"
              aria-invalid={Boolean(err("amount"))}
            />
            {err("amount") && (
              <p className="text-destructive text-caption">{err("amount")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`account-${row.id}`}>Account</Label>
            <Select
              name="accountId"
              defaultValue={row.accountId}
              disabled={isTransfer}
            >
              <SelectTrigger id={`account-${row.id}`} className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isTransfer && (
            <div className="space-y-1.5">
              <Label htmlFor={`category-${row.id}`}>Category</Label>
              <Select name="categoryId" defaultValue={row.categoryId ?? undefined}>
                <SelectTrigger id={`category-${row.id}`} className="h-11">
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  {relevant.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`date-${row.id}`}>Date</Label>
            <Input
              id={`date-${row.id}`}
              name="date"
              type="date"
              defaultValue={row.date}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`payee-${row.id}`}>Payee</Label>
            <Input
              id={`payee-${row.id}`}
              name="payee"
              defaultValue={row.payee}
              className="h-11"
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </ResponsiveDialog>
    </>
  );
}
```

Sortable headers, `app/(app)/transactions/sort-header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

export function SortHeader({
  column,
  children,
}: {
  column: "date" | "amount" | "payee";
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const active = (params.get("sort") ?? "date") === column;
  const dir = params.get("dir") === "asc" ? "asc" : "desc";

  const next = new URLSearchParams(params);
  next.set("sort", column);
  next.set("dir", active && dir === "desc" ? "asc" : "desc");
  next.delete("page");

  return (
    <Link
      href={`/transactions?${next.toString()}`}
      className="inline-flex items-center gap-1"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {children}
      {active &&
        (dir === "asc" ? (
          <ChevronUp className="size-3" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="size-3" strokeWidth={1.5} />
        ))}
    </Link>
  );
}
```

Selection bar, `app/(app)/transactions/selection-bar.tsx`:

```tsx
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
```

Then wire them in:

- `transaction-table.tsx` becomes a client component holding `const [selected, setSelected] = useState<Set<string>>(new Set())`. It renders `<SelectionBar selected={[...selected]} onCleared={() => setSelected(new Set())} />` above the table, a leading `TableHead`/`TableCell` checkbox column bound to that set, `<SortHeader column="date">Date</SortHeader>` (and `payee`, `amount`) in place of the plain header text, and a trailing `TableCell` holding `<RowActions row={t} accounts={accounts} categories={categories} />`. It takes `accounts` and `categories` as new props.
- `transaction-list.tsx` appends `<RowActions row={t} accounts={accounts} categories={categories} />` to each `li` and takes the same two new props. It gets no checkbox column: bulk selection is a desktop review task, and a checkbox would fight the tap-to-open target on a phone.
- `page.tsx` and `dashboard/page.tsx` pass `accounts` and `categories` to both components.

- [ ] **Step 9: Wire the page together**

In `app/(app)/transactions/page.tsx`, render `<FilterBar accounts={accounts} categories={categories} />` above the results and `<Pagination page={filters.page} pageSize={filters.pageSize} total={total} />` below them. Wrap the page body in `<Suspense>` — `useSearchParams` in `FilterBar` and `Pagination` requires it.

- [ ] **Step 10: Add archive controls**

`components/archive-button.tsx`:

```tsx
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
```

Archiving is not destructive — it hides a row from pickers and keeps its history — so it stays in the default ink, not `#e7000b`.

Render it on each account card in `app/(app)/accounts/page.tsx` and each category row in `app/(app)/categories/page.tsx`, passing `archiveAccount.bind(null, a.id)` and `archiveCategory.bind(null, c.id)`.

- [ ] **Step 11: Write the e2e test**

`e2e/transactions-edit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

test("edit a transaction's amount", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");

  await page.getByRole("button", { name: /Actions for Bakery|More/ }).first().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Amount").fill("15.00");
  await page.getByRole("button", { name: /Save/ }).click();

  await expect(page.getByText("$15.00")).toBeVisible();
  await expect(page.getByText("$10.00")).toBeHidden();
});

test("filter by search text", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  await addExpense(page, "20.00", "Hardware");

  await page.goto("/transactions");
  await page.getByLabel("Search").fill("Bakery");
  await page.getByLabel("Search").press("Enter");

  await expect(page.getByText("Bakery")).toBeVisible();
  await expect(page.getByText("Hardware")).toBeHidden();
});

test("deleting one half of a transfer deletes both", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "500");
  await addAccount(page, "Savings", "0");

  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByRole("tab", { name: "Transfer" }).click();
  await page.getByLabel("Amount").fill("100");
  await page.getByLabel("From account").click();
  await page.getByRole("option", { name: "Checking" }).click();
  await page.getByLabel("To account").click();
  await page.getByRole("option", { name: "Savings" }).click();
  await page.getByRole("button", { name: "Save transaction" }).click();

  await page.getByRole("button", { name: /Actions|More/ }).first().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("No transactions yet.")).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByText("$500.00")).toBeVisible();
});
```

- [ ] **Step 12: Run everything**

```bash
npm test
npm run test:e2e
npm run build
```

Expected: all green.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add transaction editing, filters, sorting, pagination, and archiving"
```

---

## Definition of done for this plan

- `npm test`, `npm run test:e2e`, and `npm run build` all pass.
- A new user can sign up with the code, gets seeded categories, adds accounts, records income, expense, and transfers, edits and deletes them, filters and sorts and pages the ledger, archives an account or category, sets budgets with rollover, and sees a correct month dashboard.
- On a phone viewport the bottom nav and FAB are present and the sidebar is not; on desktop the reverse, with the data table in place of the list.
- No emoji anywhere in the UI. No chromatic color except `#e7000b` on destructive and over-budget states.

Then proceed to `docs/superpowers/plans/2026-09-06-fianc-import-recurring-pwa.md`.

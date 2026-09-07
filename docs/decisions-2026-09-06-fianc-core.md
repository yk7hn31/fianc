# Decision record — feat/fianc-core

Every ruling made while executing `docs/superpowers/plans/2026-09-06-fianc-core.md`
across its 14 tasks, in the order they were made.

These were judgment calls taken on the user's behalf during autonomous execution:
conflicts between the plan and the spec, findings that contradicted the plan's own
code, severity disagreements with reviewers, and scope decisions. The spec
(`docs/superpowers/specs/2026-09-06-money-app-design.md`) was treated as the binding
authority throughout; the plan is its argument.

Each entry says what was decided, why, and — where it was recorded — what it costs
if the decision was wrong. Anything here can be reworked; this file exists so that
nothing was decided in secret.

Preserved from the execution ledger, which was deleted with the plan's scratch
workspace once the branch was green.

## Preflight rulings (made before Task 1, from the plan conflict scan)

CONFLICT-1 — T2's `@theme` block omits two type utilities that later tasks use.
T8 uses `text-body-lg`; T9, T13 and plan B use `text-subheading`. Neither is
defined in T2's `@theme`, so both would silently render at the default size.
Ruling: T2 also defines `--text-body-lg: 16px` / `1.5` and
`--text-subheading: 18px` / `1.56`. Both are in DESIGN.md's type scale, so
this restores the spec rather than inventing values. Cost if wrong: two
unused CSS custom properties.

CONFLICT-2 — T6 imports a module T9 creates.
`app/(auth)/actions.ts` (T6) calls `seedDefaultCategories` from
`@/lib/queries/categories`, which T9 creates. As written, T6 does not
typecheck or build. The spec requires seeding at first login, so the call is
correct and the ordering is what is wrong.
Ruling: T6 also creates `lib/queries/categories.data.ts`,
`lib/queries/categories.ts` and `lib/queries/categories.test.ts` — that is
T9's Steps 1-4, moved earlier. T9 then implements only the icon component,
actions, page and e2e (its Steps 5-7). Cost if wrong: T9's dispatch is
smaller than its brief describes; no code is lost either way.

## Task rulings

    Ruling: pin to Next 15 (`next@^15`, `eslint-config-next@^15`). The spec is
    the binding authority and names 15; every code block in both plans was
    written against Next 15 semantics, and Next 16's own generated AGENTS.md
    warns its APIs differ from what the model knows. Cost if wrong: the project
    starts one major behind, and upgrading later is a contained task — versus
    14 tasks of code written against the wrong major.
  - Ruling: delete the `AGENTS.md` / `CLAUDE.md` that Next 16 generated. They
    document Next 16 behaviour that will not apply after the downgrade, and
    they were never requested. Cost if wrong: they regenerate on a later `next
    dev` if we ever move to 16.
  - `.scaffold` rejected by npm (leading dot); `fianc-scaffold-tmp` used
    instead. Accepted — same result, plan text was wrong about the name.
  - `@types/node` bumped to ^26 for vitest 5 peer deps. Accepted.
  Ruling: [Important] vitest pinned to 3.2.7 only to keep the plan's
    `environmentMatchGlobs`, an option deprecated in 3.x and removed in 4.x+.
    The spec names Vitest with no version, so the plan's config shape is not
    spec-binding and loses to the spec's intent. Migrate to vitest 5 with a
    `test.projects` config (node project for lib/**, jsdom project for
    components/**). Paying this now costs one config file; paying it later
    means unpinning a test runner under 20 tasks of accumulated suites.
    Cost if wrong: if `projects` misbehaves we fall back to pinning vitest 3.
  Ruling: [Important] `@types/node` was bumped to ^26 to satisfy a peer dep
    that no longer exists after the vitest downgrade, and ^26 tracks the build
    sandbox's Node (v26.7.0), not any deploy target. Declare the target
    instead: `engines.node >= 22` and `@types/node@^22`. Types describing an
    older runtime floor fail closed — they hide APIs we should not use — where
    types ahead of the runtime fail open. Cost if wrong: a later task wanting a
    newer Node API gets a type error and we raise the floor deliberately.
  Ruling: [Minor] explicit top-level `vite` dep — keep. It is a documented
    dedupe pin; removing it re-splits the vite tree. Deferred, not fixed.
  Minors 4 and 5 (tsconfig array formatting, fix-round counting) — no action.
  Ruling: two reviewers stalled out reading review packages dominated by a
    100k-line package-lock.json diff. From here on, review packages exclude
    package-lock.json and carry only its --stat line; the lockfile is generated
    and reviewing it line-by-line buys nothing. Fix-round-2 package went from
    147KB to 2.6KB. Cost if wrong: a hand-edited lockfile would escape review —
    so any task that edits it by hand must say so in its report.
  Ruling: current `shadcn@4.21` generates a Base UI ("base-nova") style, not
    the Radix generation the plan assumed. ACCEPT. The spec names shadcn/ui,
    never Radix, so the underlying primitive library is not spec-binding. I
    verified compatibility with what later tasks need: dialog.tsx and drawer.tsx
    export exactly the names T7's ResponsiveDialog imports (Dialog/Drawer +
    Content/Header/Title/Description/Trigger), and `lib/utils.ts` re-exports
    `cn` from the `cn` package, so every later `import { cn } from "@/lib/utils"`
    resolves to one implementation. Cost if wrong: a later task hits a Base UI
    prop that differs from Radix and needs a small adaptation.
  Ruling: drop `vaul` from the follow-on plan. This generation's Drawer is
    Base UI native, so vaul would be a second drawer implementation for no gain.
    The spec named vaul as the how; a bottom drawer is the what. Cost if wrong:
    none — the component is already built and exported.
  Ruling: destructive button/badge renders as a red-tinted ghost, not a solid
    red fill. ACCEPT — DESIGN.md specifies destructive as "text or icon in
    #e7000b", so the ghost treatment is the design system, and `--color-
    destructive` is still defined for T13's solid over-budget bar.
  Ruling: [Important] both `formatAmount` and `parseAmount` hardcode a 2-digit
    minor unit (`/100`, `*100`). JPY has 0 and KWD has 3, so a non-USD base
    currency silently mis-scales by 10x-100x. This is reachable: the settings
    page in the follow-on plan accepts any Intl-valid currency code. The spec
    says money is stored in *minor units* without fixing the exponent at two,
    so the hardcode is the plan overreaching, and silent wrong output directly
    contradicts the spec's reject-ambiguity principle.
    Decision: derive the exponent from Intl in a shared helper. `formatAmount`
    keeps its signature (it already takes `currency`). `parseAmount` gains a
    second parameter `currency = "USD"`.
    Ripple: later tasks that call `parseAmount` in a server action must pass
    `user.baseCurrency` — accounts (T8), transactions (T10/T14), budgets (T13),
    and in the follow-on plan CSV import and recurring rules. Carried into
    those dispatches. Cost of doing it now: one extra argument at ~6 call sites
    that are not yet written. Cost of deferring: rewriting them later plus a
    data-corruption class of bug in between.
  Task 3: minor (deferred): `replace(/\s/g,"")` strips interior whitespace, so
    "1 234.56" parses rather than being rejected.
  Task 3: minor (deferred): the leading-prefix strip accepts any non-numeric
    run, so "USD 12.34" and "ABC12.34" parse; "+5" parses as 500.
  Task 3: safe-integer guard independently probed by the reviewer and holds.
  Supabase project or credentials exist and I cannot create them. Ruling: split
  the task. The implementer writes schema, client and drizzle config and stops
  short of `db:push`; the push and its verification are deferred until
  credentials exist. Task 5 (pure auth primitives) is also unblocked. Task 6
  onward genuinely needs a database for its e2e tests, so I am asking the user
  for credentials now rather than at Task 6. Cost if wrong: the schema goes
  unexecuted for two tasks, and a syntax error in it surfaces later than it
  would have.
  Ruling: user chose Neon over Supabase. Both are plain Postgres, so schema,
    queries and Drizzle are untouched; only connection wiring and comments
    change (pooled host contains -pooler rather than port 6543, TLS required,
    `prepare: false` still correct). Spec and both plans rewritten to Neon in
    commit 18581cc, so the spec stays the binding authority rather than naming
    a vendor we are not using. The no-RLS argument is unchanged and now stated
    without naming a vendor client library.
  NOTE: commit 18581cc is a controller docs commit sitting between Task 3 and
    Task 4's implementation commits. Task 4's review package must exclude
    docs/ so the reviewer sees only implementation.
  Task 4 agent stalled once (third stall this session) after writing the schema
    test; resumed from that point rather than restarting.
  Ruling: `neon link` writes DATABASE_URL and DATABASE_URL_UNPOOLED into
    .env.local, but drizzle.config.ts expects DIRECT_URL. Adopt Neon's names
    rather than ours: the CLI owns and rewrites that file on every link/deploy,
    so any alias we add is overwritten on the next run. drizzle.config.ts and
    .env.example change to DATABASE_URL_UNPOOLED. Cost if wrong: the variable
    name differs from the plan text in two files.
  Ruling: the stall was not diff size (182 lines) but probe volume — the brief
    asked for many `node -e` scripts. New brief is read-only judgement plus a
    single vitest command. Cost if wrong: claims are read-verified, not
    execution-verified, for a 30-line module the controller also read directly.
  Ruling: accept the finding, pin the params explicitly. Two users, no rate
    limiting, so raise memoryCost above the floor. Deferred until Task 6 commits
    — the Task 6 agent runs `git add -A` and would sweep an uncommitted edit
    into its commit. Cost if wrong: one extra commit touching one file.
  Reviewer's `--reporter=basic` failed with ERR_LOAD_URL; vitest 5 dropped that
    reporter name. Not a code defect. Judgement was read-based plus the existing
    46 assertions, which already cover every point probed.
      Ruling: wrap the cookie write, keep the DB update. The row is the real
      session record; the cookie expiry catches up on the next server action,
      which can write. Cost if wrong: a read-only-browsing user's cookie expires
      on the original 30-day mark instead of sliding.
  (b) Stale-cookie redirect loop, confirmed by the reviewer with curl (exit 47,
      six hops). Middleware sees presence only; requireUser sent the holder back
      to /login and middleware bounced it to /dashboard again.
      Ruling: reject the reviewer's fix (drop the middleware bounce) in favour of
      a /session/end Route Handler that DELETES the cookie, then redirects. The
      reviewer's version leaves the dead cookie in the browser; this clears it.
      Verified: settles at /login in one hop, cookie gone. Cost if wrong: one
      extra route and one extra redirect hop on a dead session.
  Also fixed: middleware matcher was a per-file denylist that would have
    redirected sw.js and everything under public/ to /login once the PWA task
    landed (now exempts /_next and any path with a file extension); unguarded
    throws in both server actions (23505 mapped to the pre-check's message);
    missing aria-describedby on errored fields and no aria-busy on the form;
    a rejected signup code wiping the correctly-typed name and email.
  Ruling: DESIGN.md line 192 specifies the focus treatment as a 1px #e5e5e5
    ring, which is exactly what makes it invisible (~1.2:1 on white, against
    WCAG 2.4.11's 3:1). Read as covering the 1px BORDER only — DESIGN.md says
    nothing about the 3px halo shadcn paints outside it — so --color-ring stays
    at hairline per spec and a new --color-focus-ring darkens only the halo.
    Verified by screenshot. Cost if wrong: a focus halo darker than a strict
    reading of DESIGN.md, on every input and button in the app.
  Ruling: reject the "e2e ships red" finding. The plan intends `login then
    logout` to fail until Task 7 adds the Sign out button, and the commit
    message says so. test.skip risks it never coming back. 3 pass, 1 fails.
  Ruling: keep the DEFAULT_CATEGORIES re-export the reviewer called dead. It is
    the module's intended public surface for Tasks 10/12/13.
  ROOT CAUSE of the withjimin incident: the plan's playwright.config.ts used
    port 3000 with reuseExistingServer: true, so the suite attached to another
    project's dev server; both agents then ran `pkill -f "next dev"` to clean
    up. Config now uses 3100 and starts its own server. Agents were killing a
    server they should never have been attached to.
  Reviewers created test users in the live Neon production branch via the real
    signup flow (probe+/loop+/refresh+/e2e+ addresses). Not deleted — surfaced
    to the user, since it is their database.
  Ruling: REJECT the reviewer's matchMedia-caching suggestion. Caching the
    MediaQueryList in a module map broke the hook's own test (the cache
    outlives a stubbed matchMedia) and buys one short query-string parse per
    route change. Reverted; the simple version stands. Cost if wrong: a
    negligible parse on a hot path.
  Reviewer's forward warning, carried into Task 8: ResponsiveDialog fully
    unmounts and remounts `children` when it swaps Dialog<->Drawer across
    768px, so any state inside a form it wraps is lost on a resize/rotation.
  Ruling: CategoryIcon looked up lucide's `icons` registry, which holds ~1800
    entries and cannot be tree-shaken — /categories was 328 kB First Load JS
    vs 193 kB for /accounts, on a mobile-first PWA, and CategoryIcon is headed
    for transactions, budgets and the dashboard. lib/category-icons.ts now
    names all sixteen as ordinary imports and owns both the lookup map and the
    picker's choices. Route is 196 kB. Cost if wrong: adding an icon means
    editing that map, so a seed entry naming an unshipped icon renders the
    fallback silently — covered by a new test (54 tests now).
  Ruling: `parsed.error.flatten()` becomes `z.flattenError(parsed.error)`.
    zod is ^4.5.4 and v4 moved flatten off the error instance. Cost if wrong:
    TypeError on every invalid submit, i.e. the error path is the broken path.
  Ruling: `parseAmount(amount)` becomes `parseAmount(amount, user.baseCurrency)`.
    Same ruling already applied in accounts. Cost if wrong: a zero-decimal
    currency parses at the USD exponent and every amount lands 100x off.
  Ruling: `z.string().uuid()` becomes `z.uuid()`. v4 moved the format checks to
    top-level. Cost if wrong: deprecation warning now, breakage on the next major.
  Ruling: categoryId gets an ownership check the plan omits. The plan validates
    account ownership but writes categoryId straight through, and the FK is
    global rather than per-user, so a crafted post attaches another user's
    category row to this user's transaction. Nothing leaks outward — the
    attacker supplies the id — but it cross-links two tenants' data, and the
    other user archiving that category then reaches into rows they cannot see.
    Every other write in this codebase scopes by userId; this one must too.
    Cost if wrong: cross-tenant FK references sitting in the ledger with no UI
    that can find or repair them.
  Ruling: add `revalidatePath("/accounts")` to create, transfer and delete. The
    plan revalidates /transactions, /dashboard and /budgets. But account
    balances are not stored — listAccountsWithBalance derives them from these
    very rows — so /accounts shows a stale balance after every single entry.
    Cost if wrong: the balance is wrong on screen until something else happens
    to bust the cache, which is the exact failure a money app cannot have.
  Ruling: the date field validates as a real date, not just the shape
    /^\d{4}-\d{2}-\d{2}$/. "2026-13-45" passes that regex and then Postgres
    rejects the insert. Cost if wrong: an uncaught driver error crosses the
    server-action boundary instead of landing in the date field.
  Ruling: wrap each db write in try/catch returning fail(), matching accounts
    and categories. The plan leaves them bare. Cost if wrong: a thrown driver
    error reaches the client as an opaque Next.js digest.
  Ruling: escape %, _ and \ in the `q` filter before it reaches ilike. The plan
    interpolates the user's text into `%${f.q}%` raw, so searching for "50%"
    matches every row. Cost if wrong: search silently returns wrong results,
    which reads as a data bug rather than a search bug.
  Ruling: transfer checks both account ids in one query rather than two
    sequential round trips.
  Ruling: kind/type agreement is NOT enforced — an "income" category on an
    expense row stays legal. The form filters by kind; hard-failing it here
    would block the legitimate recategorisation Task 14 has to allow.
    than erroring the page. Ruling: clamp page from above too. Cost if wrong:
    a 500 on the list page from a hand-edited URL.
  FAIL 2 accepted: isCalendarDate passes year 0000 — the Date round trip is
    happy, but Postgres has no year 0 and rejects `0000-01-01` outright. Two
    ways in: a from/to filter throws the list page, and createTransaction
    accepts the date, so the insert fails with a driver error and the user is
    told "Could not save the transaction. Try again." That is the exact
    outcome the calendar check was added to prevent. Ruling: reject year 0000.
    The upper bound is fine, \d{4} caps at 9999.
  FAIL 3 accepted, and the most valuable finding: the spec requires
    buildTxWhere be exported for testing; the implementation kept it private
    as `where`, and no test imports the query module at all. So the whole
    suite stays green with `eq(transactions.userId, userId)` deleted from the
    clause — every user would see every row — and equally green with the
    escapeLike call dropped, because escapeLike is only tested in isolation.
    The two things most worth covering are the two the suite cannot reach.
    Ruling: move the clause builder into lib/queries/transactions.where.ts
    (server-only on the query module is what blocks a node test from reaching
    it, the same reason escapeLike already lives in the filters module), name
    it buildTxWhere per the spec, re-export it from the query module, and test
    it by compiling to SQL so the tests fail if tenant scoping or the escaping
    is removed. Cost if wrong: the tenant boundary has no regression test at
    all, which is the one thing in this app that must not silently break.
  Also fixing, from the reviewer's notes: ownsAccounts([]) compiles to
    `user_id = $1 and false`, counts 0, and 0 === ids.length returns TRUE.
    Unreachable from today's two call sites, so not a live defect, but an
    ownership helper must fail closed. And monthTotals' JSDoc says
    "Month-to-date" while the range is the whole calendar month.
  Not acting on, deliberately: no length bound on payee/note/q (changes
    validation Task 11's form is not written against yet); no category-kind or
    archived-state check (already ruled at preflight); deleteTransaction not
    validating its id as a uuid (matches archiveAccount and archiveCategory
    exactly — established pattern, not new drift). Carried forward: the
    categories leftJoin in spendByCategory is not user-scoped, and ownsCategory
    on the write path is the only thing keeping another user's category name
    out of that breakdown — CSV import and recurring rules add write paths that
    must not bypass it.
  Reviewer confirmed by compiling the SQL: every query carries user_id = $1
    including the count, which needs no joins; the transfer is one INSERT of
    two rows with matching amount and group id and directions -1/+1;
    type="transfer" is rejected by createTransaction so no half-transfer can be
    forged; zod strips posted transferGroupId/direction/userId; the LIKE
    escaping was proved against real Postgres with raw-vs-escaped controls;
    count() carries mapWith(Number) so those conversions are redundant while
    the raw sql<number> sums have no mapper and theirs are load-bearing; and
    createTransfer omitting /budgets is correct because budget spend filters
    type = 'expense'.
  All five fixes landed. 83 tests (was 74): 6 buildTxWhere SQL-compilation
    tests, 1 page clamp, 2 year-0000. tsc, lint and build all clean.
  Controller verified the mutation proof rather than accepting the report:
    deleted eq(transactions.userId, userId) from buildTxWhere by hand, ran the
    suite, got "Tests 5 failed | 78 passed (83)" naming all five buildTxWhere
    cases, restored, back to 83. The tenant boundary now has a real regression
    test — before this round it had none, and the suite was green either way.
  Implementer chose MAX_PAGE = 1_000_000 over a bound derived from the
    arithmetic ceiling (~4.5e13), on the grounds that a limit justified by
    domain absurdity survives someone later raising the 200-row page-size cap.
    Accepted.
  Committed 73324ff.
  Ruling: the form uses components/form-field.tsx, not the hand-rolled
    Label/Input/error markup in the plan. The plan's error paragraphs carry no
    id and its inputs no aria-describedby — exactly the gap Task 8 fixed by
    extracting the shared component, and the accounts e2e asserts on
    #openingBalance-error and its aria-describedby. Cost if wrong: the
    regression lands in the biggest form in the app.
  Ruling: `trigger` is React.ReactElement, not ReactNode. ResponsiveDialog
    passes it to Base UI as render={trigger}, which needs a single element.
  Ruling: the category Select must reset when the mode tab changes. The plan
    leaves it uncontrolled with defaultValue={relevant[0]?.id}; switching
    expense to income swaps the option list but keeps the old value, and the
    action deliberately does not enforce kind agreement, so the row saves under
    a category of the wrong kind. Cost if wrong: silently miscategorised
    transactions, which the dashboard and budgets then report as fact.
  Ruling: dates render from local parts, not `new Date("2026-01-15")`. That
    parses as UTC midnight, so toLocaleDateString in any timezone west of UTC
    prints the 14th. Cost if wrong: every date heading off by one for half the
    world, on a page whose entire job is what happened when.
  Ruling: the date field's default is the local today, not
    new Date().toISOString().slice(0,10). Same UTC bug: after 4pm Pacific the
    form prefills tomorrow.
  Ruling: the page tells the user to create an account first when they have
    none. The plan renders the form regardless, so the account Select has no
    options and submitting only ever returns "Choose an account".
  Ruling: TransactionForm is rendered twice, desktop trigger and mobile FAB, as
    the plan has it. ResponsiveDialog only mounts its children when open, so
    the two forms never coexist in the DOM and the duplicate ids the plan's
    markup would otherwise produce cannot collide. Noted because it looks wrong
    at a glance and should not be "fixed" without re-checking that.
  Implementer returned. 83 unit tests unchanged, 30/30 e2e (was 20), tsc, lint
    and build clean, /transactions at 206 kB. Six deviations, all accepted:
  Base UI's Select resolves the CLOSED trigger's text from an `items` prop, not
    from the options, which have not mounted yet. Without it the trigger
    stringifies the raw value — so accounts and categories would have read as
    raw uuids on screen until the user opened the list. Added label maps.
    NOTE: account-form.tsx and category-form.tsx have the same bug already
    shipped, showing `checking` and `expense` instead of Checking and Expense.
    Confirmed structurally: components/ui/select.tsx passes no default items.
    Cosmetic there only because those values are lowercase words rather than
    uuids, which is why Tasks 8 and 9 missed it. Folding the one-line fix into
    the Task 11 fix round.
  The two conditional branches needed keys. They sit at the same position, so
    React reconciled the controlled category Select into the uncontrolled
    toAccountId Select; Base UI warned about the controlled-to-uncontrolled
    switch, the destination stayed empty, and every transfer failed with
    "Choose a destination account". Found with a throwaway debug spec, not by
    reading.
  The amount sign comes from `direction`, not `type`. The plan prints no sign
    for transfers, so both halves of one render identically and you cannot see
    which account lost the money.
  searchParams typed string | string[]. Under the plan's narrower type,
    ?q=a&q=b reaches q.trim() on an array and 500s the page.
  Date headings pin locale "en-US" to match formatAmount, rather than
    `undefined`, which in a server component means the SERVER's locale.
  Tabs: a tablist is not labelable, so FieldShell's <label for> cannot name it;
    aria-label="Type" carries the same word as the visible label.
  Ruling 7 held, and was verified rather than assumed: the spec asserts
    #amount has count 0 before opening and 1 after, on both projects. Base UI
    portals default to keepMounted:false, so the duplicate ids never coexist.
  filters.tsx not created: the plan lists it under Create but no step writes it
    and nothing imports it. The page already honours the query string through
    normaliseFilters, so Task 14 adds only the controls. Accepted.
  Test-helper bug worth remembering: the plan's addAccount ended with
    getByText(name).waitFor(), and getByText is case-insensitive substring —
    the still-open dialog's type trigger reads "checking", so it resolved
    instantly and the next goto aborted the server action mid-flight. Accounts
    silently never existed. Now waits on `main li` filtered by name.
  Pre-existing flake seen once, not caused by this task: auth.spec.ts:9 timed
    out at 5s on toHaveURL with the button still showing "Working…" — argon2id
    against a cold Neon compute under 5 workers. Passed alone and in two other
    full runs. Tighten in that spec, not here.
    checks signs either. Ruling: exact:true, scope each balance to its own
    account card, and assert the two legs carry OPPOSITE signs. Cost if wrong:
    the single test guarding the core money invariant cannot tell moved money
    from destroyed money — the worst possible false green in this app.
  FAIL 1 accepted: no test waits for the submit to settle, so all three write
    tests race the server action, revalidatePath and re-render against the 5s
    default expect timeout with no retries configured. The transfer test does
    two inserts in a db.transaction and loses first — 1 failed / 9 passed on
    the plan's own prescribed command, passing 3/3 in isolation. Ruling: wait
    for the dialog to close or the toast, not just for the list.
  FAIL 3 accepted: useActionState state is never cleared, so a rejected submit
    leaves its error on screen after switching mode AND after closing and
    reopening. Reviewer's output: a brand-new empty form opens with
    #amount-error present, aria-invalid true and aria-describedby set — a
    screen reader announces "Amount, invalid entry, use digits and up to 2
    decimals" before a keystroke. The reopen half is pre-existing in accounts
    and categories; the cross-mode half is new here. Fixing all three, since
    it is one pattern and this is where it was found.
  FAIL 4 accepted, blocking: DrawerContent is overflow-hidden with no scroll
    and the popup caps at calc(100dvh - 6rem). This form needs 562px, 100 more
    than the next tallest. At 412x600 and at 740x360 (a phone in landscape)
    the Save button sits below the clip with overflowY hidden — physically
    unreachable, no scroll to recover it. Even on an iPhone SE one field error
    leaves 2px of margin. Fix belongs in ResponsiveDialog, not this form.
  FAIL 5/6/7 accepted and reframed together. The footer prints a bare count
    with no pager (51 transactions over 50 rows), an out-of-range page renders
    "No transactions yet. Add your first one." because the branch reads
    rows.length rather than total, and a transfer counts as two because it is
    two rows. Ruling: the footer states what is shown out of what matches, the
    empty state branches on total, and the wording says entries rather than
    transactions — a transfer legitimately contributes one entry per account,
    which is what the list shows and what a bank statement does. The pager
    itself stays Task 14 as planned; what ships now must not lie.
  FAIL 8 accepted: TableCell is whitespace-nowrap and the payee cell has no
    width cap, so one 143-character payee pushes Category, Account and AMOUNT
    off screen into an inner scroller with no visible scrollbar on macOS. On a
    money app the amounts vanish with no cue. The mobile list truncates the
    same string correctly, so the two views disagree.
  FAIL 9 accepted: with one account, Transfer mode is a dead end — the
    destination list contains only the source, so every choice fails the
    same-account guard and blank fails too. Disable the tab below two accounts
    and say why, matching the care already spent on the zero-account state.
  FAIL 10a accepted: the mode tabs render 25px tall next to 44px fields, 56px
    nav items and 56px rows. The three-way switch that decides which action
    runs is the smallest tap target on the screen.
  FAIL 10b accepted: FieldShell emits <label for="mode"> pointing at a
    tablist div, which is not labelable — the for is inert and it is an HTML
    validity error. aria-label already gives the correct accessible name, so
    the outcome is not broken, but the visible text is a dangling label.
  FAIL 11 accepted: rounded-full on the FAB is dead — tailwind-merge does not
    know the project's custom rounded-pill so both survive and source order
    picks 18px. DESIGN.md mandates 18px, so the RENDERED result is the correct
    one; the defect is a class that reads as load-bearing and does nothing.
  FAIL 13 accepted: an uncategorised non-transfer renders the literal word
    "Transfer" in the mobile list, while the table correctly says
    "Uncategorised". Not reachable through today's form, but CSV import and
    recurring rules both produce exactly these rows.
  FAIL 12 DEFERRED to Task 14: deleteTransaction ships with no caller and no
    delete control anywhere, so a wrong amount cannot be corrected and the
    balance stays wrong permanently. Task 14 is editing, filters, sorting,
    pagination and archiving, and it is in this same branch. Recording it here
    so it cannot be lost: the branch must not finish with this outstanding.
  Reviewer cleared, with proof, several things that look wrong: signing off
    direction rather than type (better than the spec, which prints two
    unsigned amounts); overflow-hidden on the table wrapper (Table supplies
    its own overflow-x-auto inside); exactly one view at 767/768/769;
    keepMounted false so duplicate ids never coexist; the server-component FAB
    surviving Base UI's render clone; useActionState really dispatching the
    swapped action; and localToday plus the local-midnight day heading both
    avoiding the UTC off-by-one.
  All twelve fixes landed. 83 unit tests, 30/30 e2e on both projects, tsc,
    lint and build clean, /transactions still 206 kB.
  Controller verified the money-destruction mutation independently rather than
    accepting the report: wrote both transfer legs direction -1, ran the test,
    got "locator resolved to 2 elements" against the expected single −$100.00
    row. Restored, and the file on disk is correct.
  Controller slip worth recording: the immediate re-run after restoring came
    back RED, and I had piped the run through `tail -3`, so only three lines
    survived and the assertion was invisible. Nothing was listening on 3100
    between runs, so each run started a fresh server — but `.next` persists on
    disk across dev-server restarts, so a fresh server can still serve the
    previously compiled route. Same class as the invalid control experiment in
    the guard.ts round earlier in this branch: a file swapped under a build
    cache is not a clean experiment. Re-ran with full output (green, 16.7s),
    then rm -rf .next and ran the whole suite cold: 30/30. Lesson for the rest
    of the branch: never truncate the output of a run whose result you intend
    to reason about, and clear .next before any mutation experiment.
  Fixer's judgement calls, all accepted: the drawer fix went into
    ResponsiveDialog rather than vendored drawer.tsx and was extended to the
    desktop Dialog, which has the same unbounded-height trap on a short laptop
    window; the out-of-range message offers no link back to page 1 because an
    honest one must preserve the active filters, which is Task 14's pager work;
    the tabs also got rounded-pill, since DESIGN.md forbids other radii on
    interactive elements and a 50px control with the default radius would look
    wrong; and one more expense-test balance assertion was hardened, on the
    grounds that leaving one loose assertion beside the tightened ones invites
    the next person to copy the wrong one.
  useResettableActionState records the dismissed state OBJECT rather than
    flipping a flag: useActionState keeps the previous state for the whole
    pending window, so a flag would let the discarded errors flash back while
    the next save was in flight. Identity holds because ok() and fail() build a
    fresh object per call.
  New observation, not among the 13 and not fixed: the sonner error toast
    parks over the drawer's bottom-right corner on short viewports and can sit
    on top of the Save button, intercepting pointer events until it fades
    (topmost element at the button's centre measured as LI.cn-toast at
    412x600 during an error state). Toast placement, not drawer. Carry to
    Task 14 or a follow-up.
  Committed b271ac3.
  Ruling: accept it as written — a server component cannot know the viewer's
  timezone without a cookie round-trip the plan never builds, the MonthSwitcher
  makes a wrong default one click to correct, and the data-entry path that
  actually matters already uses the client-side localToday() from Task 11.
  Cost if wrong: a viewer in a timezone behind UTC, on the last evening of a
  month, lands on next month by default. Fix later by seeding the month from a
  timezone cookie. Checked and NOT a defect: the MonthSwitcher label passes
  timeZone: "UTC" alongside the UTC-midnight Date (brief line 231), so the
  label cannot slip to the previous month.
  Ruling: FIX the global fold window (lib/queries/budgets.ts:62-64), against
    the brief's verbatim code. The brief derives one month range from ALL of
    the user's budget rows and folds every category over it, so a category's
    carry depends on when the user first budgeted a DIFFERENT category — the
    reviewer's counterexample (delete an unrelated January Groceries row and
    Dining's June available flips from $50 to $100) is decisive. The spec's
    rollover is per category and the spec is the binding authority.
    Cost if wrong: spend on a category in months before that category was ever
    budgeted stops counting as carried debt. That is the intended reading.
  Ruling: FIX the unguarded writes. "Server actions return ActionResult; they
    never throw across the client boundary" is a Global Constraint, and every
    other actions file in the app already honours it. The brief omitting the
    try/catch does not license breaking a constraint the brief itself lists.
    Cost if wrong: none — this is strictly additive.
  Ruling: FIX the amount/rollover write race. Two upserts on the same
    (user, category, month) racing, with the switch handler sending the
    server-rendered amount rather than the typed one, silently reverts what
    the user just typed. Money reverting itself is not a defensible ship.
  Ruling: FIX the dashboard counting unbudgeted spend as overrun, but NOT with
    the reviewer's `availableMinor > 0` filter — that silently drops a category
    carrying real negative debt into the month. Filter instead on
    `budgetMinor !== 0 || carryMinor !== 0`, i.e. the category has a budget
    this month or a carry from a previous one. Same predicate for the bars.
    Cost if wrong: a category budgeted to exactly zero with zero carry drops
    out of "Budget left"; that row has nothing to report anyway.
  Ruling: FIX the 44px touch targets in MonthSwitcher. size-8 is 32px against a
    Global Constraint of >= 44px on a mobile-first page's primary navigation.
  Ruling: ACCEPT the missing `toggleRollover` action. The brief's Produces line
    names three actions but its own Step 2 code writes two, and the Switch
    routing through setBudget is the brief's real design. A third action would
    duplicate setBudget's upsert for no gain. The write race is fixed on its
    merits above, not by splitting the action.
  Ruling: the 11 Minors do NOT enter the fix loop (skill rule). Deferred to the
    final whole-branch review, listed below.
  Ruling: the reviewer graded the `note` reset Minor; I am PROMOTING it into
    the fix round. Every edit writes note: "" unconditionally, so editing a row
    silently destroys its note. No form writes notes today, but FilterBar
    already searches them and the follow-on plan's CSV import populates them.
    A one-line fix against silent data loss is worth the round it rides in on.
    Cost if wrong: none.
  Ruling on the plan-mandated archive finding — SPLIT it.
    FIX the inconsistency, which is a defect and not a product choice:
    listCategories filters archived rows so a category vanishes on archive,
    but listAccountsWithBalance has no archivedAt filter, so an archived
    account stays on the page unlabelled, still showing a live Archive button
    that silently re-stamps archivedAt. A user cannot tell which accounts are
    archived.
    FIX the missing confirmation on DELETE only — single-row and bulk. These
    permanently destroy financial records and a mis-tap is recoverable only by
    editing the database.
    DEFER the unarchive UI. Archive keeps the data; building the surface to
    reverse it is a new feature the plan never scoped, and there is a
    follow-on plan. Recorded here so it is not lost: the branch ships with no
    way to unarchive from the UI.
    Cost if wrong: one extra confirmation click on delete, and archived
    accounts drop out of a list where someone may have wanted them visible.
  Ruling: the 5 remaining Minors stay out of the loop per the skill rule, and
    go to the final whole-branch review. Listed below.
  Ruling: FIX the Critical. lib/budgets.ts:64 drops carry across any month with
    no budget row (`row?.rollover` is undefined, so carry is 0), and the spec
    says verbatim "Months with no budget row contribute budget = 0 but still
    carry" — one of its four stated success criteria. Skipping a month is the
    NORMAL case; a row only exists when the user types an amount. And
    lib/budgets.test.ts:63-76 codifies the bug: its title describes the spec,
    its assertions describe the defect, so the suite cannot catch it. This is
    the other half of the Task 13 fold-window defect — I fixed the per-user
    window and left the gap-month hole. Cost if wrong: none; the spec is
    explicit.
  Ruling: /settings 404 — REMOVE it from NAV_ITEMS rather than build the page.
    My Task 7 ruling accepted the 404 "until Tasks 8-14 create them" and no
    task ever did; nobody rechecked the premise, and it is 25% of the mobile
    tab bar. Building a settings page is new feature scope this plan never
    had. Cost if wrong: the follow-on plan must add both the page and the nav
    entry back.
  Ruling: 44px — fix the two actual violations (MonthSwitcher, and the h-7
    Sign out in app-header.tsx), do NOT change the Button primitive's default
    sizes as the reviewer recommends. Changing h-8 to h-11 globally repaints
    every button on the branch at the last possible moment. Cost if wrong: the
    constraint stays enforced by memory, which has now failed twice — so the
    fix wave adds a comment at the size variants recording the 44px floor.
  Ruling: Important #9 (e2e running against the live production Neon branch,
    and the unrevoked account-scoped API key) does NOT enter the fix wave.
    Both need the user's Neon account and create or destroy cloud resources
    that are not mine to touch. Surfaced to the user instead.
  Ruling: pull four Minors into the wave because the reviewer flagged them as
    fix-now and each is a one-liner with a security or correctness edge:
    spendByCategory's unscoped categories leftJoin, the login timing oracle,
    the duplicated /100 display divisor, and the out-of-range page dead end.
    The rest of the Minors ship.

export interface TxFilters {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense" | "transfer";
  q?: string;
  page: number;
  pageSize: number;
  sort: "date" | "amount" | "payee";
  dir: "asc" | "desc";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(["income", "expense", "transfer"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A ceiling on `page`, not a nicety. The list query offsets by
 * `(page - 1) * pageSize`, and `?page=20000000000000000000` makes that 1e21,
 * which `Number` stringifies as "1e+21" — Postgres rejects it as invalid
 * bigint syntax and the page throws instead of coming back empty. A million
 * pages is 200 million rows at the largest page size, orders of magnitude past
 * any personal ledger, and keeps the offset far inside safe-integer range.
 */
const MAX_PAGE = 1_000_000;

/**
 * The values `normaliseFilters` falls back to. Named, because
 * `filtersToQuery` below has to know which values are defaults in order to
 * leave them out of the URL, and two independent copies of "50" would drift.
 */
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_SORT: TxFilters["sort"] = "date";
const DEFAULT_DIR: TxFilters["dir"] = "desc";

/**
 * Whether a string is a date that actually exists on the calendar.
 *
 * The shape check alone is not enough, and neither is adding `Date.parse`:
 * both accept "2026-02-30", which `Date` silently rolls forward to 2 March.
 * A shape-only check also lets "2026-13-45" through to Postgres, which then
 * rejects the insert with a driver error instead of a field message. Only the
 * round trip — format, parse, reformat, compare — rejects a day its month
 * does not have.
 */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  // Year 0 survives the round trip below — JS is happy to have one — but
  // Postgres has no year 0 and rejects `date '0000-01-01'` outright, which
  // would surface as a driver error on the insert or a thrown list page. The
  // other end needs no guard: \d{4} already stops at 9999.
  if (value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/**
 * Escapes the characters LIKE/ILIKE treats as pattern syntax, so a search for
 * "50%" means the literal text and not "50 followed by anything". Postgres
 * uses backslash as the default LIKE escape character, so no ESCAPE clause is
 * needed — but the backslash itself must be doubled first, otherwise the
 * escapes added below would be escaped in turn and lose their meaning. This is
 * about matching, not injection: the pattern still travels as a bind
 * parameter.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The list query's OFFSET, in one place so the arithmetic that turns a page
 * number into a row offset is the same expression in the query and in its
 * test — `(page - 1) * pageSize` inlined separately in each would let the two
 * drift, and a wrong offset returns the wrong page silently rather than
 * erroring.
 */
export function pageOffset(f: Pick<TxFilters, "page" | "pageSize">): number {
  return (f.page - 1) * f.pageSize;
}

function date(v: unknown): string | undefined {
  return typeof v === "string" && isCalendarDate(v) ? v : undefined;
}

function uuid(v: unknown): string | undefined {
  return typeof v === "string" && UUID.test(v) ? v : undefined;
}

/**
 * Search params are attacker-controlled and arrive as strings, so every filter
 * is either recognised or dropped: an unusable value narrows nothing rather
 * than erroring the page. `q` is deliberately left verbatim here — the list
 * page echoes it back into the search box, and escaping is the query's job.
 */
export function normaliseFilters(
  input: Record<string, string | undefined>,
): TxFilters {
  let from = date(input.from);
  let to = date(input.to);
  if (from && to && from > to) [from, to] = [to, from];

  const page = Math.min(
    MAX_PAGE,
    Math.max(1, Number.parseInt(input.page ?? "1", 10) || 1),
  );
  const pageSize = Math.min(
    200,
    Math.max(
      1,
      Number.parseInt(input.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
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
    sort:
      input.sort === "amount" || input.sort === "payee"
        ? input.sort
        : DEFAULT_SORT,
    dir: input.dir === "asc" ? "asc" : DEFAULT_DIR,
  };
}

/**
 * Normalised filters back into a query string, deliberately without `page`.
 *
 * This is what lets "Back to page 1" keep the search, the date range and the
 * sort the user had set: an out-of-range `?page=` renders no rows and so no
 * pager, which left editing the URL by hand as the only way back. Rebuilt
 * from the normalised filters rather than echoed from the raw request, so
 * unrecognised or malformed params are dropped rather than carried forward,
 * and values equal to the defaults are omitted to keep the link short.
 *
 * Round-trips: `normaliseFilters` of this output is the input again, page
 * reset to 1. The test asserts exactly that.
 */
export function filtersToQuery(f: TxFilters): string {
  const params = new URLSearchParams();
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.accountId) params.set("accountId", f.accountId);
  if (f.categoryId) params.set("categoryId", f.categoryId);
  if (f.type) params.set("type", f.type);
  if (f.q) params.set("q", f.q);
  if (f.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(f.pageSize));
  }
  if (f.sort !== DEFAULT_SORT) params.set("sort", f.sort);
  if (f.dir !== DEFAULT_DIR) params.set("dir", f.dir);
  return params.toString();
}

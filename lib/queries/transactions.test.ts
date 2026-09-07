import { describe, it, expect } from "vitest";
import { PgDialect, QueryBuilder } from "drizzle-orm/pg-core";
import { transactions } from "@/lib/db/schema";
import {
  escapeLike,
  filtersToQuery,
  isCalendarDate,
  normaliseFilters,
  pageOffset,
  type TxFilters,
} from "./transactions.filters";
import { buildTxOrder, buildTxWhere } from "./transactions.where";

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
    expect(
      normaliseFilters({ from: "2026-01-01", to: "2026-01-31" }),
    ).toMatchObject({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("swaps a reversed range rather than returning nothing", () => {
    expect(
      normaliseFilters({ from: "2026-02-01", to: "2026-01-01" }),
    ).toMatchObject({
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

  it("drops a day that does not exist in its month", () => {
    expect(normaliseFilters({ from: "2026-02-30" }).from).toBeUndefined();
  });

  it("clamps an absurd page instead of letting it reach the offset", () => {
    // `?page=20000000000000000000` made the offset 1e21, which `Number`
    // stringifies as "1e+21"; Postgres rejects that as invalid bigint syntax
    // and the list page throws. A nonsense page must come back empty.
    const { page } = normaliseFilters({ page: "20000000000000000000" });
    expect(page).toBe(1_000_000);
    expect(Number.isSafeInteger((page - 1) * 200)).toBe(true);
    expect(String((page - 1) * 200)).not.toContain("e");
  });

  it("falls back to page 1 for junk rather than producing NaN", () => {
    expect(normaliseFilters({ page: "many" }).page).toBe(1);
    expect(normaliseFilters({ pageSize: "many" }).pageSize).toBe(50);
  });

  it("keeps a well-formed id and drops a malformed one", () => {
    const id = "1b0f3e3a-4d5c-4a1e-9c2b-8f6a7d5e4c3b";
    expect(normaliseFilters({ accountId: id }).accountId).toBe(id);
    expect(normaliseFilters({ accountId: "1; drop table" }).accountId).toBe(
      undefined,
    );
    expect(normaliseFilters({ categoryId: id }).categoryId).toBe(id);
    expect(normaliseFilters({ categoryId: "nope" }).categoryId).toBeUndefined();
  });

  it("leaves wildcards in the text query alone", () => {
    // The filter is echoed back into the search box, so it stays verbatim
    // here; escaping belongs to the query that builds the LIKE pattern.
    expect(normaliseFilters({ q: "50%" }).q).toBe("50%");
  });
});

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

describe("escapeLike", () => {
  it("leaves ordinary text untouched", () => {
    expect(escapeLike("coffee")).toBe("coffee");
  });

  it("escapes a percent so it matches a literal percent", () => {
    expect(escapeLike("50%")).toBe("50\\%");
  });

  it("escapes an underscore so it matches a literal underscore", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes a backslash exactly once", () => {
    // Backslash must be rewritten before the wildcards, or the escapes this
    // function adds would themselves get escaped again.
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("100\\%")).toBe("100\\\\\\%");
  });
});

describe("isCalendarDate", () => {
  it("accepts a real date", () => {
    expect(isCalendarDate("2026-01-31")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
  });

  it("rejects the wrong shape", () => {
    expect(isCalendarDate("2026-1-1")).toBe(false);
    expect(isCalendarDate("31/01/2026")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
  });

  it("rejects an out-of-range month or day", () => {
    expect(isCalendarDate("2026-13-45")).toBe(false);
    expect(isCalendarDate("2026-00-10")).toBe(false);
  });

  it("rejects a day that its month does not have", () => {
    // Date.parse rolls this forward to 2 March instead of failing, which is
    // why the shape check alone is not enough.
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-02-29")).toBe(false);
  });

  it("rejects year 0000, which the Date round trip accepts", () => {
    // Postgres has no year 0: `date '0000-01-01'` is out of range, so letting
    // it past here fails the insert with a driver error instead of a field
    // message. The Date round trip alone does not catch it.
    expect(new Date("0000-01-01T00:00:00Z").toISOString()).toContain(
      "0000-01-01",
    );
    expect(isCalendarDate("0000-01-01")).toBe(false);
    expect(isCalendarDate("0000-12-31")).toBe(false);
  });

  it("still accepts a very early year Postgres does have", () => {
    expect(isCalendarDate("0001-01-01")).toBe(true);
  });
});

describe("buildTxWhere", () => {
  const dialect = new PgDialect();
  const userId = "1b0f3e3a-4d5c-4a1e-9c2b-8f6a7d5e4c3b";
  const accountId = "2c1e4f4b-5e6d-4b2f-8d3c-9a7b6c5d4e3f";
  const categoryId = "3d2f5a5c-6f7e-4c3a-9e4d-0b8c7d6e5f4a";

  /**
   * The two things this clause exists to guarantee — that every query is
   * scoped to one user, and that a wildcard typed in the search box matches
   * itself — leave no trace in the value it returns, so asserting on the
   * clause object proves nothing. Compiling a query with it and reading the
   * SQL text and its bind parameters is what makes both observable without a
   * database.
   */
  function compile(f: Partial<TxFilters> = {}) {
    const query = new QueryBuilder()
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        buildTxWhere(userId, {
          page: 1,
          pageSize: 50,
          sort: "date",
          dir: "desc",
          ...f,
        }),
      );
    return dialect.sqlToQuery(query.getSQL());
  }

  it("scopes an unfiltered query to the calling user and nothing else", () => {
    const { sql, params } = compile();
    expect(sql).toBe(
      'select "id" from "transactions" where "transactions"."user_id" = $1',
    );
    expect(params).toEqual([userId]);
  });

  it("keeps the user scope when other filters are present", () => {
    const { sql, params } = compile({ type: "expense", q: "coffee" });
    expect(sql).toContain('where ("transactions"."user_id" = $1 and ');
    expect(params[0]).toBe(userId);
  });

  it("adds one clause per supplied filter, in bind order", () => {
    const { sql, params } = compile({
      from: "2026-01-01",
      to: "2026-01-31",
      accountId,
      categoryId,
      type: "expense",
    });
    expect(sql).toBe(
      'select "id" from "transactions" where ("transactions"."user_id" = $1 and ' +
        '"transactions"."date" >= $2 and "transactions"."date" <= $3 and ' +
        '"transactions"."account_id" = $4 and "transactions"."category_id" = $5 and ' +
        '"transactions"."type" = $6)',
    );
    expect(params).toEqual([
      userId,
      "2026-01-01",
      "2026-01-31",
      accountId,
      categoryId,
      "expense",
    ]);
  });

  it("searches payee and note with one pattern", () => {
    const { sql, params } = compile({ q: "coffee" });
    expect(sql).toContain(
      '("transactions"."payee" ilike $2 or "transactions"."note" ilike $3)',
    );
    expect(params.slice(1)).toEqual(["%coffee%", "%coffee%"]);
  });

  it("escapes LIKE syntax in the search text before wrapping it", () => {
    // "50%" must reach Postgres as a literal percent, or the search matches
    // every row starting "50" instead of the ones the user asked for.
    expect(compile({ q: "50%" }).params.slice(1)).toEqual([
      "%50\\%%",
      "%50\\%%",
    ]);
    expect(compile({ q: "cash_out" }).params[1]).toBe("%cash\\_out%");
    expect(compile({ q: "a\\b" }).params[1]).toBe("%a\\\\b%");
  });

  it("binds the search text rather than inlining it", () => {
    // Escaping here is about matching, not injection; the pattern still
    // travels as a parameter.
    const { sql, params } = compile({ q: "'; drop table transactions; --" });
    expect(sql).not.toContain("drop table");
    expect(params[1]).toBe("%'; drop table transactions; --%");
  });
});

describe("buildTxOrder", () => {
  const dialect = new PgDialect();

  /**
   * Same reasoning as buildTxWhere's own compile(): the column and direction
   * chosen leave no trace in a plain equality check, so the only way to pin
   * "amount picks amount_minor, not date" or "asc really emits asc" is to
   * compile a query with it and read the SQL text back.
   */
  function compileOrder(f: Partial<TxFilters> = {}) {
    const query = new QueryBuilder()
      .select({ id: transactions.id })
      .from(transactions)
      .orderBy(
        ...buildTxOrder({ page: 1, pageSize: 50, sort: "date", dir: "desc", ...f }),
      );
    return dialect.sqlToQuery(query.getSQL());
  }

  it("defaults to date, newest first, with createdAt as the tiebreaker", () => {
    const { sql } = compileOrder();
    expect(sql).toBe(
      'select "id" from "transactions" order by "transactions"."date" desc, "transactions"."created_at" desc',
    );
  });

  it("sorts by amount when asked", () => {
    const { sql } = compileOrder({ sort: "amount", dir: "asc" });
    expect(sql).toBe(
      'select "id" from "transactions" order by "transactions"."amount_minor" asc, "transactions"."created_at" desc',
    );
  });

  it("sorts by payee when asked", () => {
    const { sql } = compileOrder({ sort: "payee", dir: "desc" });
    expect(sql).toBe(
      'select "id" from "transactions" order by "transactions"."payee" desc, "transactions"."created_at" desc',
    );
  });

  it("keeps createdAt descending as the tiebreaker regardless of the primary direction", () => {
    const { sql } = compileOrder({ sort: "date", dir: "asc" });
    expect(sql).toBe(
      'select "id" from "transactions" order by "transactions"."date" asc, "transactions"."created_at" desc',
    );
  });
});

describe("pageOffset and pagination", () => {
  const dialect = new PgDialect();

  it("page 1 offsets by zero", () => {
    expect(pageOffset({ page: 1, pageSize: 50 })).toBe(0);
  });

  it("multiplies (page - 1) by pageSize", () => {
    expect(pageOffset({ page: 3, pageSize: 20 })).toBe(40);
    expect(pageOffset({ page: 2, pageSize: 1 })).toBe(1);
  });

  /**
   * `.limit`/`.offset` are the two clauses that actually decide which page a
   * user sees; swapping them, or feeding `page` where `pageSize` belongs,
   * still returns 200 OK with plausible-looking rows, so the only way to pin
   * the query itself (not just the arithmetic above) is the same
   * compile-and-read-SQL technique used for the WHERE and ORDER BY clauses.
   */
  function compilePage(page: number, pageSize: number) {
    const query = new QueryBuilder()
      .select({ id: transactions.id })
      .from(transactions)
      .limit(pageSize)
      .offset(pageOffset({ page, pageSize }));
    return dialect.sqlToQuery(query.getSQL());
  }

  it("limits to the page size on page 1", () => {
    // Drizzle omits the OFFSET clause entirely when it compiles to zero,
    // rather than emitting a no-op "offset $n" with 0 bound — page 1 is the
    // one case with no offset clause to read back at all.
    const { sql, params } = compilePage(1, 50);
    expect(sql).toBe('select "id" from "transactions" limit $1');
    expect(params).toEqual([50]);
  });

  it("offsets by whole pages for a later page", () => {
    const { params } = compilePage(3, 20);
    expect(params).toEqual([20, 40]);
  });
});

describe("filtersToQuery", () => {
  it("is empty when nothing is filtered", () => {
    expect(filtersToQuery(normaliseFilters({}))).toBe("");
  });

  it("never carries the page number — that is the whole point", () => {
    expect(filtersToQuery(normaliseFilters({ page: "97" }))).toBe("");
  });

  it("keeps every active filter", () => {
    const accountId = "11111111-2222-3333-4444-555555555555";
    const categoryId = "66666666-7777-8888-9999-aaaaaaaaaaaa";
    const query = filtersToQuery(
      normaliseFilters({
        page: "97",
        from: "2026-01-01",
        to: "2026-01-31",
        accountId,
        categoryId,
        type: "expense",
        q: "coffee",
        pageSize: "10",
        sort: "amount",
        dir: "asc",
      }),
    );
    const params = new URLSearchParams(query);
    expect(params.get("page")).toBeNull();
    expect(params.get("from")).toBe("2026-01-01");
    expect(params.get("to")).toBe("2026-01-31");
    expect(params.get("accountId")).toBe(accountId);
    expect(params.get("categoryId")).toBe(categoryId);
    expect(params.get("type")).toBe("expense");
    expect(params.get("q")).toBe("coffee");
    expect(params.get("pageSize")).toBe("10");
    expect(params.get("sort")).toBe("amount");
    expect(params.get("dir")).toBe("asc");
  });

  it("escapes a search term that would otherwise break the query string", () => {
    const query = filtersToQuery(normaliseFilters({ q: "50% & more?" }));
    expect(new URLSearchParams(query).get("q")).toBe("50% & more?");
  });

  it("drops values that are already the default", () => {
    const query = filtersToQuery(
      normaliseFilters({ pageSize: "50", sort: "date", dir: "desc" }),
    );
    expect(query).toBe("");
  });

  // The property the "Back to page 1" link depends on: following it must land
  // on the same filtered view, only at page one.
  it("round-trips through normaliseFilters with the page reset", () => {
    const filters = normaliseFilters({
      page: "97",
      from: "2026-01-01",
      to: "2026-01-31",
      accountId: "11111111-2222-3333-4444-555555555555",
      type: "income",
      q: "rent",
      pageSize: "10",
      sort: "payee",
      dir: "asc",
    });
    const back = normaliseFilters(
      Object.fromEntries(new URLSearchParams(filtersToQuery(filters))),
    );
    expect(back).toEqual({ ...filters, page: 1 });
  });
});

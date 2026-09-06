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

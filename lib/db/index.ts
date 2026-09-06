import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// `prepare: false` is required: Neon's pooled endpoint runs its connection
// pooler in transaction mode, which cannot hold prepared statements between
// queries.
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };

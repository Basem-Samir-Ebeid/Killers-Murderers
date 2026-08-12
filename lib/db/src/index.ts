import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set.");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ...(databaseUrl.includes(".neon.tech")
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";

// Applies pending migrations, then exits. The container runs this before the
// server, so a schema change pulled with the code is in place before anything
// reads it.
//
// drizzle-orm's own migrator rather than `drizzle-kit migrate`: same journal,
// same drizzle.__drizzle_migrations table, but it needs only drizzle-orm and
// pg, not the dev dependencies drizzle-kit pulls in.

import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
  });
  console.log("migrations applied");
} finally {
  await pool.end();
}

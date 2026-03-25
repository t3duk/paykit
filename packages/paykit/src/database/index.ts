import { fileURLToPath } from "node:url";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

import * as schema from "./schema";

export type PayKitDatabase = NodePgDatabase<typeof schema>;

const migrationsSchema = "public";
const migrationsTable = "paykit_migrations";

export async function createDatabase(database: Pool): Promise<PayKitDatabase> {
  return drizzle(database, { schema });
}

export async function migrateDatabase(database: Pool): Promise<void> {
  await migrate(drizzle(database, { schema }), {
    migrationsFolder: fileURLToPath(new URL("./postgres/migrations", import.meta.url)),
    migrationsSchema,
    migrationsTable,
  });
}

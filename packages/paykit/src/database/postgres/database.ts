import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import { schema } from "./schema";
import { syncPostgresSchema } from "./sync";

export type PayKitDatabase = NodePgDatabase<typeof schema>;

export async function createPostgresDatabase(pool: Pool): Promise<PayKitDatabase> {
  const db = drizzle(pool, { schema });
  await syncPostgresSchema(db);
  return db;
}

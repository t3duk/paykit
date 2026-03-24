import type { PayKitOptions } from "../../types/options";
import { migrateDatabase } from "../../database";

export async function runPayKitMigrations(config: { options: PayKitOptions }): Promise<void> {
  await migrateDatabase(config.options.database);
}

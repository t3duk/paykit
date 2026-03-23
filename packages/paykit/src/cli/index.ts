#!/usr/bin/env node

import { Command } from "commander";

import { migrateCommand } from "./commands/migrate";
import { syncProductsCommand } from "./commands/sync-products";

const program = new Command()
  .name("paykitjs")
  .description("CLI for PayKit")
  .addCommand(migrateCommand)
  .addCommand(syncProductsCommand);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n  error: ${message}\n`);
  process.exit(1);
}

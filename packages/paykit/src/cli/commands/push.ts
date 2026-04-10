import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";

import {
  checkStripe,
  createPool,
  formatProductDiffs,
  loadCliDeps,
  loadProductDiffs,
} from "../utils/shared";

async function pushAction(options: { config?: string; cwd: string; yes?: boolean }): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const s = p.spinner();

  s.start("Connecting");

  const deps = await loadCliDeps();

  deps.capture("cli_command", { command: "push" });

  const config = await deps.getPayKitConfig({ configPath: options.config, cwd });
  const database = createPool(deps, config.options.database);

  try {
    const connStr = deps.getConnectionString(database as never);
    const stripeResult = await checkStripe(deps, config.options.provider.secretKey);

    if (!stripeResult.account.ok) {
      s.stop("");
      p.log.error(`Stripe\n  ${picocolors.red("✖")} ${stripeResult.account.message}`);
      p.cancel("Push failed");
      process.exit(1);
    }

    s.stop("");
    p.log.info(
      `Connected\n` +
        `  Database ${picocolors.dim("·")} ${connStr}\n` +
        `  Stripe   ${picocolors.dim("·")} ${stripeResult.account.displayName} (${stripeResult.account.mode})`,
    );

    // 1. Apply pending migrations first — schema must exist before querying products
    s.start("Checking schema");
    const pendingMigrations = await deps.getPendingMigrationCount(database);

    if (pendingMigrations > 0) {
      s.message("Applying migrations");
      await deps.migrateDatabase(database);
      s.stop("");
      p.log.success(`Schema ${picocolors.dim("·")} migrated`);
    } else {
      s.stop("");
      p.log.step(`Schema ${picocolors.dim("·")} up to date`);
    }

    // 2. Dry-run product sync
    s.start("Checking products");
    const { ctx, diffs } = await loadProductDiffs(config, deps);

    const hasChanges = diffs.some((d) => d.action !== "unchanged");

    if (diffs.length > 0) {
      const planLines = formatProductDiffs(diffs, ctx.plans.plans, deps);
      s.stop("");
      p.log.step(`Product changes\n${planLines.join("\n")}`);
    } else {
      s.stop("");
    }

    if (!hasChanges && pendingMigrations === 0) {
      p.outro("Nothing to do");
      return;
    }

    // Confirmation prompt
    if (hasChanges && !options.yes) {
      const shouldContinue = await p.confirm({ message: "Sync products?" });
      if (p.isCancel(shouldContinue) || !shouldContinue) {
        p.cancel("Aborted");
        process.exit(0);
      }
    }

    // Execute product sync
    s.start("Syncing products");
    const results = await deps.syncProducts(ctx);
    const syncedCount = results.filter((r) => r.action !== "unchanged").length;
    if (syncedCount > 0) {
      s.stop("");
      p.log.success("Products synced");
    } else {
      s.stop("");
    }

    p.outro(
      `Done ${picocolors.dim("·")} ${String(results.length)} product${results.length === 1 ? "" : "s"} synced`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(message);
    p.cancel("Push failed");
    process.exit(1);
  } finally {
    await database.end();
  }
}

export const pushCommand = new Command("push")
  .description("Apply migrations and sync products to database and payment provider")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .option("-y, --yes", "skip confirmation prompt")
  .action(pushAction);

import { and, eq, sql } from "drizzle-orm";

import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import { invoice } from "../database/schema";
import type { ProviderInvoice } from "../providers/provider";
import type { NormalizedInvoice } from "../types/events";
import type { StoredInvoice } from "../types/models";

export async function upsertInvoiceRecord(
  database: PayKitDatabase,
  input: {
    customerId: string;
    providerId: string;
    subscriptionId?: string | null;
    invoice: ProviderInvoice | NormalizedInvoice;
  },
): Promise<StoredInvoice> {
  const now = new Date();
  const providerData = {
    invoiceId: input.invoice.providerInvoiceId,
  };

  const existing = await database.query.invoice.findFirst({
    where: and(
      eq(invoice.providerId, input.providerId),
      sql`${invoice.providerData}->>'invoiceId' = ${input.invoice.providerInvoiceId}`,
    ),
  });

  const values = {
    amount: input.invoice.totalAmount,
    currency: input.invoice.currency,
    customerId: input.customerId,
    description: null as string | null,
    hostedUrl: input.invoice.hostedUrl ?? null,
    periodEndAt: input.invoice.periodEndAt ?? null,
    periodStartAt: input.invoice.periodStartAt ?? null,
    providerData,
    providerId: input.providerId,
    status: input.invoice.status ?? "open",
    subscriptionId: input.subscriptionId ?? null,
    type: "subscription" as string,
    updatedAt: now,
  };

  if (existing) {
    const rows = await database
      .update(invoice)
      .set(values)
      .where(eq(invoice.id, existing.id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.INVOICE_UPSERT_FAILED);
    }
    return row;
  }

  const rows = await database
    .insert(invoice)
    .values({
      ...values,
      id: generateId("inv"),
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.INVOICE_UPSERT_FAILED);
  }
  return row;
}

import { and, eq, sql } from "drizzle-orm";

import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import { invoice } from "../database/schema";
import type { NormalizedPayment } from "../types/events";
import { findCustomerByProviderCustomerId } from "./customer-service";

export async function syncPaymentByProviderCustomer(
  database: PayKitDatabase,
  input: {
    payment: NormalizedPayment;
    providerCustomerId: string;
    providerId: string;
  },
): Promise<void> {
  const customerRow = await findCustomerByProviderCustomerId(database, {
    providerCustomerId: input.providerCustomerId,
    providerId: input.providerId,
  });
  if (!customerRow) {
    return;
  }

  const providerData = {
    paymentId: input.payment.providerPaymentId,
    methodId: input.payment.providerMethodId ?? null,
  };

  const existing = await database.query.invoice.findFirst({
    where: and(
      eq(invoice.providerId, input.providerId),
      sql`${invoice.providerData}->>'paymentId' = ${input.payment.providerPaymentId}`,
    ),
  });

  if (existing) {
    await database
      .update(invoice)
      .set({
        status: input.payment.status,
        amount: input.payment.amount,
        updatedAt: new Date(),
      })
      .where(eq(invoice.id, existing.id));
    return;
  }

  await database.insert(invoice).values({
    id: generateId("inv"),
    customerId: customerRow.id,
    type: "charge",
    status: input.payment.status,
    amount: input.payment.amount,
    currency: input.payment.currency,
    description: input.payment.description ?? null,
    providerId: input.providerId,
    providerData,
  });
}

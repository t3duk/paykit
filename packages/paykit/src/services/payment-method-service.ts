import { and, desc, eq, isNull } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import { paymentMethod } from "../database/postgres/schema";
import type { PaymentMethod } from "../types/models";
import { getCustomerById, upsertProviderCustomer } from "./customer-service";

export interface AttachPaymentMethodInput {
  providerId: string;
  customerId: string;
  returnURL: string;
}

export interface SetDefaultPaymentMethodInput {
  customerId: string;
  providerId: string;
  paymentMethodId: string;
}

export interface DetachPaymentMethodInput {
  customerId: string;
  providerId: string;
  id: string;
}

async function getProvider(ctx: PayKitContext, providerId: string) {
  const provider = ctx.providers.get(providerId);
  if (!provider) {
    throw new PayKitError("PROVIDER_NOT_FOUND");
  }
  return provider;
}

async function ensureCustomer(ctx: PayKitContext, customerId: string): Promise<void> {
  const customer = await getCustomerById(ctx.database, customerId);
  if (!customer) {
    throw new PayKitError("CUSTOMER_NOT_FOUND");
  }
}

export async function attachPaymentMethod(
  ctx: PayKitContext,
  input: AttachPaymentMethodInput,
): Promise<{ url: string }> {
  await ensureCustomer(ctx, input.customerId);
  const providerCustomer = await upsertProviderCustomer(ctx, {
    customerId: input.customerId,
    providerId: input.providerId,
  });
  const provider = await getProvider(ctx, input.providerId);
  return provider.attachPaymentMethod({
    providerCustomerId: providerCustomer.providerCustomerId,
    returnURL: input.returnURL,
  });
}

export async function listPaymentMethods(
  ctx: PayKitContext,
  input: { customerId: string; providerId: string },
): Promise<PaymentMethod[]> {
  await ensureCustomer(ctx, input.customerId);
  await getProvider(ctx, input.providerId);
  return ctx.database
    .select()
    .from(paymentMethod)
    .where(
      and(
        eq(paymentMethod.customerId, input.customerId),
        eq(paymentMethod.providerId, input.providerId),
        isNull(paymentMethod.deletedAt),
      ),
    )
    .orderBy(desc(paymentMethod.createdAt));
}

export async function setDefaultPaymentMethod(
  ctx: PayKitContext,
  input: SetDefaultPaymentMethodInput,
): Promise<void> {
  await ensureCustomer(ctx, input.customerId);

  const methods = await ctx.database
    .select()
    .from(paymentMethod)
    .where(
      and(
        eq(paymentMethod.customerId, input.customerId),
        eq(paymentMethod.providerId, input.providerId),
        isNull(paymentMethod.deletedAt),
      ),
    );

  const exists = methods.some((method) => method.id === input.paymentMethodId);
  if (!exists) {
    throw new PayKitError("PAYMENT_METHOD_NOT_FOUND");
  }

  await ctx.database.transaction(async (tx) => {
    await tx
      .update(paymentMethod)
      .set({
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentMethod.customerId, input.customerId),
          eq(paymentMethod.providerId, input.providerId),
          isNull(paymentMethod.deletedAt),
        ),
      );

    await tx
      .update(paymentMethod)
      .set({
        isDefault: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentMethod.id, input.paymentMethodId),
          eq(paymentMethod.customerId, input.customerId),
          eq(paymentMethod.providerId, input.providerId),
          isNull(paymentMethod.deletedAt),
        ),
      );
  });
}

export async function detachPaymentMethod(
  ctx: PayKitContext,
  input: DetachPaymentMethodInput,
): Promise<void> {
  await ensureCustomer(ctx, input.customerId);
  const existingPaymentMethod = await ctx.database.query.paymentMethod.findFirst({
    where: and(
      eq(paymentMethod.id, input.id),
      eq(paymentMethod.customerId, input.customerId),
      eq(paymentMethod.providerId, input.providerId),
      isNull(paymentMethod.deletedAt),
    ),
  });
  if (!existingPaymentMethod) {
    throw new PayKitError("PAYMENT_METHOD_NOT_FOUND");
  }

  const provider = await getProvider(ctx, input.providerId);

  await provider.detachPaymentMethod({
    providerMethodId: existingPaymentMethod.providerMethodId,
  });

  await ctx.database
    .update(paymentMethod)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      isDefault: false,
    })
    .where(eq(paymentMethod.id, existingPaymentMethod.id));
}

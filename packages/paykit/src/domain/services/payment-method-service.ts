import type { PayKitContext } from "../../core/context";
import { PayKitError } from "../../core/errors";
import type { Customer, PaymentMethod } from "../../types/models";

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
  const customer = await ctx.database.findOne<Customer>({
    model: "customer",
    where: { id: customerId, deletedAt: null },
  });
  if (!customer) {
    throw new PayKitError("CUSTOMER_NOT_FOUND");
  }
}

export async function attachPaymentMethod(
  ctx: PayKitContext,
  input: AttachPaymentMethodInput,
): Promise<{ url: string }> {
  await ensureCustomer(ctx, input.customerId);
  const provider = await getProvider(ctx, input.providerId);
  return provider.attachPaymentMethod({
    customerId: input.customerId,
    returnURL: input.returnURL,
  });
}

export async function listPaymentMethods(
  ctx: PayKitContext,
  input: { customerId: string; providerId: string },
): Promise<PaymentMethod[]> {
  await ensureCustomer(ctx, input.customerId);
  await getProvider(ctx, input.providerId);
  return ctx.database.findMany<PaymentMethod>({
    model: "paymentMethod",
    where: { customerId: input.customerId, providerId: input.providerId, deletedAt: null },
    sortBy: { field: "createdAt", direction: "desc" },
  });
}

export async function setDefaultPaymentMethod(
  ctx: PayKitContext,
  input: SetDefaultPaymentMethodInput,
): Promise<void> {
  await ensureCustomer(ctx, input.customerId);

  const methods = await ctx.database.findMany<PaymentMethod>({
    model: "paymentMethod",
    where: {
      customerId: input.customerId,
      providerId: input.providerId,
      deletedAt: null,
    },
  });

  const exists = methods.some((method) => method.id === input.paymentMethodId);
  if (!exists) {
    throw new PayKitError("PAYMENT_METHOD_NOT_FOUND");
  }

  for (const method of methods) {
    await ctx.database.update<PaymentMethod>({
      model: "paymentMethod",
      where: { id: method.id },
      data: {
        isDefault: method.id === input.paymentMethodId,
        updatedAt: new Date(),
      },
    });
  }
}

export async function detachPaymentMethod(
  ctx: PayKitContext,
  input: DetachPaymentMethodInput,
): Promise<void> {
  await ensureCustomer(ctx, input.customerId);
  const paymentMethod = await ctx.database.findOne<PaymentMethod>({
    model: "paymentMethod",
    where: {
      id: input.id,
      customerId: input.customerId,
      providerId: input.providerId,
      deletedAt: null,
    },
  });
  if (!paymentMethod) {
    throw new PayKitError("PAYMENT_METHOD_NOT_FOUND");
  }

  const provider = await getProvider(ctx, input.providerId);

  await provider.detachPaymentMethod({
    customerId: input.customerId,
    providerMethodId: paymentMethod.providerMethodId,
  });

  await ctx.database.update<PaymentMethod>({
    model: "paymentMethod",
    where: { id: paymentMethod.id },
    data: {
      deletedAt: new Date(),
      updatedAt: new Date(),
      isDefault: false,
    },
  });
}

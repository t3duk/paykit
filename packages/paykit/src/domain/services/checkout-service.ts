import type { PayKitContext } from "../../core/context";
import { PayKitError } from "../../core/errors";
import type { Customer } from "../../types/models";

export interface CreateCheckoutInput<TProviderId extends string = string> {
  providerId: TProviderId;
  customerId: string;
  amount: number;
  description: string;
  successURL: string;
  cancelURL?: string;
  attachMethod?: boolean;
  metadata?: Record<string, string>;
}

export async function createCheckout<TProviderId extends string>(
  ctx: PayKitContext<TProviderId>,
  input: CreateCheckoutInput<TProviderId>,
): Promise<{ url: string }> {
  const customer = await ctx.database.findOne<Customer>({
    model: "customer",
    where: { id: input.customerId, deletedAt: null },
  });

  if (!customer) {
    throw new PayKitError("CUSTOMER_NOT_FOUND");
  }

  const provider = ctx.providers.get(input.providerId);
  if (!provider) {
    throw new PayKitError("PROVIDER_NOT_FOUND");
  }

  const { providerId: _providerId, ...providerInput } = input;
  return provider.checkout(providerInput);
}

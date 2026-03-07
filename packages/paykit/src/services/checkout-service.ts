import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import { upsertProviderCustomer } from "./customer-service";

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
  const provider = ctx.providers.get(input.providerId);
  if (!provider) {
    throw new PayKitError("PROVIDER_NOT_FOUND");
  }

  const providerCustomer = await upsertProviderCustomer(ctx, {
    customerId: input.customerId,
    providerId: input.providerId,
  });

  const { providerId: _providerId, customerId: _customerId, ...providerInput } = input;
  return provider.checkout({
    ...providerInput,
    providerCustomerId: providerCustomer.providerCustomerId,
  });
}

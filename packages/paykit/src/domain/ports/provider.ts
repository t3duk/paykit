import type { NormalizedWebhookEvent } from "../../types/events";

export interface ProviderPaymentMethod {
  providerMethodId: string;
  type: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

export interface PayKitProvider<TId extends string = string> {
  id: TId;

  checkout(data: {
    customerId: string;
    amount: number;
    description: string;
    successURL: string;
    cancelURL?: string;
    attachMethod?: boolean;
    metadata?: Record<string, string>;
  }): Promise<{ url: string }>;

  attachPaymentMethod(data: { customerId: string; returnURL: string }): Promise<{ url: string }>;

  detachPaymentMethod(data: { customerId: string; providerMethodId: string }): Promise<void>;

  handleWebhook(data: {
    body: unknown;
    headers: Record<string, string>;
  }): Promise<NormalizedWebhookEvent | NormalizedWebhookEvent[]>;
}

export function defineProvider<const TId extends string>(
  provider: PayKitProvider<TId>,
): PayKitProvider<TId> {
  return provider;
}

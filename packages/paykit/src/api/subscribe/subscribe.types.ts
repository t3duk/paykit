import * as z from "zod";

import type { ProviderRequiredAction } from "../../providers/provider";
import type { StoredProductWithPrice } from "../../services/product-service";
import type { PayKitSubscribeResult } from "../../types/instance";
import type { StoredSubscription } from "../../types/models";
import type { NormalizedPlan } from "../../types/schema";

export const subscribeBodySchema = z.object({
  planId: z.string(),
  successUrl: z.url().optional(),
  cancelUrl: z.url().optional(),
  customerId: z.string().optional(),
  forceCheckout: z.boolean().optional(),
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;

export type SubscribeInput = Required<Pick<SubscribeBody, "customerId" | "successUrl">> &
  Omit<SubscribeBody, "customerId" | "successUrl">;

export type SubscribeResult = PayKitSubscribeResult;

export type ProviderInvoicePayload = {
  providerInvoiceId: string;
  currency: string;
  status: string | null;
  totalAmount: number;
  hostedUrl?: string | null;
  periodStartAt?: Date | null;
  periodEndAt?: Date | null;
};

export type SubscribeResultInput = {
  invoice?: ProviderInvoicePayload | null;
  paymentUrl: string | null;
  requiredAction?: ProviderRequiredAction | null;
};

export interface SubscriptionWithCatalog extends StoredSubscription {
  planId: string;
  planGroup: string;
  planIsDefault: boolean;
  planName: string;
  priceAmount: number | null;
  priceInterval: string | null;
  providerPriceId: string | null;
}

export interface SubscribeContext {
  activeSubscription: SubscriptionWithCatalog | null;
  cancelUrl: string | undefined;
  customerId: string;
  isFreeTarget: boolean;
  isPaidTarget: boolean;
  isUpgrade: boolean;
  normalizedPlan: NormalizedPlan;
  providerCustomerId: string;
  providerId: string;
  scheduledSubscriptions: readonly SubscriptionWithCatalog[];
  shouldUseCheckout: boolean;
  storedPlan: StoredProductWithPrice;
  successUrl: string;
}

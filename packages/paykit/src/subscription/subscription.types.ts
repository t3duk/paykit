import * as z from "zod";

import type { PayKitSubscribeResult } from "../types/instance";
import type { StoredSubscription } from "../types/models";

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

export interface SubscriptionWithCatalog extends StoredSubscription {
  planId: string;
  planGroup: string;
  planIsDefault: boolean;
  planName: string;
  priceAmount: number | null;
  priceInterval: string | null;
  providerPriceId: string | null;
}

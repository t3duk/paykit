import type { endpoints } from "../api";
import type { PayKitOptions } from "./options";

export interface PayKitInstance {
  options: PayKitOptions;
  handler: (request: Request) => Promise<Response>;
  api: typeof endpoints;
  checkout(input: {
    productId: string;
    successUrl: string;
    cancelUrl?: string;
    customerId?: string;
  }): Promise<{ url: string }>;
  handleWebhook(input: {
    body: string;
    headers: Record<string, string>;
  }): Promise<{ received: true }>;
  $context: Promise<unknown>;
}

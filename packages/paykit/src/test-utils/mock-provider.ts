import { generateId } from "../core/id";
import { defineProvider } from "../domain/ports/provider";
import type { NormalizedWebhookEvent } from "../types/events";

export function mockProvider() {
  return defineProvider({
    id: "mock",

    async checkout() {
      return { url: "https://example.com/checkout/mock" };
    },

    async attachPaymentMethod(data) {
      return { url: data.returnURL };
    },

    async detachPaymentMethod() {},

    async handleWebhook(data) {
      const event: NormalizedWebhookEvent = {
        name: "webhook.received",
        payload: {
          hasBody: data.body !== null,
          webhookId: generateId("evt"),
        },
      };
      return event;
    },
  });
}

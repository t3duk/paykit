import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import { deleteCustomerByReferenceId, syncCustomer } from "../domain/services/customer-service";
import type { NormalizedWebhookEvent, WebhookApplyAction } from "../types/events";

export interface HandleWebhookInput {
  providerId: string;
  body: unknown;
  headers: Record<string, string>;
}

async function applyAction(ctx: PayKitContext, action: WebhookApplyAction): Promise<void> {
  if (action.type === "customer.upsert") {
    await syncCustomer(ctx.database, action.data);
    return;
  }

  await deleteCustomerByReferenceId(ctx.database, action.data.referenceId);
}

async function emitEvent(ctx: PayKitContext, event: NormalizedWebhookEvent): Promise<void> {
  const named = ctx.eventHandlers[event.name];
  if (named) {
    await named({ name: event.name, payload: event.payload });
  }

  const catchAll = ctx.eventHandlers["*"];
  if (catchAll) {
    await catchAll({ name: event.name, payload: event.payload });
  }
}

export async function handleWebhook(
  ctx: PayKitContext,
  input: HandleWebhookInput,
): Promise<{ received: true }> {
  const provider = ctx.providers.get(input.providerId);
  if (!provider) {
    throw new PayKitError("INVALID_WEBHOOK_PROVIDER");
  }

  const normalized = await provider.handleWebhook({
    body: input.body,
    headers: input.headers,
  });

  const events = Array.isArray(normalized) ? normalized : [normalized];

  for (const event of events) {
    if (event.actions) {
      for (const action of event.actions) {
        await applyAction(ctx, action);
      }
    }
    await emitEvent(ctx, event);
  }

  return { received: true };
}

import { APIError } from "better-call";

import type { PayKitContext } from "../core/context";
import { syncCustomer } from "../services/customer-service";

export async function resolveCustomer(
  ctx: PayKitContext,
  request: Request | undefined,
  explicitCustomerId?: string,
): Promise<string> {
  if (explicitCustomerId) {
    return explicitCustomerId;
  }

  if (!ctx.options.client?.identify || !request) {
    throw new APIError("UNAUTHORIZED", {
      message: "No customerId provided and no identify configured",
    });
  }

  const identity = await ctx.options.client.identify(request);

  await syncCustomer(ctx.database, {
    id: identity.customerId,
    email: identity.email,
    name: identity.name,
  });

  return identity.customerId;
}

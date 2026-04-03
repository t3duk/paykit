import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { syncCustomerWithDefaults } from "../services/customer-service";

export async function resolveCustomer(
  ctx: PayKitContext,
  request: Request | undefined,
  explicitCustomerId?: string,
): Promise<string> {
  // When called from an HTTP context with identify configured, always resolve
  // the caller's identity. If an explicitCustomerId is also provided, verify
  // it matches — prevents IDOR where a caller passes another user's ID.
  if (ctx.options.identify && request) {
    const identity = await ctx.options.identify(request);

    if (explicitCustomerId && explicitCustomerId !== identity.customerId) {
      throw PayKitError.from("FORBIDDEN", PAYKIT_ERROR_CODES.CUSTOMER_ID_MISMATCH);
    }

    await syncCustomerWithDefaults(ctx, {
      id: identity.customerId,
      email: identity.email,
      name: identity.name,
    });

    return identity.customerId;
  }

  // HTTP request present but no identify configured — reject to prevent IDOR.
  // The explicitCustomerId comes from the request body and can't be trusted.
  if (request) {
    throw PayKitError.from("UNAUTHORIZED", PAYKIT_ERROR_CODES.IDENTIFY_REQUIRED);
  }

  // Server-to-server: trust the explicit ID (no HTTP request)
  if (explicitCustomerId) {
    return explicitCustomerId;
  }

  throw PayKitError.from("UNAUTHORIZED", PAYKIT_ERROR_CODES.CUSTOMER_ID_REQUIRED);
}

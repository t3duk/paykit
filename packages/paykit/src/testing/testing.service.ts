import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { getCustomerByIdOrThrow, getProviderCustomer } from "../customer/customer.service";

function assertTestingEnabled(ctx: PayKitContext): void {
  if (ctx.options.testing?.enabled !== true) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.TESTING_NOT_ENABLED);
  }
}

function getCustomerTestClockId(
  ctx: PayKitContext,
  customerId: string,
  providerId: string,
): Promise<string> {
  return getCustomerByIdOrThrow(ctx.database, customerId).then((customer) => {
    const providerCustomer = getProviderCustomer(customer, providerId);
    if (!providerCustomer) {
      throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.PROVIDER_CUSTOMER_NOT_FOUND);
    }

    if (!providerCustomer.testClockId) {
      throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.TEST_CLOCK_NOT_FOUND);
    }

    return providerCustomer.testClockId;
  });
}

export async function getCustomerTestClock(ctx: PayKitContext, customerId: string) {
  assertTestingEnabled(ctx);
  const testClockId = await getCustomerTestClockId(ctx, customerId, ctx.provider.id);
  return ctx.stripe.getTestClock({ testClockId });
}

export async function advanceCustomerTestClock(
  ctx: PayKitContext,
  input: { customerId: string; frozenTime: Date },
) {
  assertTestingEnabled(ctx);
  const testClockId = await getCustomerTestClockId(ctx, input.customerId, ctx.provider.id);
  return ctx.stripe.advanceTestClock({
    frozenTime: input.frozenTime,
    testClockId,
  });
}

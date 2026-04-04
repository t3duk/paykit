import type { PayKitContext } from "../../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../../core/errors";
import type { ProviderSubscription } from "../../providers/provider";
import {
  clearScheduledSubscriptionsInGroup,
  deleteScheduledSubscriptionsInGroup,
  endSubscriptions,
  getActiveSubscriptionInGroup,
  getScheduledSubscriptionsInGroup,
  getSubscriptionByProviderSubscriptionId,
  insertSubscriptionRecord,
  replaceSubscriptionSchedule,
  scheduleSubscriptionCancellation,
  syncSubscriptionBillingState,
  syncSubscriptionFromProvider,
  upsertInvoiceRecord,
} from "../../services/billing-service";
import { upsertProviderCustomer } from "../../services/customer-service";
import { getDefaultPaymentMethod } from "../../services/payment-method-service";
import { getLatestProductWithPrice } from "../../services/product-service";
import type {
  ProviderInvoicePayload,
  SubscribeContext,
  SubscribeInput,
  SubscribeResult,
  SubscribeResultInput,
} from "./subscribe.types";

/** Applies the requested plan change for a customer and returns the immediate subscribe result. */
export async function subscribeToPlan(
  ctx: PayKitContext,
  input: SubscribeInput,
): Promise<SubscribeResult> {
  return ctx.logger.trace.run("sub", async () => {
    const startTime = Date.now();
    ctx.logger.info({ planId: input.planId, customerId: input.customerId }, "subscribe started");

    const subCtx = await loadSubscribeContext(ctx, input);

    let result: SubscribeResult;
    if (isSamePlan(subCtx)) {
      // Same plan means either a noop or resuming a pending cancellation.
      result = await handleSamePlanSubscribe(ctx, subCtx);
    } else if (!subCtx.activeSubscription) {
      // No current subscription means this is the customer's first plan in the group.
      result = await handleInitialSubscribe(ctx, subCtx);
    } else if (!hasProviderSubscription(subCtx.activeSubscription)) {
      // A local-only active subscription can be replaced immediately without provider updates.
      result = await handleLocalPlanSwitch(ctx, subCtx);
    } else if (subCtx.isFreeTarget) {
      // Switching from paid to free always happens at period end.
      result = await handleCancelToFree(ctx, subCtx);
    } else if (!subCtx.isUpgrade) {
      // Paid downgrades stay active now and schedule the cheaper plan for later.
      result = await handleScheduledDowngrade(ctx, subCtx);
    } else {
      // Paid upgrades take effect immediately or fall back to checkout.
      result = await handleUpgrade(ctx, subCtx);
    }

    const duration = Date.now() - startTime;
    ctx.logger.info({ duration }, "subscribe completed");
    return result;
  });
}

export async function loadSubscribeContext(
  ctx: PayKitContext,
  input: SubscribeInput,
): Promise<SubscribeContext> {
  const providerId = ctx.provider.id;
  const normalizedPlan = ctx.plans.plans.find((plan) => plan.id === input.planId);
  const storedPlan = await getLatestProductWithPrice(ctx.database, {
    id: input.planId,
    providerId,
  });

  if (!normalizedPlan || !storedPlan) {
    throw PayKitError.from(
      "NOT_FOUND",
      PAYKIT_ERROR_CODES.PLAN_NOT_FOUND,
      `Plan "${input.planId}" not found`,
    );
  }

  const isFreeTarget = storedPlan.priceAmount === null;
  const isPaidTarget = !isFreeTarget;
  if (isPaidTarget && !storedPlan.providerPriceId) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PLAN_NOT_SYNCED,
      `Plan "${input.planId}" is not synced with provider`,
    );
  }

  const { providerCustomerId } = await upsertProviderCustomer(ctx, {
    customerId: input.customerId,
  });
  const hasDefaultPaymentMethod =
    (await getDefaultPaymentMethod(ctx.database, {
      customerId: input.customerId,
      providerId,
    })) != null;

  const activeSubscription = storedPlan.group
    ? await getActiveSubscriptionInGroup(ctx.database, {
        customerId: input.customerId,
        group: storedPlan.group,
      })
    : null;
  const scheduledSubscriptions = storedPlan.group
    ? await getScheduledSubscriptionsInGroup(ctx.database, {
        customerId: input.customerId,
        group: storedPlan.group,
      })
    : [];

  const activeAmount = activeSubscription?.priceAmount ?? 0;
  const targetAmount = storedPlan.priceAmount ?? 0;
  const isUpgrade =
    activeSubscription != null &&
    hasProviderSubscription(activeSubscription) &&
    targetAmount > activeAmount;

  return {
    activeSubscription,
    cancelUrl: input.cancelUrl,
    customerId: input.customerId,
    isFreeTarget,
    isPaidTarget,
    isUpgrade,
    normalizedPlan,
    providerCustomerId,
    providerId,
    scheduledSubscriptions,
    shouldUseCheckout: isPaidTarget && (input.forceCheckout === true || !hasDefaultPaymentMethod),
    storedPlan,
    successUrl: input.successUrl,
  };
}

type ActiveSubscription = SubscribeContext["activeSubscription"];

function buildSubscribeResult(input: SubscribeResultInput): SubscribeResult {
  return {
    invoice: input.invoice
      ? {
          currency: input.invoice.currency,
          hostedUrl: input.invoice.hostedUrl ?? null,
          providerInvoiceId: input.invoice.providerInvoiceId,
          status: input.invoice.status,
          totalAmount: input.invoice.totalAmount,
        }
      : undefined,
    paymentUrl: input.paymentUrl,
    requiredAction: input.requiredAction ?? null,
  };
}

export async function finalizeCheckoutSubscription(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
  input: {
    invoice?: ProviderInvoicePayload | null;
    subscription: ProviderSubscription;
  },
): Promise<void> {
  const activeSubscriptionRef = getProviderSubscriptionRef(subCtx.activeSubscription);

  if (isSamePlan(subCtx)) {
    if (activeSubscriptionRef.subscriptionId === input.subscription.providerSubscriptionId) {
      return;
    }

    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      `Checkout completed for plan "${subCtx.storedPlan.id}" after a different active subscription was already present`,
    );
  }

  if (subCtx.activeSubscription && activeSubscriptionRef.subscriptionId) {
    if (!subCtx.isUpgrade) {
      throw PayKitError.from(
        "BAD_REQUEST",
        PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
        `Checkout completion is only valid for new paid subscriptions or upgrades to "${subCtx.storedPlan.id}"`,
      );
    }

    await ctx.stripe.cancelSubscription({
      currentPeriodEndAt: subCtx.activeSubscription.currentPeriodEndAt,
      providerSubscriptionId: activeSubscriptionRef.subscriptionId,
      providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
    });

    await ctx.database.transaction(async (tx) => {
      await deleteScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
      await endSubscriptions(tx, [subCtx.activeSubscription!.id], {
        canceled: false,
        endedAt: new Date(),
        status: "ended",
      });
      await upsertProviderBackedTargetSubscription(tx, subCtx, input, {
        deferred: true,
      });
    });
    return;
  }

  await ctx.database.transaction(async (tx) => {
    if (subCtx.activeSubscription) {
      await endSubscriptions(tx, [subCtx.activeSubscription.id], {
        canceled: false,
        endedAt: new Date(),
        status: "ended",
      });
    }

    await upsertProviderBackedTargetSubscription(tx, subCtx, input, {
      deferred: true,
    });
  });
}

function isSamePlan(subCtx: SubscribeContext): boolean {
  return subCtx.activeSubscription?.planId === subCtx.storedPlan.id;
}

function getProviderSubscriptionId(subscription: ActiveSubscription): string | null {
  if (subscription?.providerData == null) {
    return null;
  }

  return typeof (subscription.providerData as Record<string, unknown>).subscriptionId === "string"
    ? ((subscription.providerData as Record<string, unknown>).subscriptionId as string)
    : null;
}

function hasProviderSubscription(subscription: ActiveSubscription): boolean {
  return getProviderSubscriptionId(subscription) != null;
}

function getProviderSubscriptionRef(subscription: ActiveSubscription): {
  subscriptionId: string | null;
  subscriptionScheduleId: string | null;
} {
  if (subscription?.providerData == null) {
    return {
      subscriptionId: null,
      subscriptionScheduleId: null,
    };
  }

  const providerData = subscription.providerData as Record<string, unknown>;
  return {
    subscriptionId:
      typeof providerData.subscriptionId === "string" ? providerData.subscriptionId : null,
    subscriptionScheduleId:
      typeof providerData.subscriptionScheduleId === "string"
        ? providerData.subscriptionScheduleId
        : null,
  };
}

/** Returns a noop or resumes the current provider subscription. */
async function handleSamePlanSubscribe(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  if (!activeSubscription) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  const hasPendingChange = subCtx.scheduledSubscriptions.length > 0 || activeSubscription.canceled;
  if (!hasProviderSubscription(activeSubscription) || !hasPendingChange) {
    return buildSubscribeResult({ paymentUrl: null });
  }

  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  const stripeResult = await ctx.stripe.resumeSubscription({
    providerSubscriptionId: activeSubscriptionRef.subscriptionId!,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });

  await ctx.database.transaction(async (tx) => {
    await deleteScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await syncSubscriptionFromProvider(tx, {
      subscriptionId: activeSubscription.id,
      providerSubscription: stripeResult.subscription ?? {
        cancelAtPeriodEnd: false,
        providerSubscriptionId: activeSubscriptionRef.subscriptionId!,
        providerSubscriptionScheduleId: null,
        status: activeSubscription.status,
      },
    });
    await replaceSubscriptionSchedule(tx, {
      subscriptionId: activeSubscription.id,
      scheduledProductId: null,
    });
    if (stripeResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: stripeResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: stripeResult.subscription.currentPeriodStartAt,
        providerData: {
          subscriptionId: stripeResult.subscription.providerSubscriptionId,
          subscriptionScheduleId: stripeResult.subscription.providerSubscriptionScheduleId ?? null,
        },
        status: stripeResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

/** Creates the first subscription in the product group. */
async function handleInitialSubscribe(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  if (subCtx.isFreeTarget) {
    await ctx.database.transaction(async (tx) => {
      await insertLocalTargetSubscription(tx, subCtx, {
        startedAt: new Date(),
        status: "active",
      });
    });

    return buildSubscribeResult({ paymentUrl: null });
  }

  if (subCtx.shouldUseCheckout) {
    return createCheckoutSubscribe(ctx, subCtx);
  }

  const stripeResult = await ctx.stripe.createSubscription({
    providerCustomerId: subCtx.providerCustomerId,
    providerPriceId: subCtx.storedPlan.providerPriceId!,
  });

  await ctx.database.transaction(async (tx) => {
    if (!stripeResult.subscription) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED,
      );
    }

    await upsertProviderBackedTargetSubscription(tx, subCtx, {
      invoice: stripeResult.invoice ?? null,
      subscription: stripeResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

/** Replaces a local-only subscription with the requested target plan. */
async function handleLocalPlanSwitch(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  if (!activeSubscription) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  if (subCtx.shouldUseCheckout) {
    return createCheckoutSubscribe(ctx, subCtx);
  }

  if (subCtx.isFreeTarget) {
    await ctx.database.transaction(async (tx) => {
      const now = new Date();
      await endSubscriptions(tx, [activeSubscription.id], {
        canceled: false,
        endedAt: now,
        status: "ended",
      });
      await insertLocalTargetSubscription(tx, subCtx, {
        startedAt: now,
        status: "active",
      });
    });

    return buildSubscribeResult({ paymentUrl: null });
  }

  const stripeResult = await ctx.stripe.createSubscription({
    providerCustomerId: subCtx.providerCustomerId,
    providerPriceId: subCtx.storedPlan.providerPriceId!,
  });

  await ctx.database.transaction(async (tx) => {
    if (!stripeResult.subscription) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED,
      );
    }

    await endSubscriptions(tx, [activeSubscription.id], {
      canceled: false,
      endedAt: new Date(),
      status: "ended",
    });
    await upsertProviderBackedTargetSubscription(tx, subCtx, {
      invoice: stripeResult.invoice ?? null,
      subscription: stripeResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

/** Cancels the paid subscription and schedules the free plan for period end. */
async function handleCancelToFree(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  if (!activeSubscription || !activeSubscriptionRef.subscriptionId) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  const stripeResult = await ctx.stripe.cancelSubscription({
    currentPeriodEndAt: activeSubscription.currentPeriodEndAt,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });

  await ctx.database.transaction(async (tx) => {
    await clearScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await insertLocalTargetSubscription(tx, subCtx, {
      startedAt: activeSubscription.currentPeriodEndAt ?? null,
      status: "scheduled",
    });
    await scheduleSubscriptionCancellation(tx, {
      canceledAt: new Date(),
      currentPeriodEndAt: activeSubscription.currentPeriodEndAt ?? null,
      subscriptionId: activeSubscription.id,
    });
    await replaceSubscriptionSchedule(tx, {
      scheduledProductId: subCtx.storedPlan.internalId,
      subscriptionId: activeSubscription.id,
    });
    if (stripeResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: stripeResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: stripeResult.subscription.currentPeriodStartAt,
        providerData: {
          subscriptionId: stripeResult.subscription.providerSubscriptionId,
          subscriptionScheduleId: stripeResult.subscription.providerSubscriptionScheduleId ?? null,
        },
        status: stripeResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

/** Schedules a lower paid tier to start when the current billing period ends. */
async function handleScheduledDowngrade(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  if (!activeSubscription || !activeSubscriptionRef.subscriptionId) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  const stripeResult = await ctx.stripe.scheduleSubscriptionChange({
    providerPriceId: subCtx.storedPlan.providerPriceId!,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });

  await ctx.database.transaction(async (tx) => {
    await clearScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await insertLocalTargetSubscription(tx, subCtx, {
      startedAt: activeSubscription.currentPeriodEndAt ?? null,
      status: "scheduled",
    });
    await scheduleSubscriptionCancellation(tx, {
      canceledAt: new Date(),
      currentPeriodEndAt: activeSubscription.currentPeriodEndAt ?? null,
      subscriptionId: activeSubscription.id,
    });
    await replaceSubscriptionSchedule(tx, {
      scheduledProductId: subCtx.storedPlan.internalId,
      subscriptionId: activeSubscription.id,
    });
    if (stripeResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: stripeResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: stripeResult.subscription.currentPeriodStartAt,
        providerData: {
          subscriptionId: stripeResult.subscription.providerSubscriptionId,
          subscriptionScheduleId: stripeResult.subscription.providerSubscriptionScheduleId ?? null,
        },
        status: stripeResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

/** Upgrades the customer immediately or redirects them to checkout. */
async function handleUpgrade(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  if (!activeSubscription || !activeSubscriptionRef.subscriptionId) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  if (subCtx.shouldUseCheckout) {
    return createCheckoutSubscribe(ctx, subCtx);
  }

  const stripeResult = await ctx.stripe.updateSubscription({
    providerPriceId: subCtx.storedPlan.providerPriceId!,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
  });

  await ctx.database.transaction(async (tx) => {
    if (!stripeResult.subscription) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED,
      );
    }

    await deleteScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await endSubscriptions(tx, [activeSubscription.id], {
      canceled: false,
      endedAt: new Date(),
      status: "ended",
    });
    await upsertProviderBackedTargetSubscription(tx, subCtx, {
      invoice: stripeResult.invoice ?? null,
      subscription: stripeResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

/** Starts checkout and lets the webhook finalize the subscription later. */
async function createCheckoutSubscribe(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const checkoutResult = await ctx.stripe.createSubscriptionCheckout({
    cancelUrl: subCtx.cancelUrl,
    metadata: {
      paykit_customer_id: subCtx.customerId,
      paykit_intent: "subscribe",
      paykit_plan_id: subCtx.storedPlan.id,
    },
    providerCustomerId: subCtx.providerCustomerId,
    providerPriceId: subCtx.storedPlan.providerPriceId!,
    successUrl: subCtx.successUrl,
  });

  return buildSubscribeResult({ paymentUrl: checkoutResult.paymentUrl });
}

async function insertLocalTargetSubscription(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
  input: {
    startedAt: Date | null;
    status: "active" | "scheduled";
  },
): Promise<void> {
  await insertSubscriptionRecord(database, {
    customerId: subCtx.customerId,
    planFeatures: subCtx.normalizedPlan.includes,
    productInternalId: subCtx.storedPlan.internalId,
    providerId: subCtx.providerId,
    startedAt: input.startedAt,
    status: input.status,
  });
}

async function upsertProviderBackedTargetSubscription(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
  input: {
    invoice?: ProviderInvoicePayload | null;
    subscription: ProviderSubscription;
  },
  options?: { deferred?: boolean },
): Promise<void> {
  const providerData = {
    subscriptionId: input.subscription.providerSubscriptionId,
    subscriptionScheduleId: input.subscription.providerSubscriptionScheduleId ?? null,
  };

  let subscriptionId: string | null = null;
  if (options?.deferred) {
    const existingSub = await getSubscriptionByProviderSubscriptionId(database, {
      providerId: subCtx.providerId,
      providerSubscriptionId: input.subscription.providerSubscriptionId,
    });
    if (existingSub) {
      subscriptionId = existingSub.id;
      await syncSubscriptionBillingState(database, {
        currentPeriodEndAt: input.subscription.currentPeriodEndAt ?? null,
        currentPeriodStartAt: input.subscription.currentPeriodStartAt ?? null,
        providerData,
        status: input.subscription.status,
        subscriptionId: existingSub.id,
      });
    }
  }

  if (!subscriptionId) {
    const inserted = await insertSubscriptionRecord(database, {
      currentPeriodEndAt: input.subscription.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.subscription.currentPeriodStartAt ?? null,
      customerId: subCtx.customerId,
      planFeatures: subCtx.normalizedPlan.includes,
      productInternalId: subCtx.storedPlan.internalId,
      providerId: subCtx.providerId,
      providerData,
      startedAt: input.subscription.currentPeriodStartAt ?? new Date(),
      status: input.subscription.status,
    });
    subscriptionId = inserted.id;
  }

  if (input.invoice) {
    await upsertInvoiceRecord(database, {
      customerId: subCtx.customerId,
      invoice: input.invoice,
      providerId: subCtx.providerId,
      subscriptionId,
    });
  }
}

async function clearScheduledSubscriptionsInGroupIfNeeded(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
): Promise<void> {
  if (!subCtx.storedPlan.group) {
    return;
  }

  await clearScheduledSubscriptionsInGroup(database, {
    customerId: subCtx.customerId,
    group: subCtx.storedPlan.group,
  });
}

async function deleteScheduledSubscriptionsInGroupIfNeeded(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
): Promise<void> {
  if (!subCtx.storedPlan.group) {
    return;
  }

  await deleteScheduledSubscriptionsInGroup(database, {
    customerId: subCtx.customerId,
    group: subCtx.storedPlan.group,
  });
}

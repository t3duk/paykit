import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import {
  customer,
  customerEntitlement,
  customerPrice,
  customerProduct,
  invoice,
  payment,
  paymentMethod,
  providerCustomer,
  subscription,
} from "../database/schema";
import type {
  CustomerEntitlement,
  CustomerSubscription,
  CustomerWithDetails,
  ListCustomersResult,
} from "../types/instance";
import type { Customer, InternalProviderCustomer } from "../types/models";
import {
  getActiveCustomerProductInGroup,
  getScheduledCustomerProductsInGroup,
  insertCustomerProductRecord,
} from "./billing-service";
import { getLatestProductWithPrice } from "./product-service";

export interface SyncCustomerInput {
  id: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export async function syncCustomer(
  database: PayKitDatabase,
  input: SyncCustomerInput,
): Promise<Customer> {
  const now = new Date();
  const existing = await database.query.customer.findFirst({
    where: eq(customer.id, input.id),
  });

  if (existing) {
    const rows = await database
      .update(customer)
      .set({
        email: input.email ?? existing.email ?? null,
        name: input.name ?? existing.name ?? null,
        metadata: input.metadata ?? existing.metadata ?? null,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(customer.id, existing.id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to update customer.");
    }
    return row;
  }

  const rows = await database
    .insert(customer)
    .values({
      id: input.id,
      email: input.email ?? null,
      name: input.name ?? null,
      metadata: input.metadata ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create customer.");
  }
  return row;
}

export async function ensureDefaultPlansForCustomer(
  ctx: PayKitContext,
  customerId: string,
): Promise<void> {
  const defaultPlans = ctx.plans.plans.filter((plan) => plan.isDefault);
  if (defaultPlans.length === 0) {
    return;
  }

  for (const defaultPlan of defaultPlans) {
    if (!defaultPlan.group) {
      continue;
    }

    const activeProduct = await getActiveCustomerProductInGroup(ctx.database, {
      customerId,
      group: defaultPlan.group,
      providerId: ctx.provider.id,
    });
    if (activeProduct) {
      continue;
    }

    const scheduledProducts = await getScheduledCustomerProductsInGroup(ctx.database, {
      customerId,
      group: defaultPlan.group,
      providerId: ctx.provider.id,
    });
    if (scheduledProducts.length > 0) {
      continue;
    }

    const storedPlan = await getLatestProductWithPrice(ctx.database, {
      id: defaultPlan.id,
      providerId: ctx.provider.id,
    });
    if (!storedPlan) {
      continue;
    }

    if (storedPlan.priceId !== null) {
      ctx.logger.warn(
        `Skipping default plan "${defaultPlan.id}" for customer "${customerId}" because paid default plans are not auto-attached yet.`,
      );
      continue;
    }

    await insertCustomerProductRecord(ctx.database, {
      customerId,
      planFeatures: defaultPlan.includes,
      productInternalId: storedPlan.internalId,
      providerId: ctx.provider.id,
      startedAt: new Date(),
      status: "active",
    });
  }
}

export async function syncCustomerWithDefaults(
  ctx: PayKitContext,
  input: SyncCustomerInput,
): Promise<Customer> {
  const syncedCustomer = await syncCustomer(ctx.database, input);
  await ensureDefaultPlansForCustomer(ctx, syncedCustomer.id);
  return syncedCustomer;
}

export async function getCustomerById(
  database: PayKitDatabase,
  customerId: string,
): Promise<Customer | null> {
  return (
    (await database.query.customer.findFirst({
      where: and(eq(customer.id, customerId), isNull(customer.deletedAt)),
    })) ?? null
  );
}

export async function getCustomerByIdOrThrow(
  database: PayKitDatabase,
  customerId: string,
): Promise<Customer> {
  const existingCustomer = await getCustomerById(database, customerId);
  if (!existingCustomer) {
    throw new PayKitError("CUSTOMER_NOT_FOUND");
  }

  return existingCustomer;
}

export async function getProviderCustomer(
  database: PayKitDatabase,
  input: { customerId: string; providerId: string },
): Promise<InternalProviderCustomer | null> {
  return (
    (await database.query.providerCustomer.findFirst({
      where: and(
        eq(providerCustomer.customerId, input.customerId),
        eq(providerCustomer.providerId, input.providerId),
      ),
    })) ?? null
  );
}

export async function getProviderCustomerByProviderCustomerId(
  database: PayKitDatabase,
  input: { providerCustomerId: string; providerId: string },
): Promise<InternalProviderCustomer | null> {
  return (
    (await database.query.providerCustomer.findFirst({
      where: and(
        eq(providerCustomer.providerId, input.providerId),
        eq(providerCustomer.providerCustomerId, input.providerCustomerId),
      ),
    })) ?? null
  );
}

export async function upsertProviderCustomer(
  ctx: PayKitContext,
  input: { customerId: string },
): Promise<InternalProviderCustomer> {
  const providerId = ctx.provider.id;

  return ctx.database.transaction(async (tx) => {
    const existingCustomer = await getCustomerByIdOrThrow(tx, input.customerId);

    const existing = await getProviderCustomer(tx, {
      customerId: input.customerId,
      providerId,
    });
    if (existing) {
      return existing;
    }

    const { providerCustomerId } = await ctx.stripe.upsertCustomer({
      id: existingCustomer.id,
      email: existingCustomer.email ?? undefined,
      name: existingCustomer.name ?? undefined,
      metadata: existingCustomer.metadata ?? undefined,
    });

    const rows = await tx
      .insert(providerCustomer)
      .values({
        id: generateId("pa"),
        customerId: existingCustomer.id,
        providerId,
        providerCustomerId,
        createdAt: new Date(),
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create provider customer.");
    }
    return row;
  });
}

export async function deleteCustomerFromDatabase(
  database: PayKitDatabase,
  customerId: string,
): Promise<void> {
  // Order matters due to foreign key constraints
  const customerProductIds = await database
    .select({ id: customerProduct.id })
    .from(customerProduct)
    .where(eq(customerProduct.customerId, customerId));
  const cpIds = customerProductIds.map((row) => row.id);

  if (cpIds.length > 0) {
    await database
      .delete(customerEntitlement)
      .where(inArray(customerEntitlement.customerProductId, cpIds));
    await database.delete(customerPrice).where(inArray(customerPrice.customerProductId, cpIds));
    await database.delete(subscription).where(inArray(subscription.customerProductId, cpIds));
  }

  await database.delete(customerProduct).where(eq(customerProduct.customerId, customerId));
  await database.delete(invoice).where(eq(invoice.customerId, customerId));
  await database.delete(payment).where(eq(payment.customerId, customerId));
  await database.delete(paymentMethod).where(eq(paymentMethod.customerId, customerId));
  await database.delete(subscription).where(eq(subscription.customerId, customerId));
  await database.delete(providerCustomer).where(eq(providerCustomer.customerId, customerId));
  await database.delete(customer).where(eq(customer.id, customerId));
}

export async function hardDeleteCustomer(ctx: PayKitContext, customerId: string): Promise<void> {
  await getCustomerByIdOrThrow(ctx.database, customerId);

  // Cancel all active Stripe subscriptions and delete the Stripe customer
  const providerRecord = await getProviderCustomer(ctx.database, {
    customerId,
    providerId: ctx.provider.id,
  });

  if (providerRecord) {
    try {
      const activeSubscriptions = await ctx.stripe.listActiveSubscriptions({
        providerCustomerId: providerRecord.providerCustomerId,
      });
      for (const sub of activeSubscriptions) {
        await ctx.stripe.cancelSubscription({
          providerSubscriptionId: sub.providerSubscriptionId,
        });
      }
      await ctx.stripe.deleteCustomer({
        providerCustomerId: providerRecord.providerCustomerId,
      });
    } catch (error) {
      ctx.logger.error(
        `Failed to clean up Stripe customer ${providerRecord.providerCustomerId}:`,
        error,
      );
    }
  }

  await deleteCustomerFromDatabase(ctx.database, customerId);
}

export async function listCustomers(
  ctx: PayKitContext,
  input?: {
    limit?: number;
    offset?: number;
    planIds?: string[];
  },
): Promise<ListCustomersResult> {
  const limit = input?.limit ?? 50;
  const offset = input?.offset ?? 0;
  const planIds = input?.planIds;

  // Build the base query for customers
  let customerRows: Customer[];
  let total: number;

  if (planIds && planIds.length > 0) {
    // Filter by customers who have active subscriptions to specific plans
    const filteredResult = (await ctx.database.execute(sql`
      select distinct c.*
      from paykit_customer c
      inner join paykit_customer_product cp on cp.customer_id = c.id
      inner join paykit_product p on p.internal_id = cp.product_internal_id
      where p.id in ${sql`(${sql.join(
        planIds.map((id) => sql`${id}`),
        sql`, `,
      )})`}
        and cp.status in ('active', 'trialing', 'past_due')
        and (cp.ended_at is null or cp.ended_at > now())
        and c.deleted_at is null
      order by c.created_at desc
      limit ${limit}
      offset ${offset}
    `)) as unknown as { rows: Customer[] };
    customerRows = filteredResult.rows;

    const countResult = (await ctx.database.execute(sql`
      select count(distinct c.id)::int as count
      from paykit_customer c
      inner join paykit_customer_product cp on cp.customer_id = c.id
      inner join paykit_product p on p.internal_id = cp.product_internal_id
      where p.id in ${sql`(${sql.join(
        planIds.map((id) => sql`${id}`),
        sql`, `,
      )})`}
        and cp.status in ('active', 'trialing', 'past_due')
        and (cp.ended_at is null or cp.ended_at > now())
        and c.deleted_at is null
    `)) as unknown as { rows: Array<{ count: number }> };
    total = countResult.rows[0]?.count ?? 0;
  } else {
    const countResult = await ctx.database
      .select({ count: count() })
      .from(customer)
      .where(isNull(customer.deletedAt));
    total = countResult[0]?.count ?? 0;

    customerRows = await ctx.database.query.customer.findMany({
      where: isNull(customer.deletedAt),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      limit,
      offset,
    });
  }

  // Fetch subscriptions and entitlements for all returned customers
  const customerIds = customerRows.map((c) => c.id);
  const data: CustomerWithDetails[] = [];

  if (customerIds.length > 0) {
    // Get subscriptions
    const subscriptionRows = (await ctx.database.execute(sql`
      select
        cp.customer_id as "customerId",
        p.id as "planId",
        cp.status,
        cp.canceled as "cancelAtPeriodEnd",
        cp.current_period_start_at as "currentPeriodStart",
        cp.current_period_end_at as "currentPeriodEnd"
      from paykit_customer_product cp
      inner join paykit_product p on p.internal_id = cp.product_internal_id
      where cp.customer_id in ${sql`(${sql.join(
        customerIds.map((id) => sql`${id}`),
        sql`, `,
      )})`}
        and cp.status in ('active', 'trialing', 'past_due', 'scheduled')
        and (cp.ended_at is null or cp.ended_at > now())
      order by cp.created_at desc
    `)) as unknown as {
      rows: Array<CustomerSubscription & { customerId: string }>;
    };

    // Get entitlements
    const entitlementRows = (await ctx.database.execute(sql`
      select
        ce.customer_id as "customerId",
        ce.feature_id as "featureId",
        ce.balance,
        coalesce(pf."limit", 0) as "limit",
        case when ce.unlimited then 0 else coalesce(pf."limit", 0) - ce.balance end as "usage",
        ce.unlimited,
        ce.next_reset_at as "nextResetAt"
      from paykit_customer_entitlement ce
      inner join paykit_customer_product cp on cp.id = ce.customer_product_id
      left join paykit_product_feature pf
        on pf.product_internal_id = cp.product_internal_id
        and pf.feature_id = ce.feature_id
      where ce.customer_id in ${sql`(${sql.join(
        customerIds.map((id) => sql`${id}`),
        sql`, `,
      )})`}
        and cp.status in ('active', 'trialing', 'past_due')
        and (cp.ended_at is null or cp.ended_at > now())
    `)) as unknown as {
      rows: Array<CustomerEntitlement & { customerId: string }>;
    };

    // Group by customer
    const subscriptionsByCustomer = new Map<string, CustomerSubscription[]>();
    for (const row of subscriptionRows) {
      const list = subscriptionsByCustomer.get(row.customerId) ?? [];
      list.push({
        planId: row.planId,
        status: row.status,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        currentPeriodStart: row.currentPeriodStart
          ? new Date(row.currentPeriodStart as unknown as string)
          : null,
        currentPeriodEnd: row.currentPeriodEnd
          ? new Date(row.currentPeriodEnd as unknown as string)
          : null,
      });
      subscriptionsByCustomer.set(row.customerId, list);
    }

    const entitlementsByCustomer = new Map<string, Record<string, CustomerEntitlement>>();
    for (const row of entitlementRows) {
      const map = entitlementsByCustomer.get(row.customerId) ?? {};
      map[row.featureId] = {
        featureId: row.featureId,
        balance: Number(row.balance),
        limit: Number(row.limit),
        usage: Number(row.usage),
        unlimited: row.unlimited,
        nextResetAt: row.nextResetAt ? new Date(row.nextResetAt as unknown as string) : null,
      };
      entitlementsByCustomer.set(row.customerId, map);
    }

    for (const c of customerRows) {
      data.push({
        ...c,
        subscriptions: subscriptionsByCustomer.get(c.id) ?? [],
        entitlements: entitlementsByCustomer.get(c.id) ?? {},
      });
    }
  }

  return {
    data,
    total,
    hasMore: offset + limit < total,
    limit,
    offset,
  };
}

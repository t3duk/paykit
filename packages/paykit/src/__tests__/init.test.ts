import type { Pool } from "pg";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { toNextJsHandler } from "../handlers/next-js";
import { createPayKit, defineProvider } from "../index";
import { mockProvider } from "../test-utils/mock-provider";

function createTestPool(): Pool {
  const db = newDb();
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool & {
    connect: () => Promise<{
      query: (...args: unknown[]) => Promise<unknown>;
      release: () => void;
    }>;
    query: (...args: unknown[]) => Promise<unknown>;
  };

  const sanitizeQuery = (query: unknown): { rowMode: "array" | undefined; value: unknown } => {
    if (!query || typeof query === "string") {
      return { rowMode: undefined, value: query };
    }
    const { rowMode, types: _types, ...rest } = query as Record<string, unknown>;
    return {
      rowMode: rowMode === "array" ? "array" : undefined,
      value: rest,
    };
  };

  const getFieldNames = (query: unknown, result: unknown): string[] => {
    const queryText = typeof query === "string" ? query : (query as { text?: string }).text;

    if (queryText) {
      const selectMatch = queryText.match(/select\s+(.+?)\s+from\s/isu);
      const returningMatch = queryText.match(/returning\s+(.+)$/isu);
      const segment = selectMatch?.[1] ?? returningMatch?.[1];
      if (segment) {
        const matches = [...segment.matchAll(/"([^"]+)"/gu)];
        if (matches.length > 0) {
          return matches.map((match) => match[1]!);
        }
      }
    }

    const queryResult = result as { rows?: Array<Record<string, unknown>> };
    return queryResult.rows?.[0] ? Object.keys(queryResult.rows[0]) : [];
  };

  const adaptResult = (result: unknown, rowMode: "array" | undefined): unknown => {
    if (rowMode !== "array") {
      return result;
    }

    const queryResult = result as {
      rows?: Array<Record<string, unknown>>;
      fields?: Array<{ name: string }>;
    };
    const rows = queryResult.rows ?? [];
    const fieldNames = getFieldNames(currentQuery, result);

    return {
      ...queryResult,
      rows: rows.map((row) => fieldNames.map((fieldName) => row[fieldName])),
    };
  };

  let currentQuery: unknown;
  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  pool.query = ((...args: unknown[]) => {
    const [query, ...rest] = args;
    currentQuery = query;
    const sanitized = sanitizeQuery(query);
    return originalQuery(sanitized.value, ...rest).then((result) =>
      adaptResult(result, sanitized.rowMode),
    );
  }) as typeof pool.query;

  const originalConnect = pool.connect.bind(pool);
  pool.connect = (async () => {
    const client = await originalConnect();
    const originalClientQuery = client.query.bind(client) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    client.query = ((...args: unknown[]) => {
      const [query, ...rest] = args;
      currentQuery = query;
      const sanitized = sanitizeQuery(query);
      return originalClientQuery(sanitized.value, ...rest).then((result) =>
        adaptResult(result, sanitized.rowMode),
      );
    }) as typeof client.query;
    return client;
  }) as typeof pool.connect;

  return pool as unknown as Pool;
}

describe("paykit init", () => {
  it("should expose the MVP API shape", async () => {
    const paykit = createPayKit({
      database: createTestPool(),
      providers: [mockProvider()],
    });

    expect(typeof paykit.customer.sync).toBe("function");
    expect(typeof paykit.customer.get).toBe("function");
    expect(typeof paykit.customer.delete).toBe("function");

    expect(typeof paykit.checkout.create).toBe("function");

    expect(typeof paykit.paymentMethod.attach).toBe("function");
    expect(typeof paykit.paymentMethod.list).toBe("function");
    expect(typeof paykit.paymentMethod.setDefault).toBe("function");
    expect(typeof paykit.paymentMethod.detach).toBe("function");

    expect(typeof paykit.handleWebhook).toBe("function");
    expect(typeof paykit.asCustomer).toBe("function");

    const scoped = paykit.asCustomer({ referenceId: "user_1" });
    expect(typeof scoped.checkout.create).toBe("function");
    expect(typeof scoped.paymentMethod.attach).toBe("function");
  });

  it("should expose next handler factory", () => {
    const paykit = createPayKit({
      database: createTestPool(),
      providers: [mockProvider()],
    });

    const handlers = toNextJsHandler(paykit);
    expect(typeof handlers.GET).toBe("function");
    expect(typeof handlers.POST).toBe("function");
  });

  it("should initialize context and sync schema on startup", async () => {
    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [mockProvider()],
    });

    const context = await paykit.$context;
    expect(context).toBeDefined();

    const result = await pool.query(`
      select distinct table_name
      from information_schema.tables
      where table_name in (
        'paykit_customer',
        'paykit_provider_customer',
        'paykit_payment_method',
        'paykit_charge'
      )
      order by table_name
    `);

    expect(result.rows.map((row: { table_name: string }) => row.table_name)).toEqual([
      "paykit_charge",
      "paykit_customer",
      "paykit_payment_method",
      "paykit_provider_customer",
    ]);
  });

  it("should initialize with Postgres storage and sync customers", async () => {
    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [mockProvider()],
    });

    const first = await paykit.customer.sync({
      referenceId: "user_1",
      email: "one@example.com",
      name: "One",
    });
    const second = await paykit.customer.sync({
      referenceId: "user_1",
      email: "two@example.com",
    });

    expect(second.id).toBe(first.id);
    expect(second.email).toBe("two@example.com");
    expect(second.name).toBe("One");
  });

  it("should lazily create and reuse provider accounts for provider actions", async () => {
    const calls = {
      attachPaymentMethod: [] as string[],
      checkout: [] as string[],
      upsertCustomer: [] as string[],
    };

    const provider = defineProvider({
      id: "mock",

      async upsertCustomer(data) {
        calls.upsertCustomer.push(data.referenceId);
        return { providerCustomerId: `provider_${data.referenceId}` };
      },

      async checkout(data) {
        calls.checkout.push(data.providerCustomerId);
        return { url: "https://example.com/checkout/mock" };
      },

      async attachPaymentMethod(data) {
        calls.attachPaymentMethod.push(data.providerCustomerId);
        return { url: data.returnURL };
      },

      async detachPaymentMethod() {},

      async handleWebhook() {
        return {
          name: "webhook.received" as const,
          payload: { hasBody: true, webhookId: "evt_test" },
        };
      },
    });

    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [provider],
    });

    const customer = await paykit.customer.sync({
      referenceId: "user_1",
      email: "user@example.com",
      name: "User One",
    });

    expect((await pool.query("select * from paykit_provider_customer")).rows).toHaveLength(0);

    await paykit.checkout.create({
      providerId: "mock",
      customerId: customer.id,
      amount: 9900,
      description: "Lifetime License",
      successURL: "https://example.com/success",
    });

    const providerCustomers = await pool.query(
      "select provider_customer_id from paykit_provider_customer",
    );
    expect(providerCustomers.rows).toHaveLength(1);
    expect(providerCustomers.rows[0]?.provider_customer_id).toBe("provider_user_1");
    expect(calls.upsertCustomer).toEqual(["user_1"]);
    expect(calls.checkout).toEqual(["provider_user_1"]);

    await paykit.paymentMethod.attach({
      customerId: customer.id,
      providerId: "mock",
      returnURL: "https://example.com/return",
    });

    expect((await pool.query("select * from paykit_provider_customer")).rows).toHaveLength(1);
    expect(calls.upsertCustomer).toEqual(["user_1"]);
    expect(calls.attachPaymentMethod).toEqual(["provider_user_1"]);

    await paykit.customer.delete({ referenceId: "user_1" });
    expect((await pool.query("select * from paykit_provider_customer")).rows).toHaveLength(1);
  });

  it("should use transactions in Postgres storage for setDefault", async () => {
    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [mockProvider()],
    });

    await paykit.customer.sync({
      referenceId: "user_1",
      email: "user@example.com",
      name: "User",
    });

    const customer = await paykit.customer.get({ referenceId: "user_1" });
    expect(customer).toBeTruthy();

    await pool.query(
      `
        insert into paykit_payment_method (
          id,
          customer_id,
          provider_id,
          provider_method_id,
          type,
          last4,
          expiry_month,
          expiry_year,
          is_default,
          deleted_at,
          created_at,
          updated_at
        )
        values
          ('pm_1', $1, 'mock', 'provider_pm_1', 'card', '1111', 1, 2030, true, null, now(), now()),
          ('pm_2', $1, 'mock', 'provider_pm_2', 'card', '2222', 2, 2031, false, null, now(), now())
      `,
      [customer!.id],
    );

    await paykit.paymentMethod.setDefault({
      customerId: customer!.id,
      providerId: "mock",
      paymentMethodId: "pm_2",
    });

    const paymentMethods = await paykit.paymentMethod.list({
      customerId: customer!.id,
      providerId: "mock",
    });

    expect(paymentMethods.find((method) => method.id === "pm_1")?.isDefault).toBe(false);
    expect(paymentMethods.find((method) => method.id === "pm_2")?.isDefault).toBe(true);
  });

  it("should fail when database setup is invalid", async () => {
    const paykit = createPayKit({
      database: {
        query: async () => {
          throw new Error("db unavailable");
        },
      } as unknown as Pool,
      providers: [mockProvider()],
    });

    await expect(paykit.$context).rejects.toThrow(/Failed query|db unavailable/);
  });
});

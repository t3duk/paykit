import { PayKitError } from "../../core/errors";
import { generateId } from "../../core/id";
import type { Customer } from "../../types/models";
import type { DatabaseAdapter } from "../ports/database";

function anonymizedEmail(id: string): string {
  return `deleted+${id}@paykit.local`;
}

export interface SyncCustomerInput {
  referenceId: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export async function syncCustomer(
  database: DatabaseAdapter,
  input: SyncCustomerInput,
): Promise<Customer> {
  const existing = await database.findOne<Customer>({
    model: "customer",
    where: { referenceId: input.referenceId },
  });

  const now = new Date();

  if (existing) {
    return database.update<Customer>({
      model: "customer",
      where: { id: existing.id },
      data: {
        email: input.email ?? existing.email,
        name: input.name ?? existing.name,
        metadata: input.metadata ?? existing.metadata,
        deletedAt: null,
        updatedAt: now,
      },
    });
  }

  return database.create<Customer>({
    model: "customer",
    data: {
      id: generateId("cust"),
      referenceId: input.referenceId,
      email: input.email ?? null,
      name: input.name ?? null,
      metadata: input.metadata ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  });
}

export async function getCustomerByReferenceId(
  database: DatabaseAdapter,
  referenceId: string,
): Promise<Customer | null> {
  return database.findOne<Customer>({
    model: "customer",
    where: { referenceId, deletedAt: null },
  });
}

export async function deleteCustomerByReferenceId(
  database: DatabaseAdapter,
  referenceId: string,
): Promise<void> {
  const customer = await database.findOne<Customer>({
    model: "customer",
    where: { referenceId, deletedAt: null },
  });

  if (!customer) {
    throw new PayKitError("CUSTOMER_NOT_FOUND");
  }

  await database.update<Customer>({
    model: "customer",
    where: { id: customer.id },
    data: {
      email: anonymizedEmail(customer.id),
      name: "Deleted Customer",
      metadata: null,
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

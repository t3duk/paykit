import type { DatabaseAdapter } from "../domain/ports/database";

interface MemoryTables {
  [model: string]: Array<Record<string, unknown>>;
}

function matches(
  row: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
): boolean {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([key, value]) => row[key] === value);
}

export function memoryAdapter(): DatabaseAdapter {
  const tables: MemoryTables = {};

  const getRows = (model: string): Array<Record<string, unknown>> => {
    const rows = tables[model];
    if (rows) {
      return rows;
    }

    const created: Array<Record<string, unknown>> = [];
    tables[model] = created;
    return created;
  };

  return {
    async create<T>(input: { model: string; data: Record<string, unknown> }): Promise<T> {
      const rows = getRows(input.model);
      const row = { ...input.data };
      rows.push(row);
      return row as T;
    },

    async findOne<T>(input: { model: string; where: Record<string, unknown> }): Promise<T | null> {
      const rows = getRows(input.model);
      const found = rows.find((row) => matches(row, input.where)) ?? null;
      return found as T | null;
    },

    async findMany<T>(input: {
      model: string;
      where?: Record<string, unknown>;
      sortBy?: { field: string; direction: "asc" | "desc" };
      limit?: number;
    }): Promise<T[]> {
      const rows = getRows(input.model).filter((row) => matches(row, input.where));
      const sorted = input.sortBy
        ? [...rows].sort((left, right) => {
            const leftValue = left[input.sortBy!.field];
            const rightValue = right[input.sortBy!.field];

            if (leftValue === rightValue) {
              return 0;
            }

            const direction = input.sortBy!.direction === "asc" ? 1 : -1;
            return leftValue! > rightValue! ? direction : -direction;
          })
        : rows;

      if (input.limit === undefined) {
        return sorted as T[];
      }

      return sorted.slice(0, input.limit) as T[];
    },

    async update<T>(input: {
      model: string;
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<T> {
      const rows = getRows(input.model);
      const index = rows.findIndex((row) => matches(row, input.where));
      if (index < 0) {
        throw new Error(`Row not found in ${input.model}`);
      }

      const next = { ...rows[index], ...input.data };
      rows[index] = next;
      return next as T;
    },
  };
}

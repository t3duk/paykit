export interface DatabaseAdapter {
  create<T>(input: { model: string; data: Record<string, unknown> }): Promise<T>;

  findOne<T>(input: { model: string; where: Record<string, unknown> }): Promise<T | null>;

  findMany<T>(input: {
    model: string;
    where?: Record<string, unknown>;
    sortBy?: { field: string; direction: "asc" | "desc" };
    limit?: number;
  }): Promise<T[]>;

  update<T>(input: {
    model: string;
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<T>;
}

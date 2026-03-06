import type { DatabaseAdapter } from "../domain/ports/database";
import type { PayKitProvider } from "../domain/ports/provider";
import type { PayKitEventHandler } from "./events";

export type ProviderId<TProviders extends readonly PayKitProvider[]> = TProviders[number]["id"];

export interface PayKitOptions<
  TProviders extends readonly PayKitProvider[] = readonly PayKitProvider[],
> {
  database: DatabaseAdapter;
  providers: TProviders;
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  on?: Record<string, PayKitEventHandler>;
}

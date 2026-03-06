import type { DatabaseAdapter } from "../domain/ports/database";
import type { PayKitProvider } from "../domain/ports/provider";
import type { PayKitEventHandler } from "../types/events";
import type { PayKitOptions, ProviderId } from "../types/options";

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface PayKitContext<
  TProviderId extends string = string,
  TProviders extends readonly PayKitProvider[] = readonly PayKitProvider[],
> {
  options: PayKitOptions<TProviders>;
  database: DatabaseAdapter;
  providers: Map<TProviderId, PayKitProvider>;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  eventHandlers: Record<string, PayKitEventHandler>;
}

export function createContext<const TProviders extends readonly PayKitProvider[]>(
  options: PayKitOptions<TProviders>,
): PayKitContext<ProviderId<TProviders>, TProviders> {
  if (options.providers.length === 0) {
    throw new Error("At least one provider is required");
  }
  const providers = new Map<ProviderId<TProviders>, PayKitProvider>();
  for (const provider of options.providers) {
    providers.set(provider.id as ProviderId<TProviders>, provider);
  }

  return {
    options,
    database: options.database,
    providers,
    logger: options.logger ?? noopLogger,
    eventHandlers: options.on ?? {},
  };
}

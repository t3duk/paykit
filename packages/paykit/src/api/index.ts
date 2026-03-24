import { createRouter } from "better-call";

import type { PayKitContext } from "../core/context";
import type { PayKitOptions } from "../types/options";
import { checkout } from "./routes/checkout";

export const endpoints = { checkout } as const;

export function getEndpoints(ctx: PayKitContext | Promise<PayKitContext>) {
  const wrapped = Object.fromEntries(
    Object.entries(endpoints).map(([key, endpoint]) => {
      const fn = async (args: { body: unknown }) => {
        const resolved = await ctx;
        return (endpoint as (...args: unknown[]) => unknown)({
          ...args,
          context: resolved,
        });
      };
      Object.assign(fn, { path: endpoint.path, options: endpoint.options });
      return [key, fn];
    }),
  );

  return wrapped as typeof endpoints;
}

export function createPayKitRouter(ctx: PayKitContext, options: PayKitOptions) {
  return createRouter(endpoints, {
    basePath: options.basePath ?? "/api/paykit",
    routerContext: ctx,
    onError(e) {
      ctx.logger.error("API error:", e);
    },
  });
}

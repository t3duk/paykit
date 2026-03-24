import { createPayKitRouter, getEndpoints } from "../api";
import type { PayKitInstance } from "../types/instance";
import type { PayKitOptions } from "../types/options";
import { handleWebhook } from "../webhook/handle-webhook";
import { createContext, type PayKitContext } from "./context";

const payKitInstanceSymbol = Symbol.for("paykit.instance");

export function isPayKitInstance(value: unknown): value is PayKitInstance {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<PropertyKey, unknown>)[payKitInstanceSymbol] === true
  );
}

export function createPayKit(options: PayKitOptions): PayKitInstance {
  let contextPromise: Promise<PayKitContext> | undefined;
  const getContext = () => {
    contextPromise ??= createContext(options);
    return contextPromise;
  };

  const paykit: PayKitInstance = {
    options,

    async handler(request: Request) {
      const ctx = await getContext();
      const router = createPayKitRouter(ctx, options);
      return router.handler(request);
    },

    get api() {
      return getEndpoints(getContext());
    },

    async checkout(input) {
      const api = getEndpoints(getContext());
      return api.checkout({ body: input } as unknown as Parameters<typeof api.checkout>[0]);
    },

    async handleWebhook(input) {
      const ctx = await getContext();
      return handleWebhook(ctx, input);
    },

    get $context() {
      return getContext();
    },
  };

  Object.defineProperty(paykit, payKitInstanceSymbol, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return paykit;
}

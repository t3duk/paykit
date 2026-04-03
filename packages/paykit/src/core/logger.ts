import { AsyncLocalStorage } from "node:async_hooks";

import type { PayKitLogger } from "../types/options";
import { generateId } from "./utils";

interface TraceContext {
  traceId: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

export function getTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

const defaultConsoleLogger: PayKitLogger = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export interface PayKitInternalLogger extends PayKitLogger {
  trace: <T>(prefix: string, fn: () => T | Promise<T>) => T | Promise<T>;
}

export function createPayKitLogger(userLogger?: PayKitLogger): PayKitInternalLogger {
  const base = userLogger ?? defaultConsoleLogger;

  function prefix(): string {
    const traceId = getTraceId();
    return traceId ? `[${traceId}]` : "[paykit]";
  }

  return {
    debug(message, ...args) {
      base.debug(`${prefix()} ${message}`, ...args);
    },
    info(message, ...args) {
      base.info(`${prefix()} ${message}`, ...args);
    },
    warn(message, ...args) {
      base.warn(`${prefix()} ${message}`, ...args);
    },
    error(message, ...args) {
      base.error(`${prefix()} ${message}`, ...args);
    },
    trace(tracePrefix, fn) {
      const traceId = generateId(tracePrefix, 12);
      return storage.run({ traceId }, fn);
    },
  };
}

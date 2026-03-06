export { createPayKit } from "./core/create-paykit";

export type { PayKitOptions, ProviderId } from "./types/options";
export type { PayKitInstance, ScopedPayKitInstance, CustomerIdentity } from "./types/instance";
export type { DatabaseAdapter } from "./domain/ports/database";
export type { PayKitProvider } from "./domain/ports/provider";
export type { Customer, PaymentMethod } from "./types/models";
export type { NormalizedWebhookEvent, WebhookApplyAction } from "./types/events";

export { defineProvider } from "./domain/ports/provider";
export { PayKitError } from "./core/errors";

export type {
  CustomerEntitlement,
  CustomerSubscription,
  CustomerWithDetails,
  ListCustomersResult,
} from "../customer/customer.types";
import type { CustomerWithDetails, ListCustomersResult } from "../customer/customer.types";
import type { CheckResult, ReportResult } from "../entitlement/entitlement.service";
import type { Customer } from "./models";
import type { PayKitOptions } from "./options";
import type { FeatureIdFromPlans, PlanIdFromPlans } from "./schema";

type PlanIdFromOptions<TOptions extends PayKitOptions> = [
  PlanIdFromPlans<TOptions["plans"]>,
] extends [never]
  ? string
  : PlanIdFromPlans<TOptions["plans"]>;

type FeatureIdFromOptions<TOptions extends PayKitOptions> = [
  FeatureIdFromPlans<TOptions["plans"]>,
] extends [never]
  ? string
  : FeatureIdFromPlans<TOptions["plans"]>;

export type PayKitSubscribeInput<TOptions extends PayKitOptions = PayKitOptions> = {
  planId: PlanIdFromOptions<TOptions>;
  successUrl?: string;
  cancelUrl?: string;
  customerId?: string;
  forceCheckout?: boolean;
};

export interface PayKitSubscribeResult {
  invoice?: {
    currency: string;
    hostedUrl: string | null;
    providerInvoiceId: string;
    status: string | null;
    totalAmount: number;
  };
  paymentUrl: string | null;
  requiredAction?: {
    clientSecret?: string;
    paymentIntentId?: string;
    type: string;
  } | null;
}

type PayKitEndpoint<TPath extends string, TBody, TResult> = ((ctx: {
  body: TBody;
}) => Promise<TResult>) & {
  path: TPath;
  options: unknown;
};

export interface PayKitAPI<TOptions extends PayKitOptions = PayKitOptions> {
  subscribe: PayKitEndpoint<"/subscribe", PayKitSubscribeInput<TOptions>, PayKitSubscribeResult>;
  customerPortal: PayKitEndpoint<
    "/customer-portal",
    { returnUrl?: string; customerId?: string },
    { url: string }
  >;
}

export interface PayKitInstance<TOptions extends PayKitOptions = PayKitOptions> {
  options: TOptions;
  handler: (request: Request) => Promise<Response>;
  api: PayKitAPI<TOptions>;
  upsertCustomer(input: {
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Customer>;
  getCustomer(input: { id: string }): Promise<CustomerWithDetails | null>;
  deleteCustomer(input: { id: string }): Promise<{ success: true }>;
  listCustomers(input?: {
    limit?: number;
    offset?: number;
    planIds?: string[];
  }): Promise<ListCustomersResult>;
  subscribe(input: PayKitSubscribeInput<TOptions>): Promise<PayKitSubscribeResult>;
  check(input: {
    customerId: string;
    featureId: FeatureIdFromOptions<TOptions>;
    required?: number;
  }): Promise<CheckResult>;
  report(input: {
    customerId: string;
    featureId: FeatureIdFromOptions<TOptions>;
    amount?: number;
  }): Promise<ReportResult>;
  handleWebhook(input: {
    body: string;
    headers: Record<string, string>;
  }): Promise<{ received: true }>;
  $context: Promise<unknown>;
  $infer: {
    planId: PlanIdFromOptions<TOptions>;
    featureId: FeatureIdFromOptions<TOptions>;
  };
}

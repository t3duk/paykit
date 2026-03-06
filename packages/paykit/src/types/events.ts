export interface PayKitEvent {
  name: string;
  payload: Record<string, unknown>;
}

export interface UpsertCustomerAction {
  type: "customer.upsert";
  data: {
    referenceId: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  };
}

export interface DeleteCustomerAction {
  type: "customer.delete";
  data: {
    referenceId: string;
  };
}

export type WebhookApplyAction = UpsertCustomerAction | DeleteCustomerAction;

export interface NormalizedWebhookEvent {
  name: string;
  payload: Record<string, unknown>;
  actions?: WebhookApplyAction[];
}

export type PayKitEventHandler = (event: PayKitEvent) => Promise<void> | void;

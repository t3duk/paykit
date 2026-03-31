CREATE TABLE "paykit_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_customer_entitlement" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_product_id" text,
	"customer_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"unlimited" boolean DEFAULT false NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"next_reset_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_customer_price" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"customer_product_id" text NOT NULL,
	"price_id" text NOT NULL,
	"options" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_customer_product" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"product_internal_id" text NOT NULL,
	"subscription_id" text,
	"provider_id" text NOT NULL,
	"provider_checkout_session_id" text,
	"status" text NOT NULL,
	"canceled" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"trial_ends_at" timestamp,
	"current_period_start_at" timestamp,
	"current_period_end_at" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"scheduled_product_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_feature" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"subscription_id" text,
	"provider_id" text NOT NULL,
	"provider_invoice_id" text NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"total_amount" integer NOT NULL,
	"hosted_url" text,
	"period_start_at" timestamp,
	"period_end_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"provider_checkout_session_id" text,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"payment_method_id" text,
	"provider_id" text NOT NULL,
	"provider_payment_id" text NOT NULL,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_payment_method" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_method_id" text NOT NULL,
	"type" text NOT NULL,
	"last4" text,
	"expiry_month" integer,
	"expiry_year" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_product" (
	"internal_id" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"group" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_price" (
	"id" text PRIMARY KEY NOT NULL,
	"product_internal_id" text NOT NULL,
	"amount" integer NOT NULL,
	"interval" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_product_feature" (
	"product_internal_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"limit" integer,
	"reset_interval" text,
	"config" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "paykit_product_feature_product_internal_id_feature_id_pk" PRIMARY KEY("product_internal_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "paykit_provider_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_provider_product" (
	"product_internal_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_product_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "paykit_provider_product_product_internal_id_provider_id_pk" PRIMARY KEY("product_internal_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "paykit_provider_price" (
	"price_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_price_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "paykit_provider_price_price_id_provider_id_pk" PRIMARY KEY("price_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "paykit_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"customer_product_id" text,
	"provider_id" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"provider_subscription_schedule_id" text,
	"status" text NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start_at" timestamp,
	"current_period_end_at" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"trace_id" text,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "paykit_customer_entitlement" ADD CONSTRAINT "paykit_customer_entitlement_customer_product_id_paykit_customer_product_id_fk" FOREIGN KEY ("customer_product_id") REFERENCES "public"."paykit_customer_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_entitlement" ADD CONSTRAINT "paykit_customer_entitlement_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_entitlement" ADD CONSTRAINT "paykit_customer_entitlement_feature_id_paykit_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."paykit_feature"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_price" ADD CONSTRAINT "paykit_customer_price_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_price" ADD CONSTRAINT "paykit_customer_price_customer_product_id_paykit_customer_product_id_fk" FOREIGN KEY ("customer_product_id") REFERENCES "public"."paykit_customer_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_price" ADD CONSTRAINT "paykit_customer_price_price_id_paykit_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."paykit_price"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_product" ADD CONSTRAINT "paykit_customer_product_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_product" ADD CONSTRAINT "paykit_customer_product_product_internal_id_paykit_product_internal_id_fk" FOREIGN KEY ("product_internal_id") REFERENCES "public"."paykit_product"("internal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_invoice" ADD CONSTRAINT "paykit_invoice_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_invoice" ADD CONSTRAINT "paykit_invoice_subscription_id_paykit_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."paykit_subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_payment" ADD CONSTRAINT "paykit_payment_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_payment" ADD CONSTRAINT "paykit_payment_payment_method_id_paykit_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."paykit_payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD CONSTRAINT "paykit_payment_method_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_price" ADD CONSTRAINT "paykit_price_product_internal_id_paykit_product_internal_id_fk" FOREIGN KEY ("product_internal_id") REFERENCES "public"."paykit_product"("internal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_product_feature" ADD CONSTRAINT "paykit_product_feature_product_internal_id_paykit_product_internal_id_fk" FOREIGN KEY ("product_internal_id") REFERENCES "public"."paykit_product"("internal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_product_feature" ADD CONSTRAINT "paykit_product_feature_feature_id_paykit_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."paykit_feature"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_provider_customer" ADD CONSTRAINT "paykit_provider_customer_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_provider_product" ADD CONSTRAINT "paykit_provider_product_product_internal_id_paykit_product_internal_id_fk" FOREIGN KEY ("product_internal_id") REFERENCES "public"."paykit_product"("internal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_provider_price" ADD CONSTRAINT "paykit_provider_price_price_id_paykit_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."paykit_price"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_subscription" ADD CONSTRAINT "paykit_subscription_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_subscription" ADD CONSTRAINT "paykit_subscription_customer_product_id_paykit_customer_product_id_fk" FOREIGN KEY ("customer_product_id") REFERENCES "public"."paykit_customer_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paykit_customer_deleted_at_idx" ON "paykit_customer" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "paykit_customer_entitlement_customer_product_idx" ON "paykit_customer_entitlement" USING btree ("customer_product_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_entitlement_customer_feature_idx" ON "paykit_customer_entitlement" USING btree ("customer_id","feature_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_price_customer_product_idx" ON "paykit_customer_price" USING btree ("customer_product_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_price_price_idx" ON "paykit_customer_price" USING btree ("price_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_customer_product_checkout_session_unique" ON "paykit_customer_product" USING btree ("provider_id","provider_checkout_session_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_product_customer_status_idx" ON "paykit_customer_product" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "paykit_customer_product_subscription_idx" ON "paykit_customer_product" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_invoice_provider_unique" ON "paykit_invoice" USING btree ("provider_id","provider_invoice_id");--> statement-breakpoint
CREATE INDEX "paykit_invoice_customer_idx" ON "paykit_invoice" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "paykit_invoice_subscription_idx" ON "paykit_invoice" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_metadata_checkout_session_unique" ON "paykit_metadata" USING btree ("provider_id","provider_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_payment_provider_unique" ON "paykit_payment" USING btree ("provider_id","provider_payment_id");--> statement-breakpoint
CREATE INDEX "paykit_payment_customer_provider_idx" ON "paykit_payment" USING btree ("customer_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_payment_method_provider_unique" ON "paykit_payment_method" USING btree ("provider_id","provider_method_id");--> statement-breakpoint
CREATE INDEX "paykit_payment_method_customer_provider_idx" ON "paykit_payment_method" USING btree ("customer_id","provider_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_product_id_version_unique" ON "paykit_product" USING btree ("id","version");--> statement-breakpoint
CREATE INDEX "paykit_product_default_idx" ON "paykit_product" USING btree ("is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_price_product_internal_id_unique" ON "paykit_price" USING btree ("product_internal_id");--> statement-breakpoint
CREATE INDEX "paykit_price_interval_idx" ON "paykit_price" USING btree ("interval");--> statement-breakpoint
CREATE INDEX "paykit_product_feature_feature_idx" ON "paykit_product_feature" USING btree ("feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_provider_customer_customer_provider_unique" ON "paykit_provider_customer" USING btree ("customer_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_provider_customer_provider_customer_unique" ON "paykit_provider_customer" USING btree ("provider_id","provider_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_subscription_provider_unique" ON "paykit_subscription" USING btree ("provider_id","provider_subscription_id");--> statement-breakpoint
CREATE INDEX "paykit_subscription_customer_status_idx" ON "paykit_subscription" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "paykit_subscription_customer_product_idx" ON "paykit_subscription" USING btree ("customer_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_webhook_event_provider_unique" ON "paykit_webhook_event" USING btree ("provider_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "paykit_webhook_event_status_idx" ON "paykit_webhook_event" USING btree ("provider_id","status");
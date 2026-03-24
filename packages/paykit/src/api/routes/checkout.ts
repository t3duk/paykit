import * as z from "zod";

import { upsertProviderCustomer } from "../../services/customer-service";
import { getLatestProduct, getProviderProduct } from "../../services/product-service";
import { createPayKitEndpoint } from "../call";
import { resolveCustomer } from "../resolve-customer";

export const checkout = createPayKitEndpoint(
  "/checkout",
  {
    method: "POST",
    body: z.object({
      productId: z.string(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url().optional(),
      customerId: z.string().optional(),
    }),
  },
  async (ctx) => {
    const customerId = await resolveCustomer(ctx.context, ctx.request, ctx.body.customerId);

    const providerCust = await upsertProviderCustomer(ctx.context, { customerId });

    const storedProduct = await getLatestProduct(ctx.context.database, ctx.body.productId);
    if (!storedProduct) {
      throw ctx.error("NOT_FOUND", { message: `Product "${ctx.body.productId}" not found` });
    }

    const providerProd = await getProviderProduct(
      ctx.context.database,
      storedProduct.internalId,
      ctx.context.provider.id,
    );
    if (!providerProd) {
      throw ctx.error("NOT_FOUND", {
        message: `Product "${ctx.body.productId}" not synced. Run: paykitjs sync-products`,
      });
    }

    const result = await ctx.context.provider.checkout({
      providerCustomerId: providerCust.providerCustomerId,
      providerPriceId: providerProd.providerPriceId,
      mode: storedProduct.priceInterval ? "subscription" : "payment",
      successUrl: ctx.body.successUrl,
      cancelUrl: ctx.body.cancelUrl,
      metadata: { paykit_product_id: ctx.body.productId },
    });

    return { url: result.url };
  },
);

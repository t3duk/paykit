import { stripe } from "@paykitjs/stripe";
import { createPayKit, product } from "paykitjs";

import { env } from "@/env";
import { auth } from "@/server/auth";
import { pool } from "@/server/db";

export const starterPack = product({
  id: "starter_pack",
  name: "Starter Pack",
  price: { amount: 9.9 },
});

export const proMonthly = product({
  id: "pro_monthly",
  name: "Pro Monthly",
  price: { amount: 19.9, interval: "month" },
});

export const paykit = createPayKit({
  database: pool,
  provider: stripe({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  }),
  products: [starterPack, proMonthly],
  client: {
    identify: async (request) => {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) {
        throw new Error("Not authenticated");
      }
      return {
        customerId: session.user.id,
        email: session.user.email,
        name: session.user.name ?? undefined,
      };
    },
  },
});

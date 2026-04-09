<h3 align="center">
  <a name="readme-top"></a>
  <img
    src="landing/public/favicon/android-chrome-512x512.png"
    height="180"
  >
</h3>

<div align="center">
  <a href="https://www.npmjs.com/package/paykitjs">
    <img src="https://img.shields.io/npm/v/paykitjs.svg?style=flat&colorA=000000&colorB=000000" alt="npm version">
  </a>
  <a href="https://github.com/getpaykit/paykit/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/getpaykit/paykit?style=flat&colorA=000000&colorB=000000" alt="License">
  </a>
  <a href="https://github.com/getpaykit/paykit/stargazers">
    <img src="https://img.shields.io/github/stars/getpaykit/paykit?style=flat&colorA=000000&colorB=000000" alt="GitHub stars">
  </a>
</div>

<div>
  <p align="center">
    <a href="https://x.com/getpaykit">
      <img src="https://img.shields.io/badge/Follow%20on%20X-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X" />
    </a>
    <a href="https://discord.gg/nzy9NPpFNU">
      <img src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join our Discord" />
    </a>
  </p>
</div>

---

# PayKit

**The first billing framework for TypeScript.** Define plans in code, sync with Stripe, gate features, track usage. Open source and runs inside your app. [Learn more](https://paykit.sh).

---

## About the Project

PayKit is an embedded billing framework for TypeScript apps. It sits inside your app, uses your database, and gives you a single API to manage plans, subscriptions, entitlements, and usage billing without touching provider dashboards.

```ts
import { stripe } from "@paykitjs/stripe";
import { createPayKit, feature, plan } from "paykitjs";

const messages = feature({ id: "messages", type: "metered" });

const free = plan({
  id: "free",
  group: "base",
  default: true,
  includes: [messages({ limit: 100, reset: "month" })],
});

const pro = plan({
  id: "pro",
  group: "base",
  price: { amount: 19, interval: "month" },
  includes: [messages({ limit: 2_000, reset: "month" })],
});

export const paykit = createPayKit({
  provider: stripe({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
  database: process.env.DATABASE_URL!,
  plans: [free, pro],
});
```

### Getting started

```bash
npx paykitjs init
```

Or follow the [installation guide](https://paykit.sh/docs/get-started/installation).

### Why PayKit

Billing in the TypeScript ecosystem is either handled through low-level provider SDKs that require a lot of glue code, or through hosted platforms that own your billing data and sit between you and your customers. PayKit takes a different approach: it's an open-source framework that runs inside your app, keeps billing state in your own database, and handles the Stripe lifecycle so you don't have to.

## Contribution

PayKit is a free and open source project licensed under the [MIT License](./LICENSE). You are free to do whatever you want with it.

You can help continue its development by:

- [Contribute to the source code](./CONTRIBUTING.md)
- [Suggest new features and report issues](https://github.com/getpaykit/paykit/issues)

## Security

If you discover a security vulnerability within PayKit, please send an email to [security@paykit.sh](mailto:security@paykit.sh).

All reports will be promptly addressed, and you'll be credited accordingly.

import { describe, expect, it } from "vitest";

import { toNextJsHandler } from "../handlers/next-js";
import { createPayKit } from "../index";
import { memoryAdapter } from "../test-utils/memory-adapter";
import { mockProvider } from "../test-utils/mock-provider";

describe("paykit init", () => {
  it("should expose the MVP API shape", async () => {
    const paykit = createPayKit({
      database: memoryAdapter(),
      providers: [mockProvider()],
    });

    expect(typeof paykit.customer.sync).toBe("function");
    expect(typeof paykit.customer.get).toBe("function");
    expect(typeof paykit.customer.delete).toBe("function");

    expect(typeof paykit.checkout.create).toBe("function");

    expect(typeof paykit.paymentMethod.attach).toBe("function");
    expect(typeof paykit.paymentMethod.list).toBe("function");
    expect(typeof paykit.paymentMethod.setDefault).toBe("function");
    expect(typeof paykit.paymentMethod.detach).toBe("function");

    expect(typeof paykit.handleWebhook).toBe("function");
    expect(typeof paykit.asCustomer).toBe("function");

    const scoped = paykit.asCustomer({ referenceId: "user_1" });
    expect(typeof scoped.checkout.create).toBe("function");
    expect(typeof scoped.paymentMethod.attach).toBe("function");
  });

  it("should expose next handler factory", () => {
    const paykit = createPayKit({
      database: memoryAdapter(),
      providers: [mockProvider()],
    });

    const handlers = toNextJsHandler(paykit);
    expect(typeof handlers.GET).toBe("function");
    expect(typeof handlers.POST).toBe("function");
  });

  it("should initialize context", async () => {
    const paykit = createPayKit({
      database: memoryAdapter(),
      providers: [mockProvider()],
    });

    const context = await paykit.$context;
    expect(context).toBeDefined();
  });
});

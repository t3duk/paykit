import type { PayKitInstance } from "../../types/instance";

interface NextRouteContext {
  params?: { providerId?: string } | Promise<{ providerId?: string }>;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function extractProviderId(
  request: Request,
  context?: NextRouteContext,
): Promise<string | null> {
  if (context?.params) {
    const params = await context.params;
    if (params.providerId) {
      return params.providerId;
    }
  }

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  return segments[segments.length - 1] ?? null;
}

async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  return request.text();
}

export function toNextJsHandler(paykit: Pick<PayKitInstance, "handleWebhook">): {
  GET: (request: Request, context?: NextRouteContext) => Promise<Response>;
  POST: (request: Request, context?: NextRouteContext) => Promise<Response>;
} {
  const handle = async (request: Request, context?: NextRouteContext): Promise<Response> => {
    const providerId = await extractProviderId(request, context);
    if (!providerId) {
      return Response.json(
        {
          code: "INVALID_WEBHOOK_PROVIDER",
          message: "Missing provider ID in route",
        },
        { status: 400 },
      );
    }

    const body = await parseBody(request);
    const headers = headersToRecord(request.headers);

    try {
      const result = await paykit.handleWebhook({
        providerId,
        body,
        headers,
      });
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook failed";
      return Response.json(
        {
          code: "WEBHOOK_FAILED",
          message,
        },
        { status: 400 },
      );
    }
  };

  return {
    GET: handle,
    POST: handle,
  };
}

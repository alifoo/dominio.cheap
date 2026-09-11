import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";
import {
  checkRateLimit,
  rateLimitExceeded,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Accept, Content-Type, Last-Event-ID, MCP-Protocol-Version, MCP-Session-ID",
  "Access-Control-Expose-Headers":
    "MCP-Protocol-Version, MCP-Session-ID, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After",
};

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleMcpRequest(request: Request) {
  const rateLimit = checkRateLimit(request, {
    namespace: "mcp",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return withCors(rateLimitExceeded(rateLimit));
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(rateLimitHeaders(rateLimit))) {
    headers.set(name, value);
  }

  return withCors(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

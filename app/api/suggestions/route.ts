import {
  checkRateLimit,
  rateLimitExceeded,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getDomainSuggestions } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, {
    namespace: "suggestions",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) return rateLimitExceeded(rateLimit);

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await getDomainSuggestions(q);

  if (!suggestions) {
    return Response.json(
      { error: "Digite pelo menos dois caracteres válidos." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  return Response.json(
    { suggestions },
    { headers: rateLimitHeaders(rateLimit) },
  );
}

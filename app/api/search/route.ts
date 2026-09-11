import {
  checkRateLimit,
  rateLimitExceeded,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { searchDomain } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, {
    namespace: "search",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) return rateLimitExceeded(rateLimit);

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const result = await searchDomain(q);

  if (!result) {
    return Response.json(
      { error: "Escreve um domínio válido, tipo estudo.com ou estudo.com.br." },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }

  return Response.json(result, { headers: rateLimitHeaders(rateLimit) });
}

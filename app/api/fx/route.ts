import { getFx } from "@/lib/fx";
import {
  checkRateLimit,
  rateLimitExceeded,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, {
    namespace: "fx",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) return rateLimitExceeded(rateLimit);

  const fx = await getFx();
  return Response.json(fx, { headers: rateLimitHeaders(rateLimit) });
}

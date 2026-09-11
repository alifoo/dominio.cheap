type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const globalRateLimit = globalThis as typeof globalThis & {
  dominioRateLimits?: Map<string, RateLimitEntry>;
};

const entries =
  globalRateLimit.dominioRateLimits ??
  (globalRateLimit.dominioRateLimits = new Map<string, RateLimitEntry>());

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    forwarded?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function removeExpiredEntries(now: number) {
  if (entries.size < 1_000) return;

  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}

export function checkRateLimit(
  request: Request,
  { namespace, limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  removeExpiredEntries(now);

  const key = `${namespace}:${clientAddress(request)}`;
  const current = entries.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

  entry.count += 1;
  entries.set(key, entry);

  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  const resetSeconds = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1_000),
  );

  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(resetSeconds),
    ...(result.allowed ? {} : { "Retry-After": String(resetSeconds) }),
  };
}

export function rateLimitExceeded(result: RateLimitResult) {
  return Response.json(
    { error: "Muitas consultas. Aguarde um pouco e tente novamente." },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}

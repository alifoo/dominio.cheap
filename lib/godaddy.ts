import snapshot from "@/data/godaddy-prices.json";
import { splitDomain } from "@/lib/domain";

type GoDaddyRow = {
  first: number;
  renew: number;
  termYears: number;
};

const FALLBACK = snapshot as Record<string, GoDaddyRow>;
const priceCache: Record<string, GoDaddyRow> = { ...FALLBACK };
const availabilityCache = new Map<
  string,
  { at: number; result: GoDaddyAvailability }
>();

export type GoDaddyAvailability = {
  name: string;
  available: boolean | null;
  premium: boolean;
  inventoryType: string | null;
};

function parseSseJson(raw: string): unknown {
  const line = raw
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row.startsWith("data:"));
  const payload = line ? line.slice(5).trim() : raw.trim();
  return JSON.parse(payload);
}

export async function godaddyAvailability(
  domains: string[],
): Promise<Map<string, GoDaddyAvailability>> {
  const normalized = [...new Set(domains.map((domain) => domain.toLowerCase()))];
  const results = new Map<string, GoDaddyAvailability>();
  const missing: string[] = [];
  const now = Date.now();

  for (const domain of normalized) {
    const cached = availabilityCache.get(domain);
    if (cached && now - cached.at < 5 * 60 * 1000) {
      results.set(domain, cached.result);
    } else {
      missing.push(domain);
    }
  }

  if (missing.length === 0) return results;
  if (missing.length > 1) {
    const batches = await Promise.all(
      missing.map((domain) => godaddyAvailability([domain])),
    );
    for (const batch of batches) {
      for (const [domain, result] of batch) results.set(domain, result);
    }
    return results;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.godaddy.com/v1/domains/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "domains_check_availability",
          arguments: { domains: missing.join(", ") },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return results;
    const json = parseSseJson(await response.text()) as {
      result?: {
        structuredContent?: {
          isAvailable?: boolean;
          domains?: {
            name?: string;
            available?: boolean;
            inventoryType?: string;
          }[];
        };
      };
    };
    const rows = json.result?.structuredContent?.domains ?? [];

    for (const row of rows) {
      const name = row.name?.toLowerCase();
      if (!name || !normalized.includes(name)) continue;

      const inventoryType = row.inventoryType ?? null;
      const result: GoDaddyAvailability = {
        name,
        available:
          typeof row.available === "boolean" ? row.available : null,
        premium: inventoryType?.toLowerCase().includes("premium") ?? false,
        inventoryType,
      };
      availabilityCache.set(name, { at: now, result });
      results.set(name, result);
    }

    const requested = missing[0];
    const isAvailable = json.result?.structuredContent?.isAvailable;
    if (
      requested &&
      !results.has(requested) &&
      typeof isAvailable === "boolean"
    ) {
      const result: GoDaddyAvailability = {
        name: requested,
        available: isAvailable,
        premium: false,
        inventoryType: null,
      };
      availabilityCache.set(requested, { at: now, result });
      results.set(requested, result);
    }

    return results;
  } catch {
    return results;
  } finally {
    clearTimeout(timer);
  }
}

function parseTldMarkdown(text: string): GoDaddyRow | null {
  const promo = text.match(/~~\$([0-9.]+)~~\$([0-9.]+)\/1st yr/);
  const extra = text.match(/Additional year\(s\) \$([0-9.]+)/);
  const threeYear = /3-year purchase required/i.test(text);
  if (promo) {
    const list = Number(promo[1]);
    const first = Number(promo[2]);
    return {
      first,
      renew: extra ? Number(extra[1]) : list,
      termYears: threeYear ? 3 : 1,
    };
  }
  if (extra) {
    const renew = Number(extra[1]);
    return { first: renew, renew, termYears: 1 };
  }
  return null;
}

async function tldPrice(tld: string): Promise<GoDaddyRow | null> {
  if (priceCache[tld]) return priceCache[tld];

  const slug = tld.replaceAll(".", "-");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(
      `https://r.jina.ai/https://www.godaddy.com/tlds/${slug}-domain`,
      {
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0" },
        next: { revalidate: 21600 },
      },
    );
    if (!response.ok) return FALLBACK[tld] ?? null;
    const row = parseTldMarkdown(await response.text());
    if (row) {
      priceCache[tld] = row;
      return row;
    }
    return FALLBACK[tld] ?? null;
  } catch {
    return FALLBACK[tld] ?? null;
  } finally {
    clearTimeout(timer);
  }
}

export async function godaddyQuote(domain: string) {
  const { tld } = splitDomain(domain);
  const [availability, prices] = await Promise.all([
    godaddyAvailability([domain]),
    tldPrice(tld),
  ]);
  const domainStatus = availability.get(domain.toLowerCase());
  const available = domainStatus?.available ?? null;
  const premium = domainStatus?.premium ?? false;

  const buyUrl = `https://www.godaddy.com/pt-br/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(domain)}`;

  if (!prices || premium) {
    return {
      id: "godaddy",
      name: "GoDaddy",
      register: null,
      renew: null,
      transfer: null,
      currency: "USD" as const,
      usd: null,
      live: available === true,
      buyUrl,
      premium,
      note:
        premium
          ? "domínio premium · consulte o preço exato"
          : available === true
          ? "disponível · preço só na loja"
          : available === false
            ? "não disponível para registro"
            : "abrir loja",
    };
  }

  const multiYear = prices.termYears > 1;
  const register = available === false ? null : multiYear ? prices.renew : prices.first;

  return {
    id: "godaddy",
    name: "GoDaddy",
    register,
    renew: prices.renew,
    transfer: prices.renew,
    currency: "USD" as const,
    usd: register,
    live: true,
    buyUrl,
    premium,
    note: multiYear
      ? `1 ano US$ ${prices.renew.toFixed(2)} · promo US$ ${prices.first.toFixed(2)} no 1º ano com ${prices.termYears} anos`
      : available === false
        ? "não disponível para registro"
        : "preço de TLD",
  };
}

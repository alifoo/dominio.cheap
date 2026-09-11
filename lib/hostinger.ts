import snapshot from "@/data/hostinger-prices.json";
import { splitDomain } from "@/lib/domain";

type HostingerRow = {
  register: number | null;
  renew: number | null;
  currency: "BRL";
};

const FALLBACK = snapshot as Record<string, HostingerRow>;
const PAGE = "https://www.hostinger.com/br/registro-de-dominio";

let cache: { at: number; prices: Record<string, HostingerRow> } | null = null;

function asPrice(value: unknown): number | null {
  if (typeof value === "boolean" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseHostingerPrices(html: string): Record<string, HostingerRow> {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(
    (match) => match[1] ?? "",
  );
  const payload = scripts.sort((a, b) => b.length - a.length)[0] ?? html;
  const values = new Map<number, number | boolean>();

  for (const match of payload.matchAll(/"class":(\d+)/g)) {
    values.set(Number(match[1]), true);
  }

  const prices: Record<string, HostingerRow> = {};

  for (const match of payload.matchAll(/"domain:\.([a-z0-9.]+)"/g)) {
    const tld = match[1];
    if (!tld) continue;
    const start = match.index ?? 0;
    const chunk = payload.slice(start, start + 500);
    const schema = chunk.match(
      /\{"old":(\d+),"purchase":(\d+),"firstYearPrice":(\d+),"discount":(\d+)\}/,
    );
    if (!schema) continue;

    const ids = {
      old: Number(schema[1]),
      purchase: Number(schema[2]),
      firstYear: Number(schema[3]),
      discount: Number(schema[4]),
    };
    const after = chunk.slice((schema.index ?? 0) + schema[0].length);
    let cut = after.length;
    for (const marker of ['{"productSlug"', '"mainTlds"', '"domain:.']) {
      const at = after.indexOf(marker);
      if (at >= 0) cut = Math.min(cut, at);
    }

    const nums = [...after.slice(0, cut).matchAll(/\d+(?:\.\d+)?/g)].map((token) =>
      token[0].includes(".") ? Number(token[0]) : Number.parseInt(token[0], 10),
    );

    const unknown: number[] = [];
    const seen = new Set<number>();
    for (const id of [ids.old, ids.purchase, ids.firstYear, ids.discount]) {
      if (!values.has(id) && !seen.has(id)) {
        unknown.push(id);
        seen.add(id);
      }
    }

    unknown.forEach((id, index) => {
      if (index < nums.length) values.set(id, nums[index]);
    });

    prices[tld] = {
      register: asPrice(values.get(ids.purchase)),
      renew: asPrice(values.get(ids.old)),
      currency: "BRL",
    };
  }

  return Object.keys(prices).length > 0 ? prices : FALLBACK;
}

export async function hostingerPrices(): Promise<Record<string, HostingerRow>> {
  if (cache && Date.now() - cache.at < 6 * 60 * 60 * 1000) {
    return cache.prices;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(PAGE, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9",
      },
      next: { revalidate: 21600 },
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error("hostinger page failed");
    const prices = parseHostingerPrices(await response.text());
    cache = { at: Date.now(), prices };
    return prices;
  } catch {
    cache = { at: Date.now(), prices: FALLBACK };
    return FALLBACK;
  }
}

export async function hostingerQuote(domain: string) {
  const { tld } = splitDomain(domain);
  const prices = await hostingerPrices();
  const row = prices[tld];
  return {
    id: "hostinger",
    name: "Hostinger",
    register: row?.register ?? null,
    renew: row?.renew ?? null,
    transfer: null,
    currency: "BRL" as const,
    usd: null,
    live: Boolean(row?.register != null || row?.renew != null),
    buyUrl: `https://www.hostinger.com/br/registro-de-dominio?domain=${encodeURIComponent(domain)}`,
    note: row ? "promo 1º ano · BRL" : "abrir loja",
  };
}

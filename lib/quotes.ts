import ovhCatalog from "@/data/ovh-prices.json";
import { splitDomain } from "@/lib/domain";
import { getFx, toBrl, type Fx } from "@/lib/fx";
import { godaddyQuote } from "@/lib/godaddy";
import { hostingerQuote } from "@/lib/hostinger";

const BR_ORDER = [
  "hostinger",
  "godaddy",
  "registrobr",
  "locaweb",
  "hostgator",
  "namecheap",
  "vercel",
  "cloudflare",
  "porkbun",
  "ovh",
];

export type Currency = "USD" | "EUR" | "BRL";

export type Quote = {
  id: string;
  name: string;
  register: number | null;
  renew: number | null;
  transfer: number | null;
  currency: "BRL";
  originalCurrency: Currency;
  originalRegister: number | null;
  originalRenew: number | null;
  originalTransfer: number | null;
  brl: number | null;
  live: boolean;
  buyUrl: string;
  note?: string;
};

type SourceQuote = {
  id: string;
  name: string;
  register: number | null;
  renew: number | null;
  transfer: number | null;
  currency: Currency;
  usd?: number | null;
  live: boolean;
  buyUrl: string;
  note?: string;
  premium?: boolean;
};

type OvHEntry = {
  register: number;
  renew: number | null;
  transfer: number | null;
  currency: "EUR";
};

const OVH_PRICES = ovhCatalog as Record<string, OvHEntry>;

const BR_TLDS = new Set([
  "br",
  "com.br",
  "net.br",
  "org.br",
  "art.br",
  "blog.br",
  "eco.br",
  "emp.br",
  "log.br",
  "tmp.br",
  "adv.br",
  "eng.br",
  "eti.br",
  "nom.br",
  "tv.br",
]);

type PorkbunPricing = Record<
  string,
  { registration: string; renewal: string; transfer: string }
>;

let porkbunCache: { at: number; pricing: PorkbunPricing } | null = null;

function money(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function porkbunPricing(): Promise<PorkbunPricing> {
  if (porkbunCache && Date.now() - porkbunCache.at < 6 * 60 * 60 * 1000) {
    return porkbunCache.pricing;
  }

  const response = await fetch("https://api.porkbun.com/api/json/v3/pricing/get", {
    next: { revalidate: 21600 },
  });
  if (!response.ok) throw new Error("porkbun pricing failed");
  const json = (await response.json()) as {
    status?: string;
    pricing?: PorkbunPricing;
  };
  if (json.status !== "SUCCESS" || !json.pricing) {
    throw new Error("porkbun pricing empty");
  }
  porkbunCache = { at: Date.now(), pricing: json.pricing };
  return json.pricing;
}

async function vercelQuote(domain: string): Promise<SourceQuote | null> {
  const token = process.env.VERCEL_TOKEN ?? process.env.VERCEL_ACCESS_TOKEN;
  if (!token) {
    return {
      id: "vercel",
      name: "Vercel",
      register: null,
      renew: null,
      transfer: null,
      currency: "USD",
      usd: null,
      live: true,
      buyUrl: `https://vercel.com/domains/search?q=${encodeURIComponent(domain)}`,
      note: "defina VERCEL_TOKEN para cotar ao vivo",
    };
  }

  const timeout = withTimeout(12000);
  try {
    const priceRes = await fetch(
      `https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}/price?years=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: timeout.signal,
        cache: "no-store",
      },
    );

    if (priceRes.status === 401 || priceRes.status === 403) {
      throw new Error("vercel unauthorized");
    }

    const priceJson = (await priceRes.json()) as {
      purchasePrice?: number | string | null;
      renewalPrice?: number | string | null;
      transferPrice?: number | string | null;
      error?: { code?: string };
    };

    if (!priceRes.ok) {
      return {
        id: "vercel",
        name: "Vercel",
        register: null,
        renew: null,
        transfer: null,
        currency: "USD",
        usd: null,
        live: true,
        buyUrl: `https://vercel.com/domains/search?q=${encodeURIComponent(domain)}`,
        note:
          priceJson.error?.code === "tld_not_supported"
            ? "TLD não suportado na Vercel"
            : "sem cotação neste TLD",
      };
    }

    const register = money(priceJson.purchasePrice);
    const renew = money(priceJson.renewalPrice);
    const transfer = money(priceJson.transferPrice);

    return {
      id: "vercel",
      name: "Vercel",
      register,
      renew,
      transfer,
      currency: "USD",
      usd: register ?? transfer ?? renew,
      live: true,
      buyUrl: `https://vercel.com/domains/search?q=${encodeURIComponent(domain)}`,
      note: register == null ? "não disponível para registro" : undefined,
    };
  } catch {
    return {
      id: "vercel",
      name: "Vercel",
      register: null,
      renew: null,
      transfer: null,
      currency: "USD",
      usd: null,
      live: true,
      buyUrl: `https://vercel.com/domains/search?q=${encodeURIComponent(domain)}`,
      note: "cotação indisponível agora",
    };
  } finally {
    timeout.done();
  }
}

async function porkbunQuote(domain: string): Promise<SourceQuote | null> {
  try {
    const { tld } = splitDomain(domain);
    const pricing = await porkbunPricing();
    const row = pricing[tld];
    if (!row) return null;

    const register = money(row.registration);
    return {
      id: "porkbun",
      name: "Porkbun",
      register,
      renew: money(row.renewal),
      transfer: money(row.transfer),
      currency: "USD",
      usd: register,
      live: true,
      buyUrl: `https://porkbun.com/checkout/search?q=${encodeURIComponent(domain)}`,
      note: "preço de TLD padrão",
    };
  } catch {
    return null;
  }
}

function ovhQuote(domain: string): SourceQuote | null {
  const { tld } = splitDomain(domain);
  const row = OVH_PRICES[tld];
  if (!row) return null;
  return {
    id: "ovh",
    name: "OVHcloud",
    register: row.register,
    renew: row.renew,
    transfer: row.transfer,
    currency: "EUR",
    usd: null,
    live: true,
    buyUrl: `https://www.ovhcloud.com/en/domains/domain-name-availability/?domain=${encodeURIComponent(domain)}`,
    note: "catálogo público · EUR",
  };
}

function registroBrQuote(domain: string): SourceQuote | null {
  const { tld } = splitDomain(domain);
  if (!BR_TLDS.has(tld) && !tld.endsWith(".br") && tld !== "br") return null;
  if (!tld.endsWith("br")) return null;

  return {
    id: "registrobr",
    name: "Registro.br",
    register: 40,
    renew: 40,
    transfer: null,
    currency: "BRL",
    usd: null,
    live: true,
    buyUrl: `https://registro.br/`,
    note: "preço oficial .br · R$ 40/ano",
  };
}

function storefronts(domain: string): SourceQuote[] {
  const encoded = encodeURIComponent(domain);
  return [
    {
      id: "godaddy",
      name: "GoDaddy",
      register: null,
      renew: null,
      transfer: null,
      currency: "USD",
      usd: null,
      live: false,
      buyUrl: `https://www.godaddy.com/pt-br/domainsearch/find?checkAvail=1&domainToCheck=${encoded}`,
    },
    {
      id: "locaweb",
      name: "Locaweb",
      register: null,
      renew: null,
      transfer: null,
      currency: "BRL",
      usd: null,
      live: false,
      buyUrl: `https://www.locaweb.com.br/registro-de-dominio-web/`,
    },
    {
      id: "hostgator",
      name: "HostGator",
      register: null,
      renew: null,
      transfer: null,
      currency: "BRL",
      usd: null,
      live: false,
      buyUrl: `https://www.hostgator.com.br/registro-de-dominio?dominio=${encoded}`,
    },
    {
      id: "namecheap",
      name: "Namecheap",
      register: null,
      renew: null,
      transfer: null,
      currency: "USD",
      usd: null,
      live: false,
      buyUrl: `https://www.namecheap.com/domains/registration/results/?domain=${encoded}`,
    },
    {
      id: "cloudflare",
      name: "Cloudflare",
      register: null,
      renew: null,
      transfer: null,
      currency: "USD",
      usd: null,
      live: false,
      buyUrl: "https://www.cloudflare.com/products/registrar/",
      note: "at-cost, sem markup",
    },
  ];
}

export async function collectQuotes(
  domain: string,
): Promise<{ quotes: Quote[]; fx: Fx }> {
  const fx = await getFx();
  const quotePromises: Promise<SourceQuote | null>[] = [
    hostingerQuote(domain),
    godaddyQuote(domain),
    vercelQuote(domain),
    porkbunQuote(domain),
    Promise.resolve(ovhQuote(domain)),
    Promise.resolve(registroBrQuote(domain)),
  ];
  const settled = await Promise.allSettled(quotePromises);
  const premium = settled.some(
    (result) =>
      result.status === "fulfilled" &&
      result.value?.id === "godaddy" &&
      result.value.premium === true,
  );
  const estimatedPriceIds = new Set(["hostinger", "godaddy", "porkbun", "ovh"]);

  const byId = new Map<string, SourceQuote>();
  for (const quote of storefronts(domain)) {
    byId.set(quote.id, quote);
  }
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      const quote = result.value;
      byId.set(
        quote.id,
        premium && estimatedPriceIds.has(quote.id)
          ? {
              ...quote,
              register: null,
              renew: null,
              transfer: null,
              usd: null,
              note: "domínio premium · consulte o preço exato",
            }
          : quote,
      );
    }
  }

  const quotes: Quote[] = [...byId.values()].map((quote) => {
    const register = toBrl(quote.register, quote.currency, fx);
    return {
      id: quote.id,
      name: quote.name,
      register,
      renew: toBrl(quote.renew, quote.currency, fx),
      transfer: toBrl(quote.transfer, quote.currency, fx),
      currency: "BRL",
      originalCurrency: quote.currency,
      originalRegister: quote.register,
      originalRenew: quote.renew,
      originalTransfer: quote.transfer,
      brl: register,
      live: quote.live,
      buyUrl: quote.buyUrl,
      note: quote.note,
    };
  });

  quotes.sort((a, b) => {
    const aRank = BR_ORDER.indexOf(a.id);
    const bRank = BR_ORDER.indexOf(b.id);
    const aPos = aRank === -1 ? BR_ORDER.length : aRank;
    const bPos = bRank === -1 ? BR_ORDER.length : bRank;
    if (aPos !== bPos) return aPos - bPos;
    return 0;
  });

  return { quotes, fx };
}

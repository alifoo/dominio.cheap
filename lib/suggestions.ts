import godaddyCatalog from "@/data/godaddy-prices.json";
import hostingerCatalog from "@/data/hostinger-prices.json";
import ovhCatalog from "@/data/ovh-prices.json";
import { getFx, toBrl } from "@/lib/fx";
import { godaddyAvailability } from "@/lib/godaddy";
import type { Currency } from "@/lib/quotes";

const DISCOVERY_TLDS = [
  "com",
  "com.br",
  "net",
  "org",
  "dev",
  "app",
  "shop",
  "cloud",
  "xyz",
  "pro",
  "io",
  "ai",
];

type PriceCandidate = {
  registrar: string;
  amount: number;
  currency: Currency;
};

type HostingerRow = {
  register: number | null;
  renew: number | null;
  currency: "BRL";
};

type GoDaddyRow = {
  first: number;
  renew: number;
  termYears: number;
};

type OvhRow = {
  register: number;
  renew: number | null;
  transfer: number | null;
  currency: "EUR";
};

const HOSTINGER = hostingerCatalog as Record<string, HostingerRow>;
const GODADDY = godaddyCatalog as Record<string, GoDaddyRow>;
const OVH = ovhCatalog as Record<string, OvhRow>;

export type DomainSuggestion = {
  domain: string;
  register: number;
  registrar: string;
  available: boolean | null;
};

function normalizeSuggestionName(raw: string) {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split(/[/?#]/)[0] ?? "";

  const name = value.split(".")[0] ?? "";
  if (name.length < 2 || name.length > 63) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) return null;
  return name;
}

function candidatesFor(tld: string): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  const hostinger = HOSTINGER[tld];
  const godaddy = GODADDY[tld];
  const ovh = OVH[tld];

  if (hostinger?.register != null) {
    candidates.push({
      registrar: "Hostinger",
      amount: hostinger.register,
      currency: "BRL",
    });
  }

  if (godaddy) {
    candidates.push({
      registrar: "GoDaddy",
      amount: godaddy.termYears > 1 ? godaddy.renew : godaddy.first,
      currency: "USD",
    });
  }

  if (ovh) {
    candidates.push({
      registrar: "OVHcloud",
      amount: ovh.register,
      currency: "EUR",
    });
  }

  if (tld.endsWith("br")) {
    candidates.push({
      registrar: "Registro.br",
      amount: 40,
      currency: "BRL",
    });
  }

  return candidates;
}

export async function getDomainSuggestions(
  raw: string,
): Promise<DomainSuggestion[] | null> {
  const name = normalizeSuggestionName(raw);
  if (!name) return null;

  const domains = DISCOVERY_TLDS.map((tld) => `${name}.${tld}`);
  const [fx, availability] = await Promise.all([
    getFx(),
    godaddyAvailability(domains),
  ]);
  const suggestions = DISCOVERY_TLDS.flatMap((tld) => {
    const domain = `${name}.${tld}`;
    const status = availability.get(domain);
    if (status?.available === false || status?.premium) return [];

    const priced = candidatesFor(tld)
      .map((candidate) => ({
        registrar: candidate.registrar,
        register: toBrl(candidate.amount, candidate.currency, fx),
      }))
      .filter(
        (candidate): candidate is { registrar: string; register: number } =>
          candidate.register != null,
      )
      .sort((a, b) => a.register - b.register);
    const cheapest = priced[0];

    return cheapest
      ? [
          {
            domain,
            register: cheapest.register,
            registrar: cheapest.registrar,
            available: status?.available ?? null,
          },
        ]
      : [];
  });

  return suggestions
    .sort((a, b) => a.register - b.register)
    .slice(0, 6);
}

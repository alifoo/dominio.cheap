import { normalizeDomain } from "@/lib/domain";
import { dnsAvailable } from "@/lib/dns";
import { collectQuotes, type Quote } from "@/lib/quotes";
import { isAvailable } from "@/lib/rdap";
import type { Fx } from "@/lib/fx";

export type DomainSearchResult = {
  domain: string;
  available: boolean | null;
  cheapest: string | null;
  quotes: Quote[];
  fx: Fx;
};

function mergeAvailability(rdap: boolean | null, dns: boolean | null) {
  if (rdap === false || dns === false) return false;
  if (rdap === true || dns === true) return true;
  return null;
}

export async function searchDomain(
  rawDomain: string,
): Promise<DomainSearchResult | null> {
  const domain = normalizeDomain(rawDomain);
  if (!domain) return null;

  const [rdap, dns, bundle] = await Promise.all([
    isAvailable(domain),
    dnsAvailable(domain),
    collectQuotes(domain),
  ]);

  const available = mergeAvailability(rdap, dns);
  const quotes =
    available === false
      ? bundle.quotes.map((quote) => ({
          ...quote,
          register: null,
          renew: null,
          transfer: null,
          originalRegister: null,
          originalRenew: null,
          originalTransfer: null,
          brl: null,
          note: undefined,
        }))
      : bundle.quotes;
  const priced = quotes
    .filter((quote) => quote.brl != null)
    .slice()
    .sort((a, b) => (a.brl ?? Infinity) - (b.brl ?? Infinity));

  return {
    domain,
    available,
    cheapest: available === false ? null : (priced[0]?.id ?? null),
    quotes,
    fx: bundle.fx,
  };
}

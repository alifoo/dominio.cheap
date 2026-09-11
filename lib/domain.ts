const MULTI_TLDS = [
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
  "co.uk",
  "org.uk",
  "co.jp",
  "com.au",
  "co.nz",
  "co.in",
];

export function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split(/[/?#]/)[0] ?? "";
  value = value.replace(/\.+$/, "");

  if (!value) return null;
  if (value.length > 253) return null;

  if (!value.includes(".")) {
    value = `${value}.com`;
  }

  const labels = value.split(".");
  if (labels.some((label) => !label || label.length > 63)) return null;
  if (!/^[a-z0-9.-]+$/.test(value)) return null;

  return value;
}

export function splitDomain(domain: string): { sld: string; tld: string } {
  const lower = domain.toLowerCase();
  const match = MULTI_TLDS.find((suffix) => lower.endsWith(`.${suffix}`));
  if (match) {
    return {
      sld: lower.slice(0, -(match.length + 1)),
      tld: match,
    };
  }

  const dot = lower.lastIndexOf(".");
  return {
    sld: lower.slice(0, dot),
    tld: lower.slice(dot + 1),
  };
}

export function withTld(domain: string, tld: string): string {
  return `${splitDomain(domain).sld}.${tld}`;
}

export const SUGGESTED_TLDS = [
  "com",
  "com.br",
  "io",
  "dev",
  "app",
  "ai",
  "net",
  "org",
];

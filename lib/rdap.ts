const SERVERS: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
  org: "https://rdap.publicinterestregistry.org/rdap/domain/",
  br: "https://rdap.registro.br/domain/",
  "com.br": "https://rdap.registro.br/domain/",
  "net.br": "https://rdap.registro.br/domain/",
  "org.br": "https://rdap.registro.br/domain/",
  io: "https://rdap.identitydigital.services/rdap/domain/",
  app: "https://rdap.nic.google/domain/",
  dev: "https://rdap.nic.google/domain/",
  ai: "https://rdap.identitydigital.services/rdap/domain/",
};

function serverFor(domain: string): string {
  const parts = domain.split(".");
  const tld = parts.at(-1) ?? "";
  const dual = parts.slice(-2).join(".");
  const base = SERVERS[dual] ?? SERVERS[tld];
  if (base) return `${base}${domain}`;
  return `https://rdap.org/domain/${domain}`;
}

export async function isAvailable(domain: string): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(serverFor(domain), {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "application/rdap+json, application/json" },
      cache: "no-store",
    });

    if (response.status === 404) return true;
    if (response.ok) return false;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

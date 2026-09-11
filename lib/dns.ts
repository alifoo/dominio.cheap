export async function dnsAvailable(domain: string): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=NS`,
      { signal: controller.signal, cache: "no-store" },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as {
      Status?: number;
      Answer?: unknown[];
    };
    if (json.Status === 3) return true;
    if (json.Status === 0 && (json.Answer?.length ?? 0) > 0) return false;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

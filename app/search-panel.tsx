"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SUGGESTED_TLDS, splitDomain, withTld } from "@/lib/domain";
import type { Fx } from "@/lib/fx";
import type { Quote } from "@/lib/quotes";

type SearchResponse = {
  domain: string;
  available: boolean | null;
  cheapest: string | null;
  quotes: Quote[];
  fx?: Fx;
  error?: string;
};

type DomainSuggestion = {
  domain: string;
  register: number;
  registrar: string;
  available: boolean | null;
};

type SuggestionsResponse = {
  suggestions?: DomainSuggestion[];
  error?: string;
};

function formatBrl(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatOriginal(
  value: number | null,
  currency: Quote["originalCurrency"] | undefined,
) {
  if (value == null || !currency || currency === "BRL") return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function RateStrip({ fx }: { fx: Fx }) {
  return (
    <div className="border border-line bg-paper px-4 py-3 font-mono text-xs leading-relaxed text-muted">
      <p>
        Dólar comercial hoje: <span className="text-ink">US$ 1 = {formatRate(fx.usdBrl)}</span>
        <span className="mx-2 text-line">·</span>
        Euro: <span className="text-ink">€ 1 = {formatRate(fx.eurBrl)}</span>
      </p>
      <p className="mt-1">
        {fx.source} · {formatWhen(fx.at)}. Preços em dólar e euro são convertidos
        por essa taxa.
      </p>
    </div>
  );
}

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsReady, setSuggestionsReady] = useState(false);

  useEffect(() => {
    void fetch("/api/fx")
      .then((response) => response.json())
      .then((json: Fx) => setFx(json))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || loading || result) return;

    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      setSuggestionsLoading(true);
      setSuggestionsReady(false);

      void fetch(`/api/suggestions?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const json = (await response.json()) as SuggestionsResponse;
          if (!active) return;

          if (!response.ok) {
            setSuggestions([]);
            setSuggestionsReady(false);
            setSuggestionsError(
              response.status === 429 ? (json.error ?? null) : null,
            );
            return;
          }

          setSuggestions(json.suggestions ?? []);
          setSuggestionsReady(true);
          setSuggestionsError(null);
        })
        .catch((fetchError: unknown) => {
          if (
            active &&
            !(
              fetchError instanceof DOMException &&
              fetchError.name === "AbortError"
            )
          ) {
            setSuggestions([]);
            setSuggestionsReady(false);
            setSuggestionsError("Não deu para calcular as sugestões agora.");
          }
        })
        .finally(() => {
          if (active) setSuggestionsLoading(false);
        });
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loading, query, result]);

  const activeTld = useMemo(() => {
    const value = (result?.domain || query).trim().toLowerCase();
    if (!value.includes(".")) return "com";
    return splitDomain(value.includes(".") ? value : `${value}.com`).tld;
  }, [query, result]);

  async function runSearch(raw: string) {
    const next = raw.trim();
    if (!next) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSuggestionsError(null);
    setSuggestionsReady(false);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(next)}`);
      const json = (await response.json()) as SearchResponse;
      if (!response.ok) {
        setResult(null);
        setError(json.error ?? "Não deu para buscar esse nome.");
        return;
      }
      setQuery(json.domain);
      setResult(json);
      if (json.fx) setFx(json.fx);
    } catch {
      setResult(null);
      setError("A busca falhou. Tenta de novo em alguns segundos.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      {fx && result?.available !== false ? <RateStrip fx={fx} /> : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label htmlFor="domain" className="sr-only">
          Domínio
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            id="domain"
            name="domain"
            type="search"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="seudominio.com"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResult(null);
              setSuggestions([]);
              setSuggestionsLoading(false);
              setSuggestionsError(null);
              setSuggestionsReady(false);
            }}
            className="min-h-16 flex-1 border border-ink bg-paper px-4 font-mono text-2xl text-ink outline-none placeholder:text-muted/60 focus:border-signal sm:text-3xl"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="min-h-16 bg-signal px-8 font-display text-lg font-semibold text-signal-ink disabled:opacity-50"
          >
            {loading ? "Buscando…" : "Comparar"}
          </button>
        </div>
        {suggestionsLoading ||
        suggestionsReady ||
        suggestions.length > 0 ||
        suggestionsError ? (
          <div
            className="border border-line bg-paper p-4"
            aria-live="polite"
            aria-busy={suggestionsLoading}
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-sm font-semibold">
                mais baratos para esse nome
              </p>
              <p className="font-mono text-xs text-muted">
                preço-base do 1º ano · premium pode custar mais
              </p>
            </div>
            {suggestionsLoading ? (
              <p className="font-mono text-sm text-muted">
                calculando melhores extensões…
              </p>
            ) : suggestionsError ? (
              <p className="font-mono text-sm text-no">{suggestionsError}</p>
            ) : suggestions.length === 0 ? (
              <p className="font-mono text-sm text-muted">
                Só encontramos opções indisponíveis ou premium para esse nome.
              </p>
            ) : (
              <ul className="grid gap-px bg-line sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.domain} className="bg-paper">
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(suggestion.domain);
                        void runSearch(suggestion.domain);
                      }}
                      className="flex w-full items-center justify-between gap-4 px-3 py-3 text-left hover:bg-best/70 focus-visible:bg-best/70 focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-sm">
                          {suggestion.domain}
                        </span>
                        <span className="block text-xs text-muted">
                          {suggestion.available === true
                            ? `disponível · ${suggestion.registrar}`
                            : `status incerto · ${suggestion.registrar}`}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold">
                        a partir de {formatBrl(suggestion.register)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TLDS.map((tld) => {
            const selected = activeTld === tld;
            return (
              <button
                key={tld}
                type="button"
                onClick={() => {
                  const base = query.trim() || result?.domain || "seudominio";
                  const next = withTld(
                    base.includes(".") ? base : `${base}.com`,
                    tld,
                  );
                  setQuery(next);
                  void runSearch(next);
                }}
                className={`border px-3 py-1 font-mono text-sm ${
                  selected
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                .{tld}
              </button>
            );
          })}
        </div>
      </form>

      {error ? <p className="font-mono text-sm text-no">{error}</p> : null}

      {result ? <Results data={result} /> : null}
    </div>
  );
}

function MoneyCell({
  brl,
  original,
  currency,
  highlight,
}: {
  brl: number | null;
  original: number | null;
  currency: Quote["originalCurrency"];
  highlight?: boolean;
}) {
  const converted = formatOriginal(original, currency);
  return (
    <td className="py-4 pr-4 font-mono text-sm">
      <div>{formatBrl(brl)}</div>
      {converted ? <div className="text-xs text-muted">{converted}</div> : null}
      {highlight ? (
        <span className="font-display text-xs font-semibold">menor</span>
      ) : null}
    </td>
  );
}

function Results({ data }: { data: SearchResponse }) {
  const taken = data.available === false;
  const status =
    data.available === true
      ? { label: "disponível", className: "bg-ok-soft text-ok" }
      : taken
        ? { label: "já registrado", className: "bg-no-soft text-no" }
        : { label: "disponibilidade incerta", className: "bg-line text-muted" };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-line pb-6">
        <p className={`w-fit px-2 py-1 font-mono text-xs ${status.className}`}>
          {status.label}
        </p>
        <h2 className="overflow-x-auto font-mono text-3xl leading-none tracking-tight whitespace-nowrap sm:text-5xl">
          {data.domain}
        </h2>
        {taken ? (
          <p className="max-w-xl text-muted">
            Esse nome já tem dono. Sem preço de registro para comparar.
          </p>
        ) : null}
      </header>

      <div className="overflow-x-auto">
        <table
          className={`w-full border-collapse text-left ${taken ? "" : "min-w-[42rem]"}`}
        >
          <thead>
            <tr className="border-b border-ink font-mono text-xs text-muted">
              <th className="py-3 pr-4 font-medium">Registrar</th>
              {taken ? null : (
                <>
                  <th className="py-3 pr-4 font-medium">Registro</th>
                  <th className="py-3 pr-4 font-medium">Renovação</th>
                  <th className="py-3 pr-4 font-medium">Transferência</th>
                </>
              )}
              <th className="py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {data.quotes.map((quote) => {
              const best = !taken && quote.id === data.cheapest;
              return (
                <tr
                  key={quote.id}
                  className={`border-b border-line ${best ? "bg-best/70" : ""}`}
                >
                  <td className="py-4 pr-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{quote.name}</span>
                      {taken ? null : (
                        <span className="font-mono text-xs text-muted">
                          {quote.live ? "ao vivo" : "abrir loja"}
                          {quote.note ? ` · ${quote.note}` : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  {taken ? null : (
                    <>
                      <MoneyCell
                        brl={quote.register}
                        original={quote.originalRegister}
                        currency={quote.originalCurrency}
                        highlight={best}
                      />
                      <MoneyCell
                        brl={quote.renew}
                        original={quote.originalRenew}
                        currency={quote.originalCurrency}
                      />
                      <MoneyCell
                        brl={quote.transfer}
                        original={quote.originalTransfer}
                        currency={quote.originalCurrency}
                      />
                    </>
                  )}
                  <td className="py-4 text-right">
                    <a
                      href={quote.buyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block border border-ink px-3 py-2 text-sm font-semibold hover:bg-ink hover:text-paper"
                    >
                      {taken
                        ? "Ver no site"
                        : quote.register != null
                          ? "Comprar"
                          : "Ver preço"}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

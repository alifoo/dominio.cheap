export type Fx = {
  usdBrl: number;
  eurBrl: number;
  source: string;
  at: string;
};

const FALLBACK: Fx = {
  usdBrl: 5.1,
  eurBrl: 5.93,
  source: "taxa de fallback",
  at: new Date().toISOString(),
};

let cached: { at: number; fx: Fx } | null = null;

export async function getFx(): Promise<Fx> {
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
    return cached.fx;
  }

  try {
    const response = await fetch(
      "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL",
      { next: { revalidate: 1800 } },
    );
    if (!response.ok) throw new Error("awesomeapi failed");
    const json = (await response.json()) as {
      USDBRL?: { bid?: string; create_date?: string };
      EURBRL?: { bid?: string; create_date?: string };
    };
    const usd = Number(json.USDBRL?.bid);
    const eur = Number(json.EURBRL?.bid);
    if (!usd || !eur) throw new Error("awesomeapi empty");
    const fx: Fx = {
      usdBrl: usd,
      eurBrl: eur,
      source: "AwesomeAPI · dólar comercial",
      at: json.USDBRL?.create_date
        ? `${json.USDBRL.create_date.replace(" ", "T")}-03:00`
        : new Date().toISOString(),
    };
    cached = { at: Date.now(), fx };
    return fx;
  } catch {
    try {
      const today = new Date();
      const d2 = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}-${today.getFullYear()}`;
      const past = new Date(today.getTime() - 7 * 86400000);
      const d1 = `${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}-${past.getFullYear()}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@d1,dataFinalCotacao=@d2)?@d1='${d1}'&@d2='${d2}'&$top=1&$orderby=dataHoraCotacao desc&$format=json`;
      const response = await fetch(url, { next: { revalidate: 1800 } });
      const json = (await response.json()) as {
        value?: { cotacaoVenda: number; dataHoraCotacao: string }[];
      };
      const row = json.value?.[0];
      if (!row) throw new Error("ptax empty");
      const fx: Fx = {
        usdBrl: row.cotacaoVenda,
        eurBrl: FALLBACK.eurBrl,
        source: "Banco Central · PTAX",
        at: row.dataHoraCotacao,
      };
      cached = { at: Date.now(), fx };
      return fx;
    } catch {
      return FALLBACK;
    }
  }
}

export function toBrl(
  amount: number | null,
  currency: "USD" | "EUR" | "BRL",
  fx: Fx,
): number | null {
  if (amount == null) return null;
  const raw =
    currency === "BRL"
      ? amount
      : currency === "USD"
        ? amount * fx.usdBrl
        : amount * fx.eurBrl;
  return Math.round(raw * 100) / 100;
}

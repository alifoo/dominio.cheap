import { SearchPanel } from "./search-panel";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-baseline justify-between px-5 py-6 sm:px-10">
        <p className="font-display text-xl font-semibold tracking-tight">
          dominio.cheap
        </p>
        <p className="font-mono text-xs text-muted">1 ano · valores em R$</p>
      </header>

      <main className="flex flex-1 flex-col px-5 sm:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 py-10">
          <div className="max-w-3xl">
            <h1 className="max-w-[14ch] font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
              compare preços de domínio com uma busca
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Compare preços na Hostinger, GoDaddy, Vercel, Porkbun, OVH,
              Registro.br e em outros registradores.
            </p>
          </div>
          <SearchPanel />
        </div>
      </main>

      <footer className="bg-ink px-5 py-6 sm:px-10">
        <p className="mx-auto w-full max-w-5xl font-mono text-sm text-paper/70">
          feito por{" "}
          <a
            href="https://www.linkedin.com/in/alisson-ayres/"
            target="_blank"
            rel="noreferrer"
            className="text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper"
          >
            alifoo
          </a>
        </p>
      </footer>
    </div>
  );
}

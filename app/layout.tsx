import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSerifJp = Noto_Serif_JP({
  subsets: ["latin", "latin-ext"],
  variable: "--font-noto-serif-jp",
});

export const metadata: Metadata = {
  title: "dominio.cheap — compare preços de registrars",
  description:
    "Pesquise um domínio e compare preços na Vercel, Porkbun, OVH, Registro.br e nos outros grandes registrars.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${notoSerifJp.variable} ${notoSerifJp.className} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}

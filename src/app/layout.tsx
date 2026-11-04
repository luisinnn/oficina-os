import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// Barlow: desenhada a partir de placas de trânsito e de veículos (ticket 13).
// A condensada vai na placa, no número da OS e nos contadores.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensada = Barlow_Condensed({
  variable: "--font-barlow-condensada",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Pátio",
  description: "Ordens de serviço da oficina",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${barlow.variable} ${barlowCondensada.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

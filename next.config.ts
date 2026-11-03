import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produção roda em Docker na VPS (ticket 12): o build gera uma pasta
  // .next/standalone só com o necessário para o "node server.js".
  output: "standalone",
  // "/" não tem tela própria: manda para o painel.
  // (Se não estiver logado, o proxy ainda desvia para /login.)
  async redirects() {
    return [{ source: "/", destination: "/painel", permanent: false }];
  },
  // Página pública de aprovação: o token do orçamento está no endereço.
  // no-referrer: o navegador não conta o endereço para outros sites.
  // noindex: buscadores não guardam a página.
  async headers() {
    return [
      {
        source: "/aprovar/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  // Só vale no `npm run dev`: deixa o celular na mesma rede abrir o app pelo
  // IP do PC. Sem isso o Next bloqueia o JavaScript e a tela não funciona.
  allowedDevOrigins: ["192.168.0.152"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

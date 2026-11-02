import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "/" não tem tela própria: manda para o painel.
  // (Se não estiver logado, o proxy ainda desvia para /login.)
  async redirects() {
    return [{ source: "/", destination: "/painel", permanent: false }];
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "/" não tem tela própria: manda para o painel.
  // (Se não estiver logado, o proxy ainda desvia para /login.)
  async redirects() {
    return [{ source: "/", destination: "/painel", permanent: false }];
  },
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

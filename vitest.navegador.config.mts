import { defineConfig } from "vitest/config";
import configBanco from "./vitest.db.config.mjs";

// Ticket 10: lista manual de segurança feita por um navegador de verdade
// (Playwright). Precisa do Supabase local e do app rodando ("npm run dev").
// APP_URL muda o endereço do app (padrão http://localhost:3000).
export default defineConfig({
  ...configBanco,
  test: {
    ...configBanco.test,
    include: ["tests/**/*.e2e.ts"],
    env: { ...configBanco.test?.env, APP_URL: process.env.APP_URL ?? "http://localhost:3000" },
    // O dev compila cada rota na primeira visita: pode demorar.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});

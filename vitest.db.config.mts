import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes de integração: precisam do Supabase local rodando ("npm run db:start").
// Ficam fora do "npm test" para ele continuar rápido e sem banco.

// Lê a URL e a chave publishable do Supabase local direto da CLI, sem passar
// por arquivo. De propósito, NÃO repassa a chave secret/service_role: os
// testes enxergam o banco como o app (e um atacante) enxergaria.
function ambienteLocal(): Record<string, string> {
  let saida: string;
  try {
    saida = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error('Supabase local fora do ar. Rode "npm run db:start" antes.');
  }

  const valores = new Map<string, string>();
  for (const linha of saida.split(/\r?\n/)) {
    const variavel = linha.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (variavel) valores.set(variavel[1], variavel[2]);
  }

  const url = valores.get("API_URL");
  const chave = valores.get("PUBLISHABLE_KEY");
  if (!url || !chave) {
    throw new Error('Não achei API_URL/PUBLISHABLE_KEY no "supabase status".');
  }
  return { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: chave };
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: ambienteLocal(),
    // Os testes mexem no mesmo banco: um arquivo por vez evita interferência.
    fileParallelism: false,
  },
});

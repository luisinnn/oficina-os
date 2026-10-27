import { describe, expect, it } from "vitest";

// Teste mínimo: o Supabase local está de pé. (O banco em si é exercitado nos
// outros arquivos, com tabelas de verdade.)
const url = process.env.SUPABASE_URL!;
const chave = process.env.SUPABASE_PUBLISHABLE_KEY!;

describe("Supabase local", () => {
  it("a autenticação responde", async () => {
    const resposta = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: chave },
    });
    expect(resposta.ok).toBe(true);
  });
});

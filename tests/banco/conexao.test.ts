import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Teste mínimo do ticket 01: o Supabase local está de pé e responde.
const url = process.env.SUPABASE_URL!;
const chave = process.env.SUPABASE_PUBLISHABLE_KEY!;

describe("Supabase local", () => {
  it("a autenticação responde", async () => {
    const resposta = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: chave },
    });
    expect(resposta.ok).toBe(true);
  });

  it("o banco responde a uma consulta pela API", async () => {
    // graphql_public.graphql() é uma função SQL que vem em todo Supabase e é
    // liberada para anônimos. Se a chamada volta sem erro, a API chegou até o
    // Postgres e voltou. (Com a extensão pg_graphql desligada, a função
    // responde { errors: [...] }; com ela ligada, { data: ... }. Os dois casos
    // provam que o banco respondeu.)
    const supabase = createClient(url, chave, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .schema("graphql_public")
      .rpc("graphql", { query: "{ __typename }" });

    expect(error).toBeNull();
    expect(Object.keys(data ?? {})).toEqual(
      expect.arrayContaining([expect.stringMatching(/^(data|errors)$/)]),
    );
  });
});

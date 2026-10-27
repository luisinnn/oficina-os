import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Usuario = { id: string; email: string };

// Retorna o usuário logado ou manda para /login.
// cache() do React evita repetir a validação várias vezes na mesma requisição
// (ex.: o cabeçalho e a lista pedem o usuário ao mesmo tempo).
export const getUsuario = cache(async (): Promise<Usuario> => {
  // connection() avisa o Next: "isto só roda numa requisição real".
  // Sem isso, o Next tenta pré-montar a página e reclama do Date.now()
  // que o Supabase usa para checar se o token expirou.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  return {
    id: data.claims.sub,
    email: String(data.claims.email ?? ""),
  };
});

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Oficina = { id: string; nome: string; telefone: string };

// Oficina do usuário logado, ou null se ele ainda não fez o onboarding.
// (Quem não está logado vai para /login.) O RLS só devolve a oficina do
// próprio usuário, então não precisa filtrar por id.
export const buscarOficina = cache(async (): Promise<Oficina | null> => {
  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase.from("oficinas").select("id, nome, telefone").maybeSingle();
  if (error) throw new Error(`Erro ao ler a oficina: ${error.message}`);
  return data;
});

// Como o getUsuario(): devolve a oficina ou manda para o onboarding.
export async function getOficina(): Promise<Oficina> {
  const oficina = await buscarOficina();
  if (!oficina) redirect("/onboarding");
  return oficina;
}

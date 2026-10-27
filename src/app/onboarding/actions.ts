"use server";

import { redirect } from "next/navigation";
import { buscarOficina } from "@/lib/oficina";
import { createClient } from "@/lib/supabase/server";
import { type EstadoOficina, validarOficina } from "@/lib/validacao-oficina";

// Cria a oficina do usuário logado (função criar_oficina no banco) e vai para o painel.
export async function criarOficina(
  _estadoAnterior: EstadoOficina,
  formData: FormData,
): Promise<EstadoOficina> {
  const { valores, dados, erro } = validarOficina(formData);
  if (erro) return { erro, valores };

  const supabase = await createClient();
  const { error } = await supabase.rpc("criar_oficina", dados);

  if (error) {
    // Ex.: clicou duas vezes em "Começar" e a primeira já criou.
    if (await buscarOficina()) redirect("/painel");
    console.error("criarOficina:", error.code ?? error.message);
    return { erro: "Não foi possível criar a oficina. Tente de novo.", valores };
  }

  redirect("/painel");
}

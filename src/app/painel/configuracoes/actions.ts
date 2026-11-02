"use server";

import { revalidatePath } from "next/cache";
import { getOficina } from "@/lib/oficina";
import { createClient } from "@/lib/supabase/server";
import { type EstadoOficina, validarOficina } from "@/lib/validacao-oficina";

// Salva nome e WhatsApp da oficina. O banco só deixa o usuário mudar essas
// duas colunas, e só na própria oficina (RLS + permissão por coluna).
export async function salvarOficina(
  _estadoAnterior: EstadoOficina,
  formData: FormData,
): Promise<EstadoOficina> {
  const oficina = await getOficina();
  const { valores, dados, erro } = validarOficina(formData);
  if (erro) return { erro, valores };

  const supabase = await createClient();
  const { error } = await supabase.from("oficinas").update(dados).eq("id", oficina.id);

  if (error) {
    console.error("salvarOficina:", error.code ?? error.message);
    return { erro: "Não foi possível salvar. Tente de novo.", valores };
  }

  // O nome aparece no cabeçalho de todas as telas do painel.
  revalidatePath("/painel", "layout");
  return { mensagem: "Dados salvos.", valores: dados };
}

export type EstadoLink = { erro?: string; mensagem?: string };

// "Gerar novo link": troca o código do pré-cadastro (trocar_codigo_publico).
// O link antigo para de funcionar na hora. A página volta com o link novo.
export async function gerarNovoLink(): Promise<EstadoLink> {
  await getOficina();
  const supabase = await createClient();
  const { error } = await supabase.rpc("trocar_codigo_publico");
  if (error) {
    console.error("gerarNovoLink:", error.code ?? error.message);
    return { erro: "Não foi possível gerar o link. Tente de novo." };
  }
  revalidatePath("/painel/configuracoes");
  return { mensagem: "Link novo gerado. O antigo não funciona mais." };
}

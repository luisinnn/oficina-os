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

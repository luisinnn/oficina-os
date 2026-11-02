"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOficina } from "@/lib/oficina";
import { type ErrosItem, type ValoresItem, validarItem } from "@/lib/orcamento";
import { createClient } from "@/lib/supabase/server";

export type EstadoItem = { valores?: ValoresItem; erros?: ErrosItem; erro?: string };

// O que o banco devolve do item salvo ou removido: a OS para onde voltar
// vem do orçamento dele, não do formulário.
type ItemComOrdem = { orcamentos: { ordem_id: string } };
const COM_ORDEM = "orcamentos(ordem_id)";

// Deu certo: atualiza o detalhe da OS e o cartão da tela inicial e volta
// para a OS. Sem linha = item não existe (ou é de outra oficina, que o RLS
// esconde).
function concluir(
  acao: "salvar" | "remover",
  { data, error }: { data: ItemComOrdem | null; error: PostgrestError | null },
  valores?: ValoresItem,
): EstadoItem {
  if (error) {
    console.error(`${acao}Item:`, error.code ?? error.message);
    return { valores, erro: `Não foi possível ${acao} o item. Tente de novo.` };
  }
  if (!data) return { valores, erro: "Item não encontrado." };
  revalidatePath("/painel", "layout");
  redirect(`/painel/os/${data.orcamentos.ordem_id}`);
}

// Novo item (sem item_id) ou edição. O RLS só deixa mexer em item e
// orçamento da oficina do usuário; o banco confere de novo os limites. Se o
// orçamento já tinha sido enviado, o trigger dele volta para rascunho.
export async function salvarItem(_estadoAnterior: EstadoItem, formData: FormData): Promise<EstadoItem> {
  await getOficina();
  const { valores, dados, erros } = validarItem(formData);
  if (!dados) return { valores, erros };

  const supabase = await createClient();
  const itemId = String(formData.get("item_id") ?? "");
  const salvo = itemId
    ? supabase.from("orcamento_itens").update(dados).eq("id", itemId)
    : supabase.from("orcamento_itens").insert({ ...dados, orcamento_id: String(formData.get("orcamento_id") ?? "") });
  return concluir("salvar", await salvo.select(COM_ORDEM).maybeSingle<ItemComOrdem>(), valores);
}

export async function removerItem(_estadoAnterior: EstadoItem, formData: FormData): Promise<EstadoItem> {
  await getOficina();
  const supabase = await createClient();
  const removido = await supabase
    .from("orcamento_itens")
    .delete()
    .eq("id", String(formData.get("item_id") ?? ""))
    .select(COM_ORDEM)
    .maybeSingle<ItemComOrdem>();
  return concluir("remover", removido);
}

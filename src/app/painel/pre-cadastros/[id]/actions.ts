"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOficina } from "@/lib/oficina";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfirmacao = { erro?: string };

// Botões do pré-cadastro (campo "acao"):
// - confirmar: placa nova ou do mesmo dono;
// - manter / trocar: placa de outro dono ("Manter {atual}" / "Trocar dono para {novo}");
// - descartar.
// As funções do banco conferem se é da oficina e se ainda está pendente.
export async function responderPreCadastro(
  _estadoAnterior: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  await getOficina();
  const id = String(formData.get("id") ?? "");
  const acao = formData.get("acao");
  const supabase = await createClient();

  if (acao === "descartar") {
    const { error } = await supabase.rpc("descartar_pre_cadastro", { id });
    revalidatePath("/painel", "layout");
    if (error) return falha("descartar", error);
    redirect("/painel");
  }

  const trocar_dono = acao === "trocar" ? true : acao === "manter" ? false : null;
  const { data: ordem, error } = await supabase.rpc("confirmar_pre_cadastro", { id, trocar_dono });
  revalidatePath("/painel", "layout");
  if (error) return falha("confirmar", error);
  redirect(`/painel/os/${ordem}`);
}

// A tela mostra só os botões que valem; erro aqui é tela desatualizada (outra
// aba, toque duplo ou o carro mudou nesse meio-tempo).
function falha(onde: string, error: { code?: string; message: string }): EstadoConfirmacao {
  switch (error.code) {
    case "P0002":
      return { erro: "Este pré-cadastro já foi confirmado ou descartado." };
    case "OS001":
    case "23505":
      return { erro: "Este carro já tem uma OS aberta. Feche a OS ou descarte o pré-cadastro." };
    case "OS002":
      return { erro: "O dono do carro mudou. Recarregue a página e escolha de novo." };
  }
  console.error(`responderPreCadastro (${onde}):`, error.code ?? error.message);
  return { erro: "Não foi possível salvar. Tente de novo." };
}

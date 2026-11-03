"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type AvisoDeKm, type ErrosEntrada, kmFoiConferida, lerEntrada, type ValoresEntrada } from "@/lib/km";
import { getOficina } from "@/lib/oficina";
import { avisoDeKm, buscarPreCadastro } from "@/lib/ordens";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfirmacao = {
  erro?: string;
  erros?: ErrosEntrada;
  // O que foi digitado, para mostrar de novo.
  valores?: ValoresEntrada;
  // Km menor que a da última OS do carro. acao = botão que foi tocado.
  avisoKm?: AvisoDeKm & { acao: string };
};

// Botões do pré-cadastro (campo "acao"):
// - confirmar: placa nova ou do mesmo dono;
// - manter / trocar: placa de outro dono ("Manter {atual}" / "Trocar dono para {novo}");
// - descartar.
// Confirmar pede a km de entrada (obrigatória) e o tanque (opcional): quem
// anota é o mecânico, com o carro na oficina.
// As funções do banco conferem se é da oficina e se ainda está pendente.
export async function responderPreCadastro(
  _estadoAnterior: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  await getOficina();
  const id = String(formData.get("id") ?? "");
  const acao = String(formData.get("acao") ?? "");
  const supabase = await createClient();

  if (acao === "descartar") {
    const { error } = await supabase.rpc("descartar_pre_cadastro", { id });
    revalidatePath("/painel", "layout");
    if (error) return falha("descartar", error);
    redirect("/painel");
  }

  const { valores, erros, dados } = lerEntrada(formData, true);
  // Com comKm = true, km só é null se houver erro.
  if (!dados || dados.km === null) return { valores, erros };
  const { km, tanque } = dados;

  if (!kmFoiConferida(formData, km)) {
    const pre = await buscarPreCadastro(id);
    const avisoKm = pre && (await avisoDeKm(pre.placa, km));
    if (avisoKm) return { valores, avisoKm: { ...avisoKm, acao } };
  }

  const trocar_dono = acao === "trocar" ? true : acao === "manter" ? false : null;
  const { data: ordem, error } = await supabase.rpc("confirmar_pre_cadastro", { id, trocar_dono, km, tanque });
  revalidatePath("/painel", "layout");
  if (error) return { valores, ...falha("confirmar", error) };
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

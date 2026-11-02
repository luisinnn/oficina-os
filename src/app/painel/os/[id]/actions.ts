"use server";

import { revalidatePath } from "next/cache";
import { getOficina } from "@/lib/oficina";
import { buscarOrcamento, buscarOrdem } from "@/lib/ordens";
import { urlDoSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { linkAprovacao, linkWhatsApp, mensagemOrcamento } from "@/lib/whatsapp";

export type EstadoStatus = { erro?: string };

// Muda o status pela função mudar_status do banco, que confere a transição e
// se a OS é da oficina. Os botões só oferecem transições válidas; erro aqui é
// tela desatualizada (a OS mudou em outra aba ou num toque duplo).
export async function mudarStatus(_estadoAnterior: EstadoStatus, formData: FormData): Promise<EstadoStatus> {
  await getOficina();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mudar_status", {
    ordem_id: String(formData.get("ordem_id") ?? ""),
    novo_status: String(formData.get("novo_status") ?? ""),
  });

  // Atualiza o detalhe, a tela inicial e o histórico da placa.
  revalidatePath("/painel", "layout");

  if (!error) return {};
  if (error.code === "OS003") return { erro: "A OS já tinha mudado de status. Veja como ela está agora." };
  if (error.code === "P0002") return { erro: "OS não encontrada." };
  console.error("mudarStatus:", error.code ?? error.message);
  return { erro: "Não foi possível mudar o status. Tente de novo." };
}

export type EstadoEnvio = { erro?: string; url?: string };

// Gera o link de aprovação (enviar_orcamento) e devolve o link do WhatsApp
// com a mensagem pronta, para o navegador abrir. Reenviar anula o link
// anterior. O token só existe aqui e no link: não vai para log.
export async function enviarOrcamento(_estadoAnterior: EstadoEnvio, formData: FormData): Promise<EstadoEnvio> {
  const oficina = await getOficina();
  // Antes da função do banco: sem endereço, não adianta anular o link antigo.
  const site = urlDoSite();
  if (!site) {
    console.error("enviarOrcamento: defina NEXT_PUBLIC_SITE_URL nas variáveis de ambiente.");
    return { erro: "Envio indisponível no momento. Tente mais tarde." };
  }

  const ordemId = String(formData.get("ordem_id") ?? "");
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("enviar_orcamento", { ordem_id: ordemId });

  // Etiqueta "Enviado" no detalhe e na tela inicial.
  revalidatePath("/painel", "layout");

  if (error) {
    if (error.code === "OS004") return { erro: "Adicione ao menos um item antes de enviar." };
    if (error.code === "P0002") return { erro: "OS não encontrada." };
    console.error("enviarOrcamento:", error.code ?? error.message);
    return { erro: "Não foi possível enviar o orçamento. Tente de novo." };
  }

  const [os, orcamento] = await Promise.all([buscarOrdem(ordemId), buscarOrcamento(ordemId)]);
  if (!os || !orcamento) return { erro: "OS não encontrada." };

  const texto = mensagemOrcamento({
    nomeCliente: os.clientes.nome,
    modelo: os.veiculos.modelo,
    placa: os.veiculos.placa,
    oficina: oficina.nome,
    numero: os.numero,
    totalCentavos: orcamento.total_centavos,
    link: linkAprovacao(site, token as string),
  });
  return { url: linkWhatsApp(os.clientes.telefone, texto) };
}

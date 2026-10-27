"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOficina } from "@/lib/oficina";
import { buscarCarro } from "@/lib/ordens";
import { textoOsAberta } from "@/lib/status-ordem";
import { createClient } from "@/lib/supabase/server";
import { chaveTroca, type EstadoNovaOrdem, validarNovaOrdem } from "@/lib/validacao-ordem";
import { formatarTelefone } from "@/lib/formatos";

// Abre a OS pela função criar_ordem do banco (cliente + veículo + OS numa
// transação só) e vai para o detalhe dela.
export async function criarOrdem(
  _estadoAnterior: EstadoNovaOrdem,
  formData: FormData,
): Promise<EstadoNovaOrdem> {
  await getOficina();
  const { valores, dados, erros } = validarNovaOrdem(formData);
  if (!dados) return { erros, valores };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_ordem", dados);

  if (error) {
    // OS001 = carro com OS aberta (23505 = a mesma coisa, numa corrida entre
    // dois cadastros ao mesmo tempo). OS002 = carro de outro cliente.
    if (["OS001", "OS002", "23505"].includes(error.code)) {
      const carro = await buscarCarro(dados.placa);
      if (carro?.aberta) {
        const { id, numero, status } = carro.aberta;
        return {
          valores,
          erro: textoOsAberta(numero, status),
          ordemAberta: { id, numero },
        };
      }
      if (carro && error.code === "OS002") {
        return {
          valores,
          confirmarTroca: {
            donoAtual: `${carro.dono.nome} (${formatarTelefone(carro.dono.telefone)})`,
            donoNovo: `${dados.nome} (${formatarTelefone(dados.telefone)})`,
            chave: chaveTroca(dados),
          },
        };
      }
    }
    console.error("criarOrdem:", error.code ?? error.message);
    return { valores, erro: "Não foi possível salvar a OS. Tente de novo." };
  }

  revalidatePath("/painel");
  redirect(`/painel/os/${data}`);
}

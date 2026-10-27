"use server";

import { revalidatePath } from "next/cache";
import { getOficina } from "@/lib/oficina";
import { createClient } from "@/lib/supabase/server";

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

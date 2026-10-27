"use server";

import { redirect } from "next/navigation";
import { ERRO_PLACA, normalizarPlaca, validarPlaca } from "@/lib/formatos";

export type EstadoBusca = { erro?: string; placa?: string };

// Busca por placa: limpa o que foi digitado e abre a página da placa.
export async function buscarPlaca(_estadoAnterior: EstadoBusca, formData: FormData): Promise<EstadoBusca> {
  const digitada = String(formData.get("placa") ?? "").trim();
  const placa = normalizarPlaca(digitada);
  if (!validarPlaca(placa)) return { erro: ERRO_PLACA, placa: digitada };
  redirect(`/painel/placa/${placa}`);
}

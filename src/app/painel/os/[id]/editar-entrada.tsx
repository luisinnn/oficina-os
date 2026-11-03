"use client";
// Corrigir a km de entrada (só até o orçamento ser enviado) e anotar o
// tanque depois, enquanto a OS está aberta. Fica recolhido: é exceção.

import { useActionState } from "react";
import { TEXTO_KM_TRAVADA, type Tanque } from "@/lib/km";
import { AvisoKm, CampoKm, CampoTanque } from "../../campos-entrada";
import { salvarEntrada } from "./actions";

type Props = {
  ordemId: string;
  km: number | null;
  tanque: Tanque | null;
  // Orçamento já enviado ao cliente: a km não muda mais.
  kmTravada: boolean;
};

export function EditarEntrada({ ordemId, km, tanque, kmTravada }: Props) {
  const [estado, salvar, pendente] = useActionState(salvarEntrada, {});
  const valores = estado.valores ?? { km: km === null ? "" : String(km), tanque: tanque ?? "" };
  const erros = estado.erros ?? {};

  return (
    <details
      open={Boolean(estado.erro || estado.avisoKm || estado.erros || estado.salvo)}
      className="rounded-xl border border-zinc-200 bg-white px-4 shadow-sm"
    >
      <summary className="flex min-h-12 cursor-pointer items-center font-medium text-zinc-800">
        {kmTravada ? "Anotar o tanque" : "Corrigir km ou anotar o tanque"}
      </summary>
      <form action={salvar} className="space-y-4 pb-4" noValidate>
        <input type="hidden" name="ordem_id" value={ordemId} />

        {kmTravada ? (
          <p className="text-sm text-zinc-700">{TEXTO_KM_TRAVADA}</p>
        ) : (
          <CampoKm valor={valores.km} erro={erros.km} />
        )}
        <CampoTanque valor={valores.tanque} erro={erros.tanque} />

        {estado.erro && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {estado.erro}
          </p>
        )}
        {estado.salvo && !pendente && (
          <p role="status" className="text-sm font-medium text-liberado">
            Salvo.
          </p>
        )}

        {estado.avisoKm ? (
          <AvisoKm aviso={estado.avisoKm} pendente={pendente} />
        ) : (
          <button
            type="submit"
            disabled={pendente}
            className="min-h-12 w-full rounded-md bg-placa px-4 py-2 font-medium text-white hover:bg-placa-escuro disabled:opacity-50"
          >
            {pendente ? "Salvando..." : "Salvar"}
          </button>
        )}
      </form>
    </details>
  );
}

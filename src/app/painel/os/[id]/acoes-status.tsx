"use client";
// Botões de status no detalhe da OS: avançar (ação principal), voltar
// (discreto) e cancelar (pede confirmação). Só mostra transições válidas.

import { useActionState, useState } from "react";
import {
  podeCancelar,
  proximoStatus,
  ROTULO_STATUS,
  statusAnterior,
  type StatusOrdem,
} from "@/lib/status-ordem";
import { mudarStatus } from "./actions";

export function AcoesStatus({ ordemId, status }: { ordemId: string; status: StatusOrdem }) {
  const [estado, enviar, pendente] = useActionState(mudarStatus, {});
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const proximo = proximoStatus(status);
  const anterior = statusAnterior(status);
  const cancelavel = podeCancelar(status);

  if (!proximo && !anterior && !cancelavel && !estado.erro) return null;

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="ordem_id" value={ordemId} />

      {estado.erro && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      {proximo && !confirmandoCancelar && (
        <button
          type="submit"
          name="novo_status"
          value={proximo}
          disabled={pendente}
          className="min-h-14 w-full rounded-md bg-placa px-4 text-lg font-semibold text-white hover:bg-placa-escuro disabled:opacity-50"
        >
          Avançar para {ROTULO_STATUS[proximo]}
        </button>
      )}

      <div className="flex flex-wrap justify-between gap-x-4">
        {anterior && !confirmandoCancelar && (
          <button
            type="submit"
            name="novo_status"
            value={anterior}
            disabled={pendente}
            className="min-h-12 text-zinc-600 underline hover:text-zinc-900 disabled:opacity-50"
          >
            ← Voltar para {ROTULO_STATUS[anterior]}
          </button>
        )}
        {cancelavel && !confirmandoCancelar && (
          <button
            type="button"
            onClick={() => setConfirmandoCancelar(true)}
            disabled={pendente}
            className="ml-auto min-h-12 text-red-600 underline hover:text-red-800 disabled:opacity-50"
          >
            Cancelar OS
          </button>
        )}
      </div>

      {cancelavel && confirmandoCancelar && (
        <div className="space-y-3 rounded-md bg-red-50 p-3 text-zinc-900">
          <p>Cancelar esta OS? Depois de cancelada ela não volta.</p>
          <button
            type="submit"
            name="novo_status"
            value="cancelada"
            disabled={pendente}
            className="min-h-12 w-full rounded-md bg-red-600 px-4 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Sim, cancelar OS
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoCancelar(false)}
            disabled={pendente}
            className="min-h-12 w-full rounded-md border border-zinc-300 bg-white px-4 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            Não, manter a OS
          </button>
        </div>
      )}
    </form>
  );
}

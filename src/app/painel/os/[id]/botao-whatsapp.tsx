"use client";
// Botão "Enviar pelo WhatsApp": gera o link de aprovação no servidor e abre
// o WhatsApp com a conversa do cliente e o texto pronto.

import { useActionState, useEffect } from "react";
import { enviarOrcamento } from "./actions";

export function BotaoWhatsApp({ ordemId, jaEnviado }: { ordemId: string; jaEnviado: boolean }) {
  const [estado, enviar, pendente] = useActionState(enviarOrcamento, {});

  // Mesma aba: no celular o link wa.me abre o app do WhatsApp. Uma aba nova
  // depois da espera do servidor seria bloqueada como pop-up.
  useEffect(() => {
    if (estado.url) window.location.href = estado.url;
  }, [estado]);

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="ordem_id" value={ordemId} />
      {estado.erro && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <button
        type="submit"
        disabled={pendente}
        className="min-h-14 w-full rounded-md bg-green-600 px-4 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {pendente ? "Abrindo o WhatsApp..." : "Enviar pelo WhatsApp"}
      </button>
      {jaEnviado && (
        <p className="text-sm text-zinc-600">Reenviar gera um link novo; o que já foi enviado para de funcionar.</p>
      )}
    </form>
  );
}

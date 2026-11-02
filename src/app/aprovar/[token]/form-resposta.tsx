"use client";
// Botões Aprovar e Recusar da página pública. Recusar abre o campo de motivo
// (opcional) e pede para confirmar. Depois de responder, some o formulário.

import { useActionState, useState } from "react";
import { MOTIVO_MAX, type Resposta } from "@/lib/aprovacao";
import { responderOrcamento } from "./actions";

const classeBotao = "min-h-14 w-full rounded-md px-4 text-lg font-semibold disabled:opacity-50";

export function FormResposta({ token }: { token: string }) {
  const [estado, responder, pendente] = useActionState(responderOrcamento, {});
  const [recusando, setRecusando] = useState(false);

  if (estado.resposta) return <Respondido resposta={estado.resposta} agora />;
  if (estado.invalido) return <LinkInvalido />;

  return (
    <form action={responder} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {estado.erro && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      {recusando ? (
        <>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Motivo da recusa (opcional)</span>
            <textarea
              name="motivo"
              rows={3}
              maxLength={MOTIVO_MAX}
              autoCapitalize="sentences"
              autoFocus
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            name="acao"
            value="recusar"
            disabled={pendente}
            className={`${classeBotao} bg-red-600 text-white hover:bg-red-700`}
          >
            {pendente ? "Enviando..." : "Confirmar recusa"}
          </button>
          <button
            type="button"
            onClick={() => setRecusando(false)}
            disabled={pendente}
            className={`${classeBotao} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
          >
            Voltar
          </button>
        </>
      ) : (
        <>
          <button
            type="submit"
            name="acao"
            value="aprovar"
            disabled={pendente}
            className={`${classeBotao} bg-green-600 text-white hover:bg-green-700`}
          >
            {pendente ? "Enviando..." : "Aprovar"}
          </button>
          <button
            type="button"
            onClick={() => setRecusando(true)}
            disabled={pendente}
            className={`${classeBotao} border border-red-600 bg-white text-red-700 hover:bg-red-50`}
          >
            Recusar
          </button>
        </>
      )}
    </form>
  );
}

// Mesma mensagem para link errado, anulado ou vencido: não diz qual foi.
export function LinkInvalido() {
  return (
    <section role="alert" className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <p className="text-lg font-medium text-zinc-900">Link expirado ou inválido. Peça um novo à oficina.</p>
    </section>
  );
}

// Resposta já dada. "agora" = acabou de responder nesta tela.
export function Respondido({ resposta, agora = false }: { resposta: Resposta; agora?: boolean }) {
  const aprovado = resposta === "aprovado";
  return (
    <div
      role="status"
      className={`rounded-xl p-4 text-center ${aprovado ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}
    >
      <p className="text-xl font-semibold">{aprovado ? "Orçamento aprovado" : "Orçamento recusado"}</p>
      <p className="mt-1">{agora ? "Obrigado! A oficina já foi avisada." : "Você já respondeu a este orçamento."}</p>
    </div>
  );
}

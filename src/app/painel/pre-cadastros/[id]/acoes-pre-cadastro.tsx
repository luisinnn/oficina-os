"use client";
// Botões Confirmar / Descartar do pré-cadastro. Com a placa de outro dono,
// Confirmar vira "Manter {atual}" e "Trocar dono para {novo}".

import { useActionState } from "react";
import { responderPreCadastro } from "./actions";

const classeBotao = "min-h-14 w-full rounded-md px-4 text-lg font-semibold disabled:opacity-50";
const principal = `${classeBotao} bg-blue-600 text-white hover:bg-blue-700`;
const secundario = `${classeBotao} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`;

type Props = {
  id: string;
  // Sem OS aberta no carro. Com OS aberta, só Descartar.
  podeConfirmar: boolean;
  // Placa de outro dono: os nomes para os dois botões.
  troca?: { atual: string; novo: string };
};

export function AcoesPreCadastro({ id, podeConfirmar, troca }: Props) {
  const [estado, responder, pendente] = useActionState(responderPreCadastro, {});

  return (
    <form action={responder} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {estado.erro && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      {podeConfirmar &&
        (troca ? (
          <>
            <button type="submit" name="acao" value="manter" disabled={pendente} className={principal}>
              Manter {troca.atual}
            </button>
            <button type="submit" name="acao" value="trocar" disabled={pendente} className={principal}>
              Trocar dono para {troca.novo}
            </button>
          </>
        ) : (
          <button type="submit" name="acao" value="confirmar" disabled={pendente} className={principal}>
            {pendente ? "Salvando..." : "Confirmar"}
          </button>
        ))}

      <button type="submit" name="acao" value="descartar" disabled={pendente} className={secundario}>
        Descartar
      </button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { excluirCliente } from "./actions";

// Botão de excluir com confirmação. Precisa rodar no navegador por causa do
// window.confirm() (a caixinha "Tem certeza?").
export function BotaoExcluir({ id, nome }: { id: string; nome: string }) {
  const [pendente, startTransition] = useTransition();

  function aoClicar() {
    if (!window.confirm(`Excluir o cliente "${nome}"? Isso não pode ser desfeito.`)) return;
    startTransition(() => excluirCliente(id));
  }

  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={pendente}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {pendente ? "Excluindo..." : "Excluir"}
    </button>
  );
}

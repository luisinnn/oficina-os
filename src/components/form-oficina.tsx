"use client";
// Formulário de nome + WhatsApp da oficina. Usado no onboarding (criar) e nas
// configurações (editar); muda só a ação chamada e o texto do botão.

import { useActionState } from "react";
import { NOME_OFICINA_MAX, type EstadoOficina, type ValoresOficina } from "@/lib/validacao-oficina";

type Props = {
  acao: (estado: EstadoOficina, formData: FormData) => Promise<EstadoOficina>;
  inicial: ValoresOficina;
  botao: string;
};

const classeCampo =
  "mt-1 min-h-12 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none";

export function FormOficina({ acao, inicial, botao }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {});
  // Depois de enviar, mostra de novo o que foi digitado (ou o que foi salvo).
  const valores = estado.valores ?? inicial;

  return (
    <form action={enviar} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Nome da oficina</span>
        <input
          name="nome"
          required
          maxLength={NOME_OFICINA_MAX}
          autoCapitalize="words"
          autoComplete="organization"
          defaultValue={valores.nome}
          className={classeCampo}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">WhatsApp da oficina</span>
        <input
          name="telefone"
          type="tel"
          inputMode="tel"
          maxLength={20}
          required
          autoComplete="tel"
          placeholder="(47) 99999-0000"
          defaultValue={valores.telefone}
          className={classeCampo}
        />
      </label>

      {estado.erro && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>
      )}
      {estado.mensagem && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{estado.mensagem}</p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="min-h-12 w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pendente ? "Aguarde..." : botao}
      </button>
    </form>
  );
}

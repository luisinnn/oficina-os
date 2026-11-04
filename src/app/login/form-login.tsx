"use client";
// "use client" = este componente roda no navegador (tem estado e cliques).

import { useActionState } from "react";
import { entrar, type EstadoAuth } from "./actions";

const inicial: EstadoAuth = {};

const campo =
  "mt-1 block min-h-12 w-full rounded-lg border border-grafite/40 bg-chapa px-3 text-base text-grafite focus:border-placa focus:outline-none";

export function FormLogin() {
  // useActionState liga o formulário à Server Action e devolve:
  // - estado: o que a action retornou (erro)
  // - acao: a função para colocar no <form action={...}>
  // - pendente: true enquanto o servidor processa (para desabilitar o botão)
  const [estado, acao, pendente] = useActionState(entrar, inicial);

  return (
    <section className="rounded-lg border border-grafite/15 bg-chapa p-6">
      <h1 className="mb-6 text-xl font-semibold">Entrar no painel</h1>

      <form action={acao} className="space-y-4">
        <label className="block">
          <span className="font-semibold">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={estado.email}
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            className={campo}
          />
        </label>

        <label className="block">
          <span className="font-semibold">Senha</span>
          <input name="senha" type="password" required autoComplete="current-password" className={campo} />
        </label>

        {estado.erro && (
          <p role="alert" className="rounded-lg border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800">
            {estado.erro}
          </p>
        )}

        <button
          type="submit"
          disabled={pendente}
          className="min-h-14 w-full rounded-lg bg-placa px-4 text-xl font-semibold text-white hover:bg-placa-escuro disabled:opacity-60"
        >
          {pendente ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}

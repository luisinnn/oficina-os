"use client";
// "use client" = este componente roda no navegador (tem estado e cliques).

import { useActionState, useState } from "react";
import { cadastrar, entrar, type EstadoAuth } from "./actions";

const inicial: EstadoAuth = {};

export function FormLogin() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");

  // useActionState liga o formulário à Server Action e devolve:
  // - estado: o que a action retornou (erro/mensagem)
  // - acao: a função para colocar no <form action={...}>
  // - pendente: true enquanto o servidor processa (para desabilitar o botão)
  const [estadoEntrar, acaoEntrar, pendenteEntrar] = useActionState(entrar, inicial);
  const [estadoCadastrar, acaoCadastrar, pendenteCadastrar] = useActionState(cadastrar, inicial);

  const ehEntrar = modo === "entrar";
  const estado = ehEntrar ? estadoEntrar : estadoCadastrar;
  const pendente = ehEntrar ? pendenteEntrar : pendenteCadastrar;

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">
        {ehEntrar ? "Entrar" : "Criar conta"}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">oficina-os</p>

      <form action={ehEntrar ? acaoEntrar : acaoCadastrar} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Senha</span>
          <input
            name="senha"
            type="password"
            required
            minLength={ehEntrar ? undefined : 8}
            autoComplete={ehEntrar ? "current-password" : "new-password"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none"
          />
        </label>

        {estado.erro && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>
        )}
        {estado.mensagem && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {estado.mensagem}
          </p>
        )}

        <button
          type="submit"
          disabled={pendente}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pendente ? "Aguarde..." : ehEntrar ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setModo(ehEntrar ? "cadastrar" : "entrar")}
        className="mt-4 w-full text-sm text-blue-600 hover:underline"
      >
        {ehEntrar ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}

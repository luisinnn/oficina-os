"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  EMAIL_MAX,
  NOME_MAX,
  OBSERVACOES_MAX,
  TELEFONE_MAX,
  type ValoresCliente,
} from "@/lib/validacao-cliente";
import type { EstadoCliente } from "./actions";

type Props = {
  // A Server Action a chamar: criarCliente ou atualizarCliente (já com o id).
  acao: (estado: EstadoCliente, formData: FormData) => Promise<EstadoCliente>;
  // Valores iniciais (na edição vêm do banco; na criação, vazios).
  inicial?: Partial<ValoresCliente>;
  textoBotao: string;
};

const campo =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none";

export function FormCliente({ acao, inicial = {}, textoBotao }: Props) {
  const [estado, formAction, pendente] = useActionState(acao, {});

  // Depois de um erro, mostra o que a pessoa digitou; senão, os valores iniciais.
  const v = estado.valores ?? inicial;

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Nome *</span>
        <input name="nome" required maxLength={NOME_MAX} defaultValue={v.nome ?? ""} className={campo} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Telefone</span>
          <input name="telefone" type="tel" maxLength={TELEFONE_MAX} defaultValue={v.telefone ?? ""} className={campo} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">E-mail</span>
          <input name="email" type="email" maxLength={EMAIL_MAX} defaultValue={v.email ?? ""} className={campo} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Observações</span>
        <textarea
          name="observacoes"
          rows={4}
          maxLength={OBSERVACOES_MAX}
          defaultValue={v.observacoes ?? ""}
          className={campo}
        />
      </label>

      {estado.erro && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pendente}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pendente ? "Salvando..." : textoBotao}
        </button>
        <Link
          href="/clientes"
          className="rounded-md border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

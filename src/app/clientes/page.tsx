import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listarClientes } from "@/lib/clientes";
import { BotaoExcluir } from "./botao-excluir";

export const metadata: Metadata = { title: "Clientes | Cadastro de Clientes" };

// Página de listagem. O título e o botão "Novo cliente" são estáticos;
// a tabela depende do usuário logado e por isso fica dentro do Suspense.
export default function ClientesPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Novo cliente
        </Link>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Carregando clientes...</p>}>
        <ListaClientes />
      </Suspense>
    </>
  );
}

async function ListaClientes() {
  const clientes = await listarClientes();

  if (clientes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
        Nenhum cliente cadastrado ainda. Clique em &quot;Novo cliente&quot; para começar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-100 text-zinc-600">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Telefone</th>
            <th className="px-4 py-3 font-medium">E-mail</th>
            <th className="px-4 py-3 font-medium">Cadastrado em</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 text-zinc-800">
          {clientes.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{c.nome}</div>
                {c.observacoes && (
                  <div className="max-w-xs truncate text-xs text-zinc-500">{c.observacoes}</div>
                )}
              </td>
              <td className="px-4 py-3">{c.telefone ?? "—"}</td>
              <td className="px-4 py-3">{c.email ?? "—"}</td>
              <td className="px-4 py-3">
                {new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-4">
                  <Link
                    href={`/clientes/${c.id}/editar`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Editar
                  </Link>
                  <BotaoExcluir id={c.id} nome={c.nome} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

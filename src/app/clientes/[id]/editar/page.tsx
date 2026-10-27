import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buscarCliente } from "@/lib/clientes";
import { atualizarCliente } from "../../actions";
import { FormCliente } from "../../form-cliente";

export const metadata: Metadata = { title: "Editar cliente | Cadastro de Clientes" };

// [id] na pasta = parte variável da URL. Ex.: /clientes/abc-123/editar -> id = "abc-123".
export default function EditarClientePage({ params }: PageProps<"/clientes/[id]/editar">) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Editar cliente</h1>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <Suspense fallback={<p className="text-zinc-500">Carregando...</p>}>
          <Edicao params={params} />
        </Suspense>
      </div>
    </>
  );
}

async function Edicao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await buscarCliente(id);

  // Não existe ou é de outro usuário -> página 404.
  if (!cliente) notFound();

  // .bind() "prende" o id na ação: o formulário só manda os campos, e o
  // servidor recebe atualizarCliente(id, estado, formData).
  const acao = atualizarCliente.bind(null, cliente.id);

  return (
    <FormCliente
      acao={acao}
      textoBotao="Salvar alterações"
      inicial={{
        nome: cliente.nome,
        telefone: cliente.telefone ?? "",
        email: cliente.email ?? "",
        observacoes: cliente.observacoes ?? "",
      }}
    />
  );
}

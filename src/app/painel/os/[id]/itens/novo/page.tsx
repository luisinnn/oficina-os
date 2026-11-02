import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ehTipoItem, foiEnviado } from "@/lib/orcamento";
import { buscarOrcamento, buscarOrdem } from "@/lib/ordens";
import { FormItem } from "../form-item";

export const metadata: Metadata = { title: "Novo item | oficina-os" };

// /painel/os/<id>/itens/novo?tipo=peca (ou mao_de_obra): vem dos botões
// "+ Peça" e "+ Mão de obra" do orçamento.
export default function NovoItemPage({ params, searchParams }: PageProps<"/painel/os/[id]/itens/novo">) {
  return (
    <section className="mx-auto max-w-md space-y-4">
      <Suspense fallback={<p className="text-sm text-zinc-400">Carregando...</p>}>
        <NovoItem params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function NovoItem({ params, searchParams }: PageProps<"/painel/os/[id]/itens/novo">) {
  const [{ id }, { tipo: tipoDaUrl }] = await Promise.all([params, searchParams]);
  const [os, orcamento] = await Promise.all([buscarOrdem(id), buscarOrcamento(id)]);
  if (!os || !orcamento) notFound();
  const tipo = ehTipoItem(tipoDaUrl) ? tipoDaUrl : "peca";

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900">
          Novo item · OS #{os.numero}
        </h1>
        <FormItem
          alvo={{ orcamentoId: orcamento.id }}
          inicial={{ tipo, descricao: "", quantidade: "1", valor: "" }}
          enviado={foiEnviado(orcamento.estado)}
        />
      </div>
      <Link href={`/painel/os/${id}`} className="flex min-h-12 items-center font-medium text-blue-600 hover:underline">
        ← Voltar para a OS
      </Link>
    </>
  );
}

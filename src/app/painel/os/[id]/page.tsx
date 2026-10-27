import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatarDataHora, formatarTelefone } from "@/lib/formatos";
import { buscarOrdem } from "@/lib/ordens";
import { ROTULO_STATUS } from "@/lib/status-ordem";
import { AcoesStatus } from "./acoes-status";

export const metadata: Metadata = { title: "OS | oficina-os" };

// Detalhe da OS com os botões de status. (Orçamento entra no ticket 06.)
export default function OrdemPage({ params }: PageProps<"/painel/os/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Carregando...</p>}>
      <DetalheOs params={params} />
    </Suspense>
  );
}

async function DetalheOs({ params }: Pick<PageProps<"/painel/os/[id]">, "params">) {
  const { id } = await params;
  const os = await buscarOrdem(id);
  if (!os) notFound();

  return (
    <section className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-zinc-900">OS #{os.numero}</h1>
        <span className="rounded-full bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-800">
          {ROTULO_STATUS[os.status]}
        </span>
      </div>

      <AcoesStatus ordemId={os.id} status={os.status} />

      <dl className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <Item rotulo="Carro">
          <Link href={`/painel/placa/${os.veiculos.placa}`} className="font-semibold text-blue-700 underline">
            {os.veiculos.placa}
          </Link>{" "}
          · {os.veiculos.modelo}
        </Item>
        <Item rotulo="Cliente">
          {os.clientes.nome} · {formatarTelefone(os.clientes.telefone)}
        </Item>
        <Item rotulo="Problema">
          <span className="whitespace-pre-wrap">{os.problema}</span>
        </Item>
        {os.km !== null && <Item rotulo="Km">{os.km.toLocaleString("pt-BR")}</Item>}
        {os.obs_interna && (
          <Item rotulo="Observação interna">
            <span className="whitespace-pre-wrap">{os.obs_interna}</span>
          </Item>
        )}
        <Item rotulo="Entrada">{formatarDataHora(os.created_at)}</Item>
        {os.entregue_em && <Item rotulo="Entregue">{formatarDataHora(os.entregue_em)}</Item>}
      </dl>

      <Link href="/painel" className="flex min-h-12 items-center font-medium text-blue-600 hover:underline">
        ← Voltar para o início
      </Link>
    </section>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{rotulo}</dt>
      <dd className="break-words text-zinc-900">{children}</dd>
    </div>
  );
}

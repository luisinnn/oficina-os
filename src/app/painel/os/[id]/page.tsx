import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatarDataHora, formatarTelefone } from "@/lib/formatos";
import { Placa } from "@/components/placa";
import { buscarOrcamento, buscarOrdem } from "@/lib/ordens";
import { textoEntrada } from "@/lib/km";
import { ROTULO_STATUS, estaAberta } from "@/lib/status-ordem";
import { AcoesStatus } from "./acoes-status";
import { EditarEntrada } from "./editar-entrada";
import { SecaoOrcamento } from "./secao-orcamento";

export const metadata: Metadata = { title: "OS | oficina-os" };

// Detalhe da OS: botões de status, dados da visita e orçamento.
export default function OrdemPage({ params }: PageProps<"/painel/os/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Carregando...</p>}>
      <DetalheOs params={params} />
    </Suspense>
  );
}

async function DetalheOs({ params }: Pick<PageProps<"/painel/os/[id]">, "params">) {
  const { id } = await params;
  const [os, orcamento] = await Promise.all([buscarOrdem(id), buscarOrcamento(id)]);
  if (!os || !orcamento) notFound();

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
          <Link href={`/painel/placa/${os.veiculos.placa}`} className="inline-flex min-h-12 items-center rounded hover:opacity-80" aria-label={`Ver o histórico da placa ${os.veiculos.placa}`}>
            <Placa placa={os.veiculos.placa} tamanho="p" />
          </Link>{" "}
          · {os.veiculos.modelo}
          {/* A km de entrada é a prova da garantia: em destaque, perto da placa. */}
          <span className={`block font-condensada text-xl ${os.km === null ? "text-zinc-600" : "text-grafite"}`}>
            {textoEntrada(os.km, os.tanque)}
          </span>
        </Item>
        <Item rotulo="Cliente">
          {os.clientes.nome} · {formatarTelefone(os.clientes.telefone)}
        </Item>
        <Item rotulo="Problema">
          <span className="whitespace-pre-wrap">{os.problema}</span>
        </Item>
        {os.obs_interna && (
          <Item rotulo="Observação interna">
            <span className="whitespace-pre-wrap">{os.obs_interna}</span>
          </Item>
        )}
        <Item rotulo="Entrada">{formatarDataHora(os.created_at)}</Item>
        {os.entregue_em && <Item rotulo="Entregue">{formatarDataHora(os.entregue_em)}</Item>}
      </dl>

      {estaAberta(os.status) && (
        <EditarEntrada
          ordemId={os.id}
          km={os.km}
          tanque={os.tanque}
          kmTravada={orcamento.enviado_em !== null}
        />
      )}

      <SecaoOrcamento ordemId={os.id} orcamento={orcamento} />

      <Link href="/painel" className="flex min-h-12 items-center font-medium text-placa hover:underline">
        ← Voltar para o início
      </Link>
    </section>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-zinc-600">{rotulo}</dt>
      <dd className="break-words text-zinc-900">{children}</dd>
    </div>
  );
}

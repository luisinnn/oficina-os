import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listarOrdensAtivas, type OrdemAtiva } from "@/lib/ordens";
import { ROTULO_STATUS, STATUS_ABERTOS } from "@/lib/status-ordem";
import { foiEnviado } from "@/lib/orcamento";
import { EtiquetaOrcamento } from "./etiqueta-orcamento";
import { FormBuscaPlaca } from "./form-busca-placa";

export const metadata: Metadata = { title: "Painel | oficina-os" };

// Tela inicial: buscar placa, abrir OS e ver as OS que estão na oficina.
export default function PainelPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="space-y-4">
        <FormBuscaPlaca />
        <Link
          href="/painel/os/nova"
          className="flex min-h-14 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-lg font-semibold text-white hover:bg-blue-700"
        >
          + Nova OS
        </Link>
      </section>

      {/* Ticket 09: "Pré-cadastros para confirmar" entra aqui. */}

      {/* Ler as OS depende do usuário logado: a busca e o botão aparecem na hora. */}
      <Suspense fallback={<p className="text-sm text-zinc-400">Carregando...</p>}>
        <OrdensAbertas />
      </Suspense>
    </div>
  );
}

async function OrdensAbertas() {
  const ordens = await listarOrdensAtivas();
  return (
    <div className="space-y-8">
      {STATUS_ABERTOS.map((status) => (
        <Grupo
          key={status}
          titulo={ROTULO_STATUS[status]}
          ordens={ordens.filter((os) => os.status === status)}
        />
      ))}
    </div>
  );
}

function Grupo({ titulo, ordens }: { titulo: string; ordens: OrdemAtiva[] }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">
        {titulo} <span className="font-normal text-zinc-500">({ordens.length})</span>
      </h2>
      {ordens.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma OS.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ordens.map((os) => (
            <li key={os.id}>
              <Link
                href={`/painel/os/${os.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-blue-400"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold text-zinc-900">#{os.numero}</span>
                  <span className="font-mono text-lg font-semibold tracking-wide text-zinc-800">
                    {os.veiculos.placa}
                  </span>
                </span>
                <span className="mt-1 block truncate text-zinc-700">{os.veiculos.modelo}</span>
                <span className="block truncate text-zinc-500">{os.clientes.nome}</span>
                {temOrcamento(os) && (
                  <span className="mt-2 block">
                    <EtiquetaOrcamento estado={os.orcamentos.estado} prefixo="Orçamento: " />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Orçamento sem item ainda não é orçamento: não mostra etiqueta.
function temOrcamento(os: OrdemAtiva) {
  return foiEnviado(os.orcamentos.estado) || os.orcamentos.orcamento_itens[0].count > 0;
}

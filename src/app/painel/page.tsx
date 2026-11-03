import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Placa } from "@/components/placa";
import { formatarDataHora } from "@/lib/formatos";
import { listarOrdensAtivas, listarPreCadastrosPendentes, type OrdemAtiva } from "@/lib/ordens";
import { agruparPorStatus, ROTULO_STATUS, type StatusAberto } from "@/lib/status-ordem";
import { foiEnviado } from "@/lib/orcamento";
import { EtiquetaOrcamento } from "./etiqueta-orcamento";
import { FormBuscaPlaca } from "./form-busca-placa";

export const metadata: Metadata = { title: "Painel | oficina-os" };

// Cor de cada status: faixa do cartão e do contador.
const FAIXA: Record<StatusAberto, string> = {
  aguardando: "border-l-sinal",
  em_servico: "border-l-grafite",
  pronto: "border-l-liberado",
};

const VAZIO: Record<StatusAberto, string> = {
  aguardando: "Nenhum carro aguardando.",
  em_servico: "Nenhum carro em serviço.",
  pronto: "Nenhum carro pronto.",
};

const ancora = (status: StatusAberto) => `grupo-${status}`;

// Tela inicial: buscar placa, abrir OS e ver as OS que estão na oficina,
// como um quadro de serviços.
export default function PainelPage() {
  return (
    <div className="space-y-6">
      <section className="mx-auto max-w-2xl space-y-3">
        <FormBuscaPlaca />
        <Link
          href="/painel/os/nova"
          className="flex min-h-14 w-full items-center justify-center rounded-lg bg-placa px-4 text-xl font-semibold text-white hover:bg-placa-escuro"
        >
          + Nova OS
        </Link>
      </section>

      <Suspense fallback={<Carregando />}>
        <PreCadastros />
      </Suspense>

      {/* Ler as OS depende do usuário logado: a busca e o botão aparecem na hora. */}
      <Suspense fallback={<Carregando />}>
        <Quadro />
      </Suspense>
    </div>
  );
}

function Carregando() {
  return <p className="text-sm text-zinc-600">Carregando...</p>;
}

async function Quadro() {
  const grupos = agruparPorStatus(await listarOrdensAtivas());
  return (
    <>
      {/* Resumo do dia e atalho: no celular os grupos ficam longe um do outro. */}
      <nav aria-label="Resumo por status" className="grid grid-cols-3 gap-2">
        {grupos.map(({ status, ordens }) => (
          <a
            key={status}
            href={`#${ancora(status)}`}
            className={`flex min-h-12 flex-col justify-center rounded-lg border-l-[6px] bg-chapa px-3 py-2 hover:bg-zinc-100 ${FAIXA[status]}`}
          >
            <span className="font-condensada text-destaque font-bold leading-none tabular-nums">{ordens.length}</span>
            <span className="text-sm">{ROTULO_STATUS[status]}</span>
          </a>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {grupos.map(({ status, ordens }) => (
          <Grupo key={status} status={status} ordens={ordens} />
        ))}
      </div>
    </>
  );
}

function Grupo({ status, ordens }: { status: StatusAberto; ordens: OrdemAtiva[] }) {
  return (
    <section id={ancora(status)} className="scroll-mt-4" aria-labelledby={`${ancora(status)}-titulo`}>
      <h2 id={`${ancora(status)}-titulo`} className="mb-2 text-xl font-semibold">
        {ROTULO_STATUS[status]} <span className="font-normal text-zinc-600">({ordens.length})</span>
      </h2>
      {ordens.length === 0 ? (
        <p className="text-zinc-600">{VAZIO[status]}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {ordens.map((os) => (
            <li key={os.id}>
              <Link
                href={`/painel/os/${os.id}`}
                className={`block rounded-lg border border-l-[6px] border-zinc-300 bg-chapa p-3 hover:border-y-grafite hover:border-r-grafite ${FAIXA[status]}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <Placa placa={os.veiculos.placa} />
                  <span className="font-condensada text-titulo font-bold tabular-nums">#{os.numero}</span>
                </span>
                <span className="mt-2 block truncate font-semibold">{os.veiculos.modelo}</span>
                <span className="block truncate text-zinc-700">{os.clientes.nome}</span>
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

// Pré-cadastros que chegaram pelo link público e esperam a oficina.
// Sem nenhum pendente, o bloco não aparece.
async function PreCadastros() {
  const pendentes = await listarPreCadastrosPendentes();
  if (pendentes.length === 0) return null;
  return (
    <section className="mx-auto max-w-2xl rounded-lg bg-sinal p-3">
      <h2 className="mb-2 text-xl font-semibold">
        {pendentes.length === 1 ? "1 pré-cadastro para confirmar" : `${pendentes.length} pré-cadastros para confirmar`}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {pendentes.map((pre) => (
          <li key={pre.id}>
            <Link
              href={`/painel/pre-cadastros/${pre.id}`}
              className="block rounded-lg border border-grafite/20 bg-chapa p-3 hover:border-grafite"
            >
              <span className="flex items-start justify-between gap-2">
                <Placa placa={pre.placa} />
                <span className="text-sm text-zinc-700">{formatarDataHora(pre.created_at)}</span>
              </span>
              <span className="mt-2 block truncate font-semibold">{pre.modelo}</span>
              <span className="block truncate text-zinc-700">{pre.nome}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

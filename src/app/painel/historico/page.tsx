import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Placa } from "@/components/placa";
import { getUsuario } from "@/lib/auth";
import { formatarReais } from "@/lib/dinheiro";
import {
  lerMes,
  limitesDoMes,
  mesAnterior,
  mesAtual,
  mesSeguinte,
  nomeDoMes,
  resumoDoMes,
  TAMANHO_BUSCA,
  termoBusca,
  textoFechamento,
  textoResumo,
  type TermoBusca,
} from "@/lib/historico";
import { buscarFechadas, LIMITE_BUSCA_HISTORICO, listarFechadasDoMes, type OrdemFechada } from "@/lib/ordens";

export const metadata: Metadata = { title: "Histórico | oficina-os" };

const ROTA = "/painel/historico";

const classeSeta =
  "flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-grafite bg-chapa font-condensada text-titulo font-bold hover:bg-zinc-100";

// OS entregues e canceladas: total do mês e busca por placa ou cliente.
// Mês e busca ficam no endereço (?mes=2026-10, ?busca=maria): o botão
// voltar do navegador funciona e dá para mandar o link.
export default function HistoricoPage({ searchParams }: PageProps<"/painel/historico">) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="sr-only">Histórico das OS fechadas</h1>
      {/* Ler o endereço e as OS é por pedido: o resto da tela vem na hora. */}
      <Suspense fallback={<p className="text-sm text-zinc-600">Carregando...</p>}>
        <Historico searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const umValor = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Historico({ searchParams }: Pick<PageProps<"/painel/historico">, "searchParams">) {
  // Login antes de tudo: também marca a página como "só na hora do pedido",
  // senão o Next tenta pré-montar e reclama da data de hoje (mês atual).
  await getUsuario();
  const params = await searchParams;
  const termo = termoBusca(umValor(params.busca));
  return (
    <>
      <FormBusca valor={termo?.nome} />
      {termo ? <ResultadoBusca termo={termo} /> : <Mes mes={lerMes(umValor(params.mes))} />}
    </>
  );
}

// Formulário comum (GET): a busca vai para o endereço sem precisar de JS.
function FormBusca({ valor }: { valor?: string }) {
  return (
    <form action={ROTA} role="search">
      <label htmlFor="busca-historico" className="text-sm font-semibold">
        Buscar OS fechada
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="busca-historico"
          name="busca"
          type="search"
          maxLength={TAMANHO_BUSCA}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Placa ou nome"
          defaultValue={valor}
          className="min-h-12 min-w-0 flex-1 rounded-lg border-2 border-zinc-500 bg-chapa px-3 py-2 text-base text-grafite focus:border-placa focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-lg border-2 border-grafite bg-chapa px-4 font-semibold text-grafite hover:bg-zinc-100"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}

async function Mes({ mes }: { mes: string }) {
  const ordens = await listarFechadasDoMes(limitesDoMes(mes));
  const resumo = resumoDoMes(ordens);
  const nome = nomeDoMes(mes);
  const ehAtual = mes === mesAtual();

  return (
    <section aria-labelledby="titulo-mes" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`${ROTA}?mes=${mesAnterior(mes)}`} aria-label="Mês anterior" className={classeSeta}>
          ‹
        </Link>
        <h2 id="titulo-mes" className="text-center text-xl font-semibold first-letter:uppercase">
          {nome}
        </h2>
        {/* No mês atual não tem "próximo": fica o espaço para o título não sair do centro. */}
        {ehAtual ? (
          <span aria-hidden="true" className="min-w-12" />
        ) : (
          <Link href={`${ROTA}?mes=${mesSeguinte(mes)}`} aria-label="Próximo mês" className={classeSeta}>
            ›
          </Link>
        )}
      </div>

      {ordens.length === 0 ? (
        <p className="text-zinc-700">Nenhuma OS fechada em {nome}.</p>
      ) : (
        <>
          <div>
            <p className="font-condensada text-destaque font-bold leading-none tabular-nums">
              {formatarReais(resumo.totalCentavos)}
            </p>
            <p className="mt-1 text-zinc-700">{textoResumo(resumo)}</p>
          </div>
          <Lista ordens={ordens} />
        </>
      )}
    </section>
  );
}

async function ResultadoBusca({ termo }: { termo: TermoBusca }) {
  const ordens = await buscarFechadas(termo);
  return (
    <section aria-labelledby="titulo-busca" className="space-y-4">
      <h2 id="titulo-busca" className="text-xl font-semibold">
        Busca: &ldquo;{termo.nome}&rdquo;
      </h2>
      {ordens.length === 0 ? (
        <p className="text-zinc-700">Nenhuma OS fechada com &ldquo;{termo.nome}&rdquo;.</p>
      ) : (
        <>
          {ordens.length === LIMITE_BUSCA_HISTORICO && (
            <p className="text-sm text-zinc-700">Mostrando as {LIMITE_BUSCA_HISTORICO} mais recentes.</p>
          )}
          <Lista ordens={ordens} comAno />
        </>
      )}
      <Link href={ROTA} className="flex min-h-12 items-center font-medium text-placa hover:underline">
        Ver o mês atual
      </Link>
    </section>
  );
}

// Lista para ler em sequência: linhas separadas por fio, sem cartão.
function Lista({ ordens, comAno = false }: { ordens: OrdemFechada[]; comAno?: boolean }) {
  return (
    <ul className="divide-y divide-zinc-300 border-y border-zinc-300">
      {ordens.map((os) => (
        <li key={os.id}>
          <Link href={`/painel/os/${os.id}`} className="block py-3 hover:bg-chapa">
            <span className="flex items-start gap-3">
              <Placa placa={os.placa} tamanho="p" />
              <span className="flex-1 font-condensada text-xl font-bold tabular-nums">
                <Valor os={os} />
              </span>
              <span className="font-condensada text-xl font-bold tabular-nums">#{os.numero}</span>
            </span>
            <span className="mt-1 block truncate">
              {os.modelo} · {os.cliente}
            </span>
            <span className="block text-sm text-zinc-700">{textoFechamento(os, comAno)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Valor({ os }: { os: OrdemFechada }) {
  if (os.status === "cancelada") return <span className="text-zinc-600">Cancelada</span>;
  if (os.valor_centavos === null) return <span className="font-sans text-base font-normal text-zinc-600">sem valor</span>;
  return formatarReais(os.valor_centavos);
}

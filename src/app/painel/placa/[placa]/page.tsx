import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatarDataHora, formatarTelefone, normalizarPlaca, validarPlaca } from "@/lib/formatos";
import { Placa } from "@/components/placa";
import { buscarCarro } from "@/lib/ordens";
import { ROTULO_STATUS, textoOsAberta } from "@/lib/status-ordem";

export const metadata: Metadata = { title: "Placa | oficina-os" };

const classeBotao =
  "flex min-h-12 w-full items-center justify-center rounded-md bg-placa px-4 py-2 font-medium text-white hover:bg-placa-escuro";

// Resultado da busca por placa: dono atual e histórico, ou "Placa nova".
export default function PlacaPage({ params }: PageProps<"/painel/placa/[placa]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Carregando...</p>}>
      <ResultadoPlaca params={params} />
    </Suspense>
  );
}

async function ResultadoPlaca({ params }: Pick<PageProps<"/painel/placa/[placa]">, "params">) {
  // O Next entrega o trecho da URL ainda codificado ("ABC%201234").
  const placa = normalizarPlaca(decodeURIComponent((await params).placa));

  if (!validarPlaca(placa)) {
    return (
      <Moldura titulo="Placa inválida">
        <p className="text-zinc-600">Use o formato ABC1234 ou ABC1D23.</p>
      </Moldura>
    );
  }

  const carro = await buscarCarro(placa);
  const novaOs = `/painel/os/nova?placa=${placa}`;

  if (!carro) {
    return (
      <Moldura titulo={<Placa placa={placa} tamanho="g" />}>
        <p className="text-zinc-600">Placa nova: este carro ainda não passou pela oficina.</p>
        <Link href={novaOs} className={classeBotao}>
          Cadastrar OS
        </Link>
      </Moldura>
    );
  }

  return (
    <Moldura titulo={<Placa placa={placa} tamanho="g" />}>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-600">{carro.modelo}</p>
        <p className="mt-2 font-semibold text-zinc-900">{carro.dono.nome}</p>
        <p className="text-zinc-700">{formatarTelefone(carro.dono.telefone)}</p>
      </div>

      {carro.aberta ? (
        // Uma OS aberta por carro: em vez de "nova OS", leva para a que já existe.
        <div className="space-y-3 rounded-md bg-amber-50 p-3 text-zinc-900">
          <p>{textoOsAberta(carro.aberta.numero, carro.aberta.status)}</p>
          <Link href={`/painel/os/${carro.aberta.id}`} className={classeBotao}>
            Abrir a OS #{carro.aberta.numero}
          </Link>
        </div>
      ) : (
        <Link href={novaOs} className={classeBotao}>
          Nova OS para este carro
        </Link>
      )}

      <h2 className="pt-2 text-xl font-semibold text-zinc-900">Histórico</h2>
      {carro.historico.length === 0 ? (
        <p className="text-sm text-zinc-600">Nenhuma OS ainda.</p>
      ) : (
        <ul className="space-y-2">
          {carro.historico.map((os) => (
            <li key={os.id}>
              <Link
                href={`/painel/os/${os.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-grafite"
              >
                <span className="flex justify-between gap-2 text-sm">
                  <span className="font-semibold text-zinc-900">#{os.numero}</span>
                  <span className="text-zinc-600">
                    {formatarDataHora(os.created_at)} · {ROTULO_STATUS[os.status]}
                  </span>
                </span>
                <span className="mt-1 block truncate text-zinc-700">{os.problema}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Moldura>
  );
}

function Moldura({ titulo, children }: { titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-titulo font-bold text-zinc-900">{titulo}</h1>
      {children}
      <Link href="/painel" className="flex min-h-12 items-center font-medium text-placa hover:underline">
        ← Voltar para o início
      </Link>
    </section>
  );
}

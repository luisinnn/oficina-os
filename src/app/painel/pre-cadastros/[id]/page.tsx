import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Placa } from "@/components/placa";
import { formatarDataHora, formatarTelefone } from "@/lib/formatos";
import { buscarCarro, buscarPreCadastro } from "@/lib/ordens";
import { textoOsAberta } from "@/lib/status-ordem";
import { AcoesPreCadastro } from "./acoes-pre-cadastro";

export const metadata: Metadata = { title: "Pré-cadastro | Pátio" };

// Detalhe do pré-cadastro: dados enviados pelo cliente e Confirmar/Descartar.
export default function PreCadastroPage({ params }: PageProps<"/painel/pre-cadastros/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Carregando...</p>}>
      <Detalhe params={params} />
    </Suspense>
  );
}

async function Detalhe({ params }: Pick<PageProps<"/painel/pre-cadastros/[id]">, "params">) {
  const { id } = await params;
  const pre = await buscarPreCadastro(id);
  if (!pre) notFound();

  const pendente = pre.situacao === "pendente";
  const carro = pendente ? await buscarCarro(pre.placa) : null;
  const outroDono = carro && (carro.dono.nome !== pre.nome || carro.dono.telefone !== pre.telefone);

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900">Pré-cadastro</h1>

      <dl className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <Item rotulo="Carro">
          <Placa placa={pre.placa} tamanho="p" /> · {pre.modelo}
        </Item>
        <Item rotulo="Cliente">
          {pre.nome} · {formatarTelefone(pre.telefone)}
        </Item>
        <Item rotulo="Problema">
          <span className="whitespace-pre-wrap">{pre.problema}</span>
        </Item>
        <Item rotulo="Recebido">{formatarDataHora(pre.created_at)}</Item>
      </dl>

      {!pendente ? (
        <p role="status" className="rounded-md bg-zinc-100 p-3 text-zinc-700">
          {pre.situacao === "confirmado" && pre.ordem_id ? (
            <>
              Já confirmado.
              <Link
                href={`/painel/os/${pre.ordem_id}`}
                className="mt-1 flex min-h-12 items-center font-medium text-placa underline"
              >
                Abrir a OS
              </Link>
            </>
          ) : (
            "Pré-cadastro descartado."
          )}
        </p>
      ) : (
        <>
          {carro?.aberta && (
            <div role="alert" className="rounded-md bg-amber-50 p-3 text-zinc-900">
              <p>{textoOsAberta(carro.aberta.numero, carro.aberta.status)}</p>
              <Link
                href={`/painel/os/${carro.aberta.id}`}
                className="mt-1 flex min-h-12 items-center font-medium underline"
              >
                Abrir a OS #{carro.aberta.numero}
              </Link>
            </div>
          )}

          {carro && outroDono && !carro.aberta && (
            // Lado a lado: quem está no cadastro e quem mandou o pré-cadastro.
            <div className="space-y-2 rounded-md bg-amber-50 p-3 text-zinc-900">
              <p>Esta placa já está no nome de outro cliente.</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Pessoa titulo="No cadastro" nome={carro.dono.nome} telefone={carro.dono.telefone} />
                <Pessoa titulo="No pré-cadastro" nome={pre.nome} telefone={pre.telefone} />
              </div>
            </div>
          )}

          <AcoesPreCadastro
            id={pre.id}
            podeConfirmar={!carro?.aberta}
            troca={carro && outroDono ? { atual: carro.dono.nome, novo: pre.nome } : undefined}
          />
        </>
      )}

      <Link href="/painel" className="flex min-h-12 items-center font-medium text-placa hover:underline">
        ← Voltar para o início
      </Link>
    </section>
  );
}

function Pessoa({ titulo, nome, telefone }: { titulo: string; nome: string; telefone: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-white p-2">
      <p className="text-zinc-600">{titulo}</p>
      <p className="break-words font-medium">{nome}</p>
      <p>{formatarTelefone(telefone)}</p>
    </div>
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

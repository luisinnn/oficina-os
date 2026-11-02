import type { Metadata } from "next";
import { Suspense } from "react";
import { type OrcamentoPublico, type Resposta, situacaoDoLink, tokenComFormato } from "@/lib/aprovacao";
import { formatarReais } from "@/lib/dinheiro";
import { ROTULO_TIPO, subtotal } from "@/lib/orcamento";
import { createClientPublico } from "@/lib/supabase/publico";
import { FormResposta, LinkInvalido, Respondido } from "./form-resposta";

// O token está no endereço: buscadores não indexam e o navegador não manda o
// endereço para outros sites (o cabeçalho Referrer-Policy está no
// next.config.ts; aqui vai a meta tag também).
export const metadata: Metadata = {
  title: "Orçamento",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Página pública (sem login) em que o cliente vê o orçamento e aprova ou
// recusa. Tudo passa pela função ver_orcamento do banco.
export default function AprovarPage({ params }: PageProps<"/aprovar/[token]">) {
  return (
    <main className="flex flex-1 justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<p className="text-zinc-500">Carregando...</p>}>
          <Orcamento params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Orcamento({ params }: Pick<PageProps<"/aprovar/[token]">, "params">) {
  const { token } = await params;
  const orcamento = await lerOrcamentoPublico(token);
  const situacao = situacaoDoLink(orcamento);

  if (situacao === "invalido" || !orcamento) return <LinkInvalido />;

  return (
    <section className="space-y-4">
      <header>
        <p className="text-lg font-semibold text-zinc-900">{orcamento.oficina}</p>
        <h1 className="text-2xl font-bold text-zinc-900">Orçamento · OS #{orcamento.numero}</h1>
        <p className="text-zinc-700">
          {orcamento.modelo} · {orcamento.placa}
        </p>
      </header>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <ul className="divide-y divide-zinc-200">
          {orcamento.itens.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block break-words text-zinc-900">{item.descricao}</span>
                <span className="block text-sm text-zinc-500">
                  {ROTULO_TIPO[item.tipo]} · {item.quantidade} × {formatarReais(item.valor_unitario_centavos)}
                </span>
              </span>
              <span className="shrink-0 font-medium text-zinc-900">{formatarReais(subtotal(item))}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between border-t border-zinc-200 pt-3">
          <span className="text-lg font-medium text-zinc-700">Total</span>
          <span className="text-3xl font-bold text-zinc-900">{formatarReais(orcamento.total_centavos)}</span>
        </p>
      </div>

      {situacao === "respondido" ? (
        <Respondido resposta={orcamento.estado as Resposta} />
      ) : (
        <FormResposta token={token} />
      )}
    </section>
  );
}

// null = link inválido. Token fora do formato nem chega ao banco. O token não
// vai para log.
async function lerOrcamentoPublico(token: string): Promise<OrcamentoPublico | null> {
  if (!tokenComFormato(token)) return null;
  const { data, error } = await createClientPublico().rpc("ver_orcamento", { token });
  if (error) throw new Error(`Erro ao ler o orçamento: ${error.code ?? "sem código"}`);
  return data as OrcamentoPublico | null;
}

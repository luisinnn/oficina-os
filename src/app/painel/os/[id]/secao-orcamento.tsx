import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/formatos";
import { foiEnviado, ROTULO_TIPO, subtotal, type TipoItem } from "@/lib/orcamento";
import type { Orcamento } from "@/lib/ordens";
import { EtiquetaOrcamento } from "../../etiqueta-orcamento";
import { BotaoWhatsApp } from "./botao-whatsapp";

// Orçamento no detalhe da OS: itens, total, botões de adicionar e o
// histórico de respostas do cliente (fica mesmo depois de editar).
export function SecaoOrcamento({ ordemId, orcamento }: { ordemId: string; orcamento: Orcamento }) {
  const urlNovoItem = (tipo: TipoItem) => `/painel/os/${ordemId}/itens/novo?tipo=${tipo}`;

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-900">Orçamento</h2>
        <EtiquetaOrcamento estado={orcamento.estado} />
      </div>

      {orcamento.itens.length === 0 ? (
        <p className="text-zinc-500">Nenhum item ainda.</p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {orcamento.itens.map((item) => (
            <li key={item.id}>
              <Link
                href={`/painel/os/${ordemId}/itens/${item.id}`}
                className="flex min-h-14 items-center justify-between gap-3 py-2 hover:bg-zinc-50"
              >
                <span className="min-w-0">
                  <span className="block break-words text-zinc-900">{item.descricao}</span>
                  <span className="block text-sm text-zinc-500">
                    {ROTULO_TIPO[item.tipo]} · {item.quantidade} × {formatarReais(item.valor_unitario_centavos)}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-zinc-900">{formatarReais(subtotal(item))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-baseline justify-between border-t border-zinc-200 pt-3">
        <span className="text-lg font-medium text-zinc-700">Total</span>
        <span className="text-3xl font-bold text-zinc-900">{formatarReais(orcamento.total_centavos)}</span>
      </p>

      {orcamento.itens.length > 0 && (
        <BotaoWhatsApp ordemId={ordemId} jaEnviado={foiEnviado(orcamento.estado)} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <BotaoAdicionar href={urlNovoItem("peca")}>+ Peça</BotaoAdicionar>
        <BotaoAdicionar href={urlNovoItem("mao_de_obra")}>+ Mão de obra</BotaoAdicionar>
      </div>

      {orcamento.respostas.length > 0 && (
        <div className="space-y-2 border-t border-zinc-200 pt-3">
          <h3 className="font-semibold text-zinc-900">Respostas do cliente</h3>
          <ul className="space-y-2">
            {orcamento.respostas.map((r) => (
              <li key={r.id} className="rounded-md bg-zinc-50 p-3 text-sm">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <EtiquetaOrcamento estado={r.resposta} />
                  <span className="font-medium text-zinc-900">{formatarReais(r.total_centavos)}</span>
                </span>
                <span className="mt-1 block text-zinc-500">{formatarDataHora(r.respondido_em)}</span>
                {r.motivo && <span className="mt-1 block break-words text-zinc-800">Motivo: {r.motivo}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BotaoAdicionar({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-center rounded-md border border-blue-600 px-3 font-medium text-blue-700 hover:bg-blue-50"
    >
      {children}
    </Link>
  );
}

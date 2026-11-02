import { type EstadoOrcamento, ROTULO_ESTADO } from "@/lib/orcamento";

const COR: Record<EstadoOrcamento, string> = {
  rascunho: "bg-zinc-100 text-zinc-700",
  enviado: "bg-amber-100 text-amber-900",
  aprovado: "bg-green-100 text-green-800",
  recusado: "bg-red-100 text-red-800",
};

// Estado do orçamento, no detalhe da OS e no cartão da tela inicial.
export function EtiquetaOrcamento({ estado, prefixo = "" }: { estado: EstadoOrcamento; prefixo?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${COR[estado]}`}>
      {prefixo}
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

import { type EstadoOrcamento, ROTULO_ESTADO } from "@/lib/orcamento";

const COR: Record<EstadoOrcamento, string> = {
  rascunho: "bg-zinc-200 text-grafite",
  enviado: "bg-sinal text-grafite",
  aprovado: "bg-liberado text-white",
  recusado: "bg-red-700 text-white",
};

// Estado do orçamento, no detalhe da OS e no cartão da tela inicial.
export function EtiquetaOrcamento({ estado, prefixo = "" }: { estado: EstadoOrcamento; prefixo?: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${COR[estado]}`}>
      {prefixo}
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

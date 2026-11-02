"use server";

import { limparMotivo, type OrcamentoPublico, type Resposta, situacaoDoLink, tokenComFormato } from "@/lib/aprovacao";
import { createClientPublico } from "@/lib/supabase/publico";

export type EstadoResposta = {
  resposta?: Resposta;
  // Link anulado, vencido ou já respondido (em outra aba ou num toque duplo).
  invalido?: boolean;
  erro?: string;
};

// Resposta do cliente pela função responder_orcamento, que só aceita uma vez.
// Página pública: não há login para conferir; quem vale é o token. Ele não
// vai para log.
export async function responderOrcamento(_estadoAnterior: EstadoResposta, formData: FormData): Promise<EstadoResposta> {
  const token = String(formData.get("token") ?? "");
  const aprovar = formData.get("acao") === "aprovar";
  if (!tokenComFormato(token)) return { invalido: true };

  const motivoLimpo = aprovar ? { motivo: null } : limparMotivo(String(formData.get("motivo") ?? ""));
  if ("erro" in motivoLimpo) return { erro: motivoLimpo.erro };

  const { data, error } = await createClientPublico().rpc("responder_orcamento", {
    token,
    aprovar,
    motivo: motivoLimpo.motivo,
  });

  if (!error) return { resposta: data as Resposta };
  if (error.code === "P0002") {
    // Toque duplo: a primeira resposta valeu e a segunda deu "não encontrado".
    // Mostra a resposta que ficou, em vez de "link inválido".
    const atual = await createClientPublico().rpc("ver_orcamento", { token });
    const orcamento = atual.data as OrcamentoPublico | null;
    if (situacaoDoLink(orcamento) === "respondido") {
      return { resposta: orcamento!.estado as Resposta };
    }
    return { invalido: true };
  }
  console.error("responderOrcamento:", error.code ?? "sem código");
  return { erro: "Não foi possível enviar sua resposta. Tente de novo." };
}

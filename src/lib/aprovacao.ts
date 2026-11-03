// Página pública de aprovação (/aprovar/<token>). Arquivo "puro" (sem banco
// nem Next.js), testado em aprovacao.test.ts.
//
// O limite do motivo também está na função responder_orcamento e no CHECK de
// orcamentos.motivo_recusa (supabase/migrations/): se mudar aqui, mude lá.

import type { DadosItem, EstadoOrcamento } from "./orcamento";

export const MOTIVO_MAX = 500;

// O que o cliente pode responder (estado do orçamento depois da resposta).
export type Resposta = Extract<EstadoOrcamento, "aprovado" | "recusado">;

// O que a função ver_orcamento devolve (mesmos nomes).
export type OrcamentoPublico = {
  oficina: string;
  numero: number;
  placa: string;
  modelo: string;
  // Km de entrada (null em OS antigas): o cliente aprova sabendo com quantos km o carro chegou.
  km: number | null;
  itens: DadosItem[];
  total_centavos: number;
  estado: EstadoOrcamento;
  expirado: boolean;
};

// Token gerado por enviar_orcamento: 32 bytes em base64url = 43 caracteres.
// Fora disso nem vale perguntar ao banco.
export function tokenComFormato(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

// Motivo da recusa (opcional). Vazio vira null, como no banco.
export function limparMotivo(texto: string | null): { motivo: string | null } | { erro: string } {
  const motivo = (texto ?? "").trim();
  if (!motivo) return { motivo: null };
  // Array.from conta caracteres (um emoji = 1), igual ao char_length do banco.
  if (Array.from(motivo).length > MOTIVO_MAX) {
    return { erro: `O motivo pode ter no máximo ${MOTIVO_MAX} caracteres.` };
  }
  return { motivo };
}

// O que a página mostra:
// - invalido: "Link expirado ou inválido" (sem dizer qual dos dois);
// - aberto: orçamento com os botões Aprovar e Recusar;
// - respondido: a resposta já dada, sem botões (mesmo depois do prazo).
export type SituacaoLink = "invalido" | "aberto" | "respondido";

export function situacaoDoLink(orcamento: OrcamentoPublico | null): SituacaoLink {
  if (!orcamento) return "invalido";
  if (orcamento.estado === "aprovado" || orcamento.estado === "recusado") return "respondido";
  if (orcamento.estado === "enviado" && !orcamento.expirado) return "aberto";
  return "invalido";
}

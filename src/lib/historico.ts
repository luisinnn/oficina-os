// Histórico das OS fechadas (ticket 14): contas do mês, mês no endereço e
// termo de busca. Arquivo "puro" (sem banco nem Next.js), testado em
// historico.test.ts.
//
// Mês = "AAAA-MM", contado no fuso da oficina: OS entregue às 22h do dia 31
// em São Paulo (já dia 1 em UTC) conta no dia 31.

import { FUSO, normalizarPlaca } from "@/lib/formatos";
import { formatarKm } from "@/lib/km";
import { ROTULO_STATUS, type StatusFechado, type StatusOrdem } from "@/lib/status-ordem";

const MES = /^([0-9]{4})-(0[1-9]|1[0-2])$/;

const partesSP = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function lerPartes(instante: Date) {
  const p = Object.fromEntries(partesSP.formatToParts(instante).map(({ type, value }) => [type, Number(value)]));
  return p as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

// "2026-11-01T01:00:00Z" -> "2026-10" (era 31/10 22h em São Paulo).
export function mesDe(instante: string | Date): string {
  const { year, month } = lerPartes(new Date(instante));
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function mesAtual(agora: Date = new Date()): string {
  return mesDe(agora);
}

// ?mes= do endereço. Sem mês, formato errado ou mês futuro: mês atual.
// "AAAA-MM" compara certo como texto.
export function lerMes(texto: string | undefined, agora: Date = new Date()): string {
  const atual = mesAtual(agora);
  if (!texto || !MES.test(texto) || texto > atual) return atual;
  return texto;
}

function somarMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export const mesAnterior = (mes: string) => somarMeses(mes, -1);
export const mesSeguinte = (mes: string) => somarMeses(mes, 1);

// Meia-noite do dia 1 em São Paulo, em UTC. Mede a diferença do fuso naquele
// instante em vez de fixar -03:00 (horário de verão já existiu e pode voltar).
function inicioEmSP(mes: string): Date {
  const [ano, m] = mes.split("-").map(Number);
  const palpite = Date.UTC(ano, m - 1, 1);
  const p = lerPartes(new Date(palpite));
  const comoSeFosseUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(palpite + (palpite - comoSeFosseUTC));
}

// Intervalo do mês para a busca no banco: inicio <= fechada_em < fim (ISO, UTC).
export type LimitesMes = { inicio: string; fim: string };

export function limitesDoMes(mes: string): LimitesMes {
  return { inicio: inicioEmSP(mes).toISOString(), fim: inicioEmSP(mesSeguinte(mes)).toISOString() };
}

const nomeMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long" });

// "2026-10" -> "outubro de 2026".
export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${nomeMes.format(new Date(Date.UTC(ano, m - 1, 15)))} de ${ano}`;
}

export type ResumoMes = { totalCentavos: number; entregues: number; canceladas: number };

// Total = soma do valor aprovado das entregues. Cancelada conta na lista,
// mas não no total; OS sem valor (sem orçamento aprovado) também não soma.
export function resumoDoMes(
  ordens: readonly { status: StatusOrdem; valor_centavos: number | null }[],
): ResumoMes {
  const resumo: ResumoMes = { totalCentavos: 0, entregues: 0, canceladas: 0 };
  for (const os of ordens) {
    if (os.status === "entregue") {
      resumo.entregues++;
      resumo.totalCentavos += os.valor_centavos ?? 0;
    } else if (os.status === "cancelada") {
      resumo.canceladas++;
    }
  }
  return resumo;
}

const contagem = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

// "23 entregues, 2 canceladas". Zero não aparece.
export function textoResumo({ entregues, canceladas }: ResumoMes): string {
  return [
    entregues > 0 ? contagem(entregues, "entregue", "entregues") : null,
    canceladas > 0 ? contagem(canceladas, "cancelada", "canceladas") : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export const TAMANHO_BUSCA = 60;

// O que a pessoa digitou na busca. Fica só letra, número, espaço, hífen e
// apóstrofo: o resto (% _ * , ( ) " \) mudaria o filtro do banco.
// placa = mesmo texto no formato do banco ("abc-1234" -> "ABC1234"), ou null
// se tiver algo que nunca está numa placa. null = sem busca.
export function termoBusca(texto: string | undefined): { nome: string; placa: string | null } | null {
  const nome = (texto ?? "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAMANHO_BUSCA);
  if (!nome) return null;
  const placa = normalizarPlaca(nome);
  return { nome, placa: /^[A-Z0-9]+$/.test(placa) ? placa : null };
}

const diaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
const diaMesAno = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });

// "Entregue em 28/10 · 120.300 km". Com ano na busca, que junta vários meses.
export function textoFechamento(
  os: { status: StatusFechado; fechada_em: string; km: number | null },
  comAno = false,
): string {
  const dia = (comAno ? diaMesAno : diaMes).format(new Date(os.fechada_em));
  const km = os.km === null ? "km não anotada" : formatarKm(os.km);
  return `${ROTULO_STATUS[os.status]} em ${dia} · ${km}`;
}

export type TermoBusca = NonNullable<ReturnType<typeof termoBusca>>;

// Filtro "or" da API do Supabase para a view historico_ordens: parte do nome
// do cliente ou da placa, sem diferenciar maiúscula. Valor entre aspas: o
// termo já veio limpo de termoBusca(), mas assim vírgula e ponto nunca quebram.
export function filtroBusca(termo: TermoBusca): string {
  const filtros = [`cliente.ilike."*${termo.nome}*"`];
  if (termo.placa) filtros.push(`placa.ilike."*${termo.placa}*"`);
  return filtros.join(",");
}

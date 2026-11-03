// Status da OS: nomes para a tela. Os mesmos valores estão no CHECK da tabela
// ordens. A regra de "aberta" também está no banco: índice
// ordens_uma_aberta_por_veiculo e função criar_ordem (supabase/migrations/).
// Se mudar aqui, mude lá.

export type StatusOrdem = "aguardando" | "em_servico" | "pronto" | "entregue" | "cancelada";

// OS "aberta" = ainda na oficina. Aparecem na tela inicial, nesta ordem.
export const STATUS_ABERTOS = ["aguardando", "em_servico", "pronto"] as const satisfies StatusOrdem[];

export const ROTULO_STATUS: Record<StatusOrdem, string> = {
  aguardando: "Aguardando",
  em_servico: "Em serviço",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export function estaAberta(status: StatusOrdem): boolean {
  return (STATUS_ABERTOS as readonly StatusOrdem[]).includes(status);
}

export type StatusAberto = (typeof STATUS_ABERTOS)[number];

// As OS abertas separadas nos grupos da tela inicial, na ordem de
// STATUS_ABERTOS. Cada grupo mantém a ordem em que as OS chegaram.
export function agruparPorStatus<T extends { status: StatusOrdem }>(
  ordens: readonly T[],
): { status: StatusAberto; ordens: T[] }[] {
  return STATUS_ABERTOS.map((status) => ({ status, ordens: ordens.filter((os) => os.status === status) }));
}

// Transições (as mesmas da função mudar_status, migração *_mudar_status.sql):
// avança e volta um passo pelo FLUXO; entregue não volta; cancela de
// qualquer status aberto; cancelada não volta.
const FLUXO = ["aguardando", "em_servico", "pronto", "entregue"] as const satisfies StatusOrdem[];

// -1 = fora do fluxo (cancelada).
const posicaoNoFluxo = (status: StatusOrdem) => (FLUXO as readonly StatusOrdem[]).indexOf(status);

export function proximoStatus(status: StatusOrdem): StatusOrdem | null {
  const i = posicaoNoFluxo(status);
  return i === -1 ? null : (FLUXO[i + 1] ?? null);
}

export function statusAnterior(status: StatusOrdem): StatusOrdem | null {
  if (!estaAberta(status)) return null;
  return FLUXO[posicaoNoFluxo(status) - 1] ?? null;
}

export function podeCancelar(status: StatusOrdem): boolean {
  return estaAberta(status);
}

// "Este carro já está na OS #12 (em serviço)."
export function textoOsAberta(numero: number, status: StatusOrdem): string {
  return `Este carro já está na OS #${numero} (${ROTULO_STATUS[status].toLowerCase()}).`;
}

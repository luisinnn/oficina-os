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

// "Este carro já está na OS #12 (em serviço)."
export function textoOsAberta(numero: number, status: StatusOrdem): string {
  return `Este carro já está na OS #${numero} (${ROTULO_STATUS[status].toLowerCase()}).`;
}

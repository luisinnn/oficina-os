// Km de entrada e nível do tanque (ticket 15). Arquivo "puro" (sem banco nem
// Next.js), testado em km.test.ts.
//
// A km de entrada é a prova da garantia das peças: obrigatória em OS nova e
// travada no banco depois do envio do orçamento (migração *_km_e_tanque.sql).

// Teto contra número absurdo (CHECK ordens_km_max, migração *_criar_ordem.sql).
export const KM_MAX = 9_999_999;

// Mesmas opções do CHECK de ordens.tanque: se mudar aqui, mude lá.
export const TANQUES = ["reserva", "1/4", "1/2", "3/4", "cheio"] as const;
export type Tanque = (typeof TANQUES)[number];

export const ROTULO_TANQUE: Record<Tanque, string> = {
  reserva: "Reserva",
  "1/4": "1/4",
  "1/2": "1/2",
  "3/4": "3/4",
  cheio: "Cheio",
};

// Km obrigatória. "120.000" e "120 000" são jeitos comuns de escrever.
export function lerKm(texto: string): { km: number } | { erro: string } {
  const limpo = texto.trim();
  if (!limpo) return { erro: "Informe a km do painel." };
  const digitos = limpo.replace(/[\s.]/g, "");
  const km = /^[0-9]+$/.test(digitos) ? Number(digitos) : NaN;
  if (!(km <= KM_MAX)) return { erro: "Km inválida: use só números." };
  return { km };
}

// Tanque opcional: vazio = não anotado.
export function lerTanque(texto: string): { tanque: Tanque | null } | { erro: string } {
  if (!texto) return { tanque: null };
  if ((TANQUES as readonly string[]).includes(texto)) return { tanque: texto as Tanque };
  return { erro: "Escolha uma das opções do tanque." };
}

export type ValoresEntrada = { km: string; tanque: string };
export type ErrosEntrada = Partial<Record<keyof ValoresEntrada, string>>;

// Km e tanque de um formulário (confirmação do pré-cadastro e correção no
// detalhe da OS). comKm = false quando a km já está travada e nem é enviada.
// "dados" só vem sem erro; km null = não mexer na km.
export function lerEntrada(
  formData: FormData,
  comKm: boolean,
): { valores: ValoresEntrada; erros: ErrosEntrada; dados?: { km: number | null; tanque: Tanque | null } } {
  const valores = { km: String(formData.get("km") ?? ""), tanque: String(formData.get("tanque") ?? "") };
  const km = comKm ? lerKm(valores.km) : { km: null };
  const tanque = lerTanque(valores.tanque);
  const erros: ErrosEntrada = {};
  if ("erro" in km) erros.km = km.erro;
  if ("erro" in tanque) erros.tanque = tanque.erro;
  if ("erro" in km || "erro" in tanque) return { valores, erros };
  return { valores, erros, dados: { km: km.km, tanque: tanque.tanque } };
}

// Aviso "Confere a km?": texto e a km avisada (o formulário devolve em
// km_conferida, e a confirmação só vale para essa km).
export type AvisoDeKm = { texto: string; km: number };

export function kmFoiConferida(formData: FormData, km: number): boolean {
  return formData.get("km_conferida") === String(km);
}

export const TEXTO_KM_TRAVADA = "A km não muda mais: o orçamento já foi enviado ao cliente.";

// Km da OS mais recente deste carro que tem km anotada. historico vem do mais
// recente para o mais antigo; "exceto" tira a própria OS (ao corrigir).
export function ultimaKm(historico: { id: string; km: number | null }[], exceto?: string): number | null {
  return historico.find((o) => o.id !== exceto && o.km !== null)?.km ?? null;
}

// Km menor que a última: avisa, mas não bloqueia (painel trocado, erro antigo).
export function kmMenorQueUltima(km: number, ultima: number | null): boolean {
  return ultima !== null && km < ultima;
}

export function textoKmMenor(ultima: number): string {
  return `A última OS deste carro anotou ${formatarKm(ultima)}. Confere a km?`;
}

const milhar = new Intl.NumberFormat("pt-BR");

export function formatarKm(km: number): string {
  return `${milhar.format(km)} km`;
}

function textoTanque(tanque: Tanque): string {
  return tanque === "reserva" ? "tanque na reserva" : `tanque ${ROTULO_TANQUE[tanque].toLowerCase()}`;
}

// "Entrada com 120.300 km, tanque 1/4". OS antigas podem não ter km.
export function textoEntrada(km: number | null, tanque: Tanque | null): string {
  const inicio = km === null ? "Km não anotada" : `Entrada com ${formatarKm(km)}`;
  return tanque ? `${inicio}, ${textoTanque(tanque)}` : inicio;
}

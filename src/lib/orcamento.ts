// Orçamento da OS: tipos, nomes para a tela e validação do item. Arquivo
// "puro" (sem banco nem Next.js), testado em orcamento.test.ts.
//
// Os mesmos valores e limites estão nos CHECKs das tabelas orcamentos e
// orcamento_itens (supabase/migrations/*_orcamento.sql): se mudar aqui, mude lá.

import { reaisParaCentavos } from "./dinheiro";

export type TipoItem = "peca" | "mao_de_obra";
export type EstadoOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado";

export const ROTULO_TIPO: Record<TipoItem, string> = {
  peca: "Peça",
  mao_de_obra: "Mão de obra",
};

export const ROTULO_ESTADO: Record<EstadoOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export const DESCRICAO_MAX = 200;
export const QUANTIDADE_MAX = 999;
// R$ 100.000,00 por unidade: teto contra número digitado errado.
export const VALOR_MAX_CENTAVOS = 10_000_000;

export type CampoItem = "tipo" | "descricao" | "quantidade" | "valor";

// O que foi digitado, para mostrar de novo no formulário.
export type ValoresItem = Record<CampoItem, string>;

// Pronto para a tabela orcamento_itens (mesmos nomes das colunas).
export type DadosItem = {
  tipo: TipoItem;
  descricao: string;
  quantidade: number;
  valor_unitario_centavos: number;
};

export type ErrosItem = Partial<Record<CampoItem, string>>;

export function ehTipoItem(valor: unknown): valor is TipoItem {
  return valor === "peca" || valor === "mao_de_obra";
}

// Array.from conta caracteres (um emoji = 1), igual ao char_length do banco.
const tamanho = (s: string) => Array.from(s).length;

// Lê e valida o formulário do item. Junta todos os erros de uma vez, cada um
// no seu campo. "dados" só vem quando não há erro.
export function validarItem(formData: FormData): {
  valores: ValoresItem;
  dados?: DadosItem;
  erros: ErrosItem;
} {
  const texto = (campo: CampoItem) => String(formData.get(campo) ?? "").trim();
  const valores: ValoresItem = {
    tipo: texto("tipo"),
    descricao: texto("descricao"),
    quantidade: texto("quantidade"),
    valor: texto("valor"),
  };
  const quantidade = /^[0-9]{1,3}$/.test(valores.quantidade) ? Number(valores.quantidade) : NaN;
  const centavos = reaisParaCentavos(valores.valor);

  const erros: ErrosItem = {};
  if (!ehTipoItem(valores.tipo)) erros.tipo = "Escolha peça ou mão de obra.";

  if (!valores.descricao) erros.descricao = "Informe a descrição.";
  else if (tamanho(valores.descricao) > DESCRICAO_MAX)
    erros.descricao = `A descrição pode ter no máximo ${DESCRICAO_MAX} caracteres.`;

  if (!(quantidade >= 1 && quantidade <= QUANTIDADE_MAX))
    erros.quantidade = `Quantidade inválida: use um número inteiro de 1 a ${QUANTIDADE_MAX}.`;

  if (!valores.valor) erros.valor = "Informe o valor.";
  else if (centavos === null) erros.valor = "Valor inválido: use só números, como 89,90.";
  else if (centavos > VALOR_MAX_CENTAVOS) erros.valor = "Valor alto demais: o máximo é R$ 100.000,00.";

  if (Object.keys(erros).length > 0 || !ehTipoItem(valores.tipo) || centavos === null) {
    return { valores, erros };
  }
  return {
    valores,
    erros,
    dados: {
      tipo: valores.tipo,
      descricao: valores.descricao,
      quantidade,
      valor_unitario_centavos: centavos,
    },
  };
}

export function subtotal(item: Pick<DadosItem, "quantidade" | "valor_unitario_centavos">): number {
  return item.quantidade * item.valor_unitario_centavos;
}

// Já saiu um link para o cliente (enviado ou respondido): mexer nos itens
// anula esse link (trigger orcamento_volta_para_rascunho).
export function foiEnviado(estado: EstadoOrcamento): boolean {
  return estado !== "rascunho";
}

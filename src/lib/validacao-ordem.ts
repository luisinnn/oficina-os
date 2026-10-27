// Regras de validação da nova OS. Arquivo "puro" (sem banco nem Next.js),
// testado em validacao-ordem.test.ts.

import { ERRO_PLACA, normalizarPlaca, normalizarTelefone, validarPlaca, validarTelefone } from "./formatos";

// Os mesmos limites estão nos CHECKs das tabelas clientes, veiculos e ordens
// (supabase/migrations/*_clientes_veiculos_ordens.sql): se mudar aqui, mude lá.
export const MODELO_MAX = 60;
export const NOME_CLIENTE_MAX = 100;
export const PROBLEMA_MAX = 1000;
export const OBS_MAX = 1000;
// Teto contra número absurdo (CHECK ordens_km_max, migração *_criar_ordem.sql).
export const KM_MAX = 9_999_999;

export type CampoOrdem = "placa" | "modelo" | "nome" | "telefone" | "problema" | "km" | "obs";

// O que foi digitado, para mostrar de novo no formulário.
export type ValoresOrdem = Record<CampoOrdem, string>;

// Pronto para a função criar_ordem do banco (mesmos nomes dos parâmetros).
export type DadosOrdem = {
  placa: string;
  modelo: string;
  nome: string;
  telefone: string;
  problema: string;
  km: number | null;
  obs_interna: string | null;
  // Resposta do "Trocar dono?": null = ainda não perguntado.
  trocar_dono: boolean | null;
};

export type ErrosOrdem = Partial<Record<CampoOrdem, string>>;

// Array.from conta caracteres (um emoji = 1), igual ao char_length do banco.
const tamanho = (s: string) => Array.from(s).length;

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

// Lê e valida o formulário. Junta todos os erros de uma vez, cada um no seu
// campo. "dados" só vem quando não há erro.
export function validarNovaOrdem(formData: FormData): {
  valores: ValoresOrdem;
  dados?: DadosOrdem;
  erros: ErrosOrdem;
} {
  const valores: ValoresOrdem = {
    placa: texto(formData, "placa"),
    modelo: texto(formData, "modelo"),
    nome: texto(formData, "nome"),
    telefone: texto(formData, "telefone"),
    problema: texto(formData, "problema"),
    km: texto(formData, "km"),
    obs: texto(formData, "obs"),
  };
  const placa = normalizarPlaca(valores.placa);
  const telefone = normalizarTelefone(valores.telefone);
  // "120.000" e "120 000" são jeitos comuns de escrever km.
  const kmDigitos = valores.km.replace(/[\s.]/g, "");
  const km = /^[0-9]+$/.test(kmDigitos) ? Number(kmDigitos) : NaN;

  const erros: ErrosOrdem = {};
  if (!validarPlaca(placa)) erros.placa = ERRO_PLACA;

  if (!valores.modelo) erros.modelo = "Informe o modelo.";
  else if (tamanho(valores.modelo) > MODELO_MAX)
    erros.modelo = `O modelo pode ter no máximo ${MODELO_MAX} caracteres.`;

  if (!valores.nome) erros.nome = "Informe o nome do cliente.";
  else if (tamanho(valores.nome) > NOME_CLIENTE_MAX)
    erros.nome = `O nome pode ter no máximo ${NOME_CLIENTE_MAX} caracteres.`;

  if (!validarTelefone(telefone)) erros.telefone = "Telefone inválido: use DDD + número (10 ou 11 dígitos).";

  if (!valores.problema) erros.problema = "Descreva o problema.";
  else if (tamanho(valores.problema) > PROBLEMA_MAX)
    erros.problema = `O problema pode ter no máximo ${PROBLEMA_MAX} caracteres.`;

  if (valores.km && !(km <= KM_MAX)) erros.km = "Km inválido: use só números.";

  if (tamanho(valores.obs) > OBS_MAX) erros.obs = `A observação pode ter no máximo ${OBS_MAX} caracteres.`;

  if (Object.keys(erros).length > 0) return { valores, erros };

  // A resposta ao "Trocar dono?" só vale para os dados que foram perguntados:
  // se a pessoa mudou placa, nome ou telefone depois, pergunta de novo.
  const perguntado = formData.get("pergunta_troca") === chaveTroca({ placa, nome: valores.nome, telefone });
  const trocar = perguntado ? formData.get("trocar_dono") : null;
  return {
    valores,
    erros,
    dados: {
      placa,
      modelo: valores.modelo,
      nome: valores.nome,
      telefone,
      problema: valores.problema,
      km: valores.km ? km : null,
      obs_interna: valores.obs || null,
      trocar_dono: trocar === "sim" ? true : trocar === "nao" ? false : null,
    },
  };
}

// Identifica a pergunta "Trocar dono?" (vai num campo escondido do formulário).
export function chaveTroca(d: Pick<DadosOrdem, "placa" | "nome" | "telefone">): string {
  return JSON.stringify([d.placa, d.nome, d.telefone]);
}

// Resposta da Server Action da nova OS para o formulário.
export type EstadoNovaOrdem = {
  valores?: ValoresOrdem;
  erros?: ErrosOrdem;
  // Erro que não é de um campo só (ex.: falha no banco).
  erro?: string;
  // O carro já está numa OS aberta: link para ela.
  ordemAberta?: { id: string; numero: number };
  // Placa de outro cliente: perguntar "Trocar dono?".
  confirmarTroca?: { donoAtual: string; donoNovo: string; chave: string };
};

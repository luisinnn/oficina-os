// Pré-cadastro público (/p/<codigo>). Arquivo "puro" (sem banco nem
// Next.js), testado em pre-cadastro.test.ts.
//
// A função enviar_pre_cadastro do banco limpa e confere tudo de novo
// (supabase/migrations/*_pre_cadastro.sql): se mudar aqui, mude lá.

import { ERRO_PLACA, normalizarPlaca, normalizarTelefone, validarPlaca, validarTelefone } from "./formatos";
import { MODELO_MAX, NOME_CLIENTE_MAX, PROBLEMA_MAX } from "./validacao-ordem";

export type CampoPre = "nome" | "telefone" | "placa" | "modelo" | "problema";

// O que foi digitado, para mostrar de novo no formulário.
export type ValoresPre = Record<CampoPre, string>;

// Pronto para enviar_pre_cadastro (mesmos nomes dos parâmetros).
export type DadosPre = ValoresPre;

export type ErrosPre = Partial<Record<CampoPre, string>>;

// Array.from conta caracteres (um emoji = 1), igual ao char_length do banco.
const tamanho = (s: string) => Array.from(s).length;

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function obrigatorio(valor: string, max: number, vazio: string, nome: string): string | undefined {
  if (!valor) return vazio;
  if (tamanho(valor) > max) return `${nome} pode ter no máximo ${max} caracteres.`;
}

// Lê e valida o formulário. "dados" só vem quando não há erro.
export function validarPreCadastro(formData: FormData): { valores: ValoresPre; dados?: DadosPre; erros: ErrosPre } {
  const valores: ValoresPre = {
    nome: texto(formData, "nome"),
    telefone: texto(formData, "telefone"),
    placa: texto(formData, "placa"),
    modelo: texto(formData, "modelo"),
    problema: texto(formData, "problema"),
  };
  const placa = normalizarPlaca(valores.placa);
  const telefone = normalizarTelefone(valores.telefone);

  const erros: ErrosPre = {
    nome: obrigatorio(valores.nome, NOME_CLIENTE_MAX, "Informe seu nome.", "O nome"),
    telefone: validarTelefone(telefone) ? undefined : "Telefone inválido: use DDD + número.",
    placa: validarPlaca(placa) ? undefined : ERRO_PLACA,
    modelo: obrigatorio(valores.modelo, MODELO_MAX, "Informe o modelo do carro.", "O modelo"),
    problema: obrigatorio(valores.problema, PROBLEMA_MAX, "Conte o que o carro tem.", "O texto"),
  };
  for (const campo of Object.keys(erros) as CampoPre[]) if (!erros[campo]) delete erros[campo];

  if (Object.keys(erros).length > 0) return { valores, erros };
  return { valores, erros, dados: { ...valores, placa, telefone } };
}

// Campo isca "site": fica fora da tela, então gente não preenche. Robô que
// preenche tudo cai aqui e recebe "ok" sem gravar nada.
export function ehRobo(formData: FormData): boolean {
  return String(formData.get("site") ?? "") !== "";
}

// codigo_publico (ticket 02): base64url, 12 caracteres hoje. Fora do formato
// nem vale perguntar ao banco.
export function codigoComFormato(codigo: string): boolean {
  return /^[A-Za-z0-9_-]{10,64}$/.test(codigo);
}

export function linkPreCadastro(site: string, codigo: string): string {
  return `${site}/p/${codigo}`;
}

// Resposta da Server Action da página pública para o formulário.
export type EstadoPreCadastro = {
  valores?: ValoresPre;
  erros?: ErrosPre;
  erro?: string;
  enviado?: boolean;
};

export const LINK_INVALIDO = "Link inválido. Peça o link certo à oficina.";

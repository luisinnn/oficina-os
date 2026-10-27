// Regras de validação da oficina (onboarding e configurações). Arquivo "puro":
// não acessa banco, cookies nem nada do Next.js, então dá para testar sozinho
// (validacao-oficina.test.ts).

import { normalizarTelefone, validarTelefone } from "./formatos";

// Os mesmos limites estão nos CHECKs da tabela oficinas
// (supabase/migrations/*_oficinas_e_membros.sql): se mudar aqui, mude lá.
export const NOME_OFICINA_MAX = 100;

export type ValoresOficina = { nome: string; telefone: string };

// Resposta das Server Actions (onboarding e configurações) para o formulário.
export type EstadoOficina = { erro?: string; mensagem?: string; valores?: ValoresOficina };

// Lê e valida os campos do formulário. Nunca confie só na validação do
// navegador: qualquer um pode mandar uma requisição sem passar pela tela.
// Retorna: valores (o que foi digitado, para mostrar de novo no formulário),
// dados (pronto para o banco) e erro (mensagem, ou undefined se estiver OK).
export function validarOficina(formData: FormData): {
  valores: ValoresOficina;
  dados: ValoresOficina;
  erro?: string;
} {
  const valores: ValoresOficina = {
    nome: String(formData.get("nome") ?? "").trim(),
    telefone: String(formData.get("telefone") ?? "").trim(),
  };
  const telefone = normalizarTelefone(valores.telefone);
  const dados: ValoresOficina = { nome: valores.nome, telefone };

  let erro: string | undefined;
  // Array.from conta caracteres (um emoji = 1), igual ao char_length do banco.
  if (!valores.nome) erro = "Informe o nome da oficina.";
  else if (Array.from(valores.nome).length > NOME_OFICINA_MAX)
    erro = `O nome pode ter no máximo ${NOME_OFICINA_MAX} caracteres.`;
  else if (!validarTelefone(telefone)) erro = "WhatsApp inválido: use DDD + número (10 ou 11 dígitos).";

  return { valores, dados, erro };
}

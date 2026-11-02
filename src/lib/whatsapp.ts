// Envio do orçamento pelo WhatsApp (link wa.me, sem API oficial). Arquivo
// "puro" (sem banco nem Next.js), testado em whatsapp.test.ts.

import { centavosParaCampo } from "./dinheiro";
import { validarTelefone } from "./formatos";

export type DadosMensagem = {
  nomeCliente: string;
  modelo: string;
  placa: string;
  oficina: string;
  numero: number;
  totalCentavos: number;
  link: string;
};

// Texto fixo (texto editável ficou fora da v1).
export function mensagemOrcamento(dados: DadosMensagem): string {
  const primeiroNome = dados.nomeCliente.trim().split(/\s+/)[0];
  return (
    `Olá, ${primeiroNome}! Segue o orçamento do ${dados.modelo} (${dados.placa}) na ${dados.oficina}, ` +
    `OS #${dados.numero}: total R$ ${centavosParaCampo(dados.totalCentavos)}. Para aprovar ou recusar: ${dados.link}`
  );
}

// Telefone como no banco (só dígitos, DDD + número). O 55 do Brasil entra
// aqui. encodeURIComponent codifica acento, &, #, + e quebra de linha.
export function linkWhatsApp(telefone: string, texto: string): string {
  if (!validarTelefone(telefone)) throw new Error("Telefone fora do formato: só dígitos, DDD + número.");
  return `https://wa.me/55${telefone}?text=${encodeURIComponent(texto)}`;
}

// Página pública de aprovação (ticket 08). site = urlDoSite(), sem "/" no final.
export function linkAprovacao(site: string, token: string): string {
  return `${site}/aprovar/${token}`;
}

"use server";

import { codigoComFormato, ehRobo, type EstadoPreCadastro, LINK_INVALIDO, validarPreCadastro } from "@/lib/pre-cadastro";
import { createClientPublico } from "@/lib/supabase/publico";

// Envia o pré-cadastro pela função enviar_pre_cadastro (só aceita anônimo).
// Os dados do cliente não vão para log.
export async function enviarPreCadastro(
  _estadoAnterior: EstadoPreCadastro,
  formData: FormData,
): Promise<EstadoPreCadastro> {
  // Campo isca preenchido: robô. Responde como se tivesse dado certo.
  if (ehRobo(formData)) return { enviado: true };

  const codigo = String(formData.get("codigo") ?? "");
  if (!codigoComFormato(codigo)) return { erro: LINK_INVALIDO };

  const { valores, dados, erros } = validarPreCadastro(formData);
  if (!dados) return { valores, erros };

  const { error } = await createClientPublico().rpc("enviar_pre_cadastro", { codigo, ...dados });
  if (!error) return { enviado: true };

  switch (error.code) {
    case "P0002":
      return { valores, erro: LINK_INVALIDO };
    case "PC001":
      return { valores, erro: "Muitos pedidos agora. Tente de novo mais tarde ou chame a oficina no WhatsApp." };
    case "PC002":
      return { erro: "Já recebemos um pré-cadastro deste carro. A oficina vai falar com você pelo WhatsApp." };
    case "22023":
      return { valores, erro: "Confira os dados e tente de novo." };
  }
  console.error("enviarPreCadastro:", error.code ?? "sem código");
  return { valores, erro: "Não foi possível enviar. Tente de novo." };
}

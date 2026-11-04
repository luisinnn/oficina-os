"use server";
// "use server" = estas funções rodam SÓ no servidor. O formulário no navegador
// chama a função, mas o código (e as chaves) nunca vão para o navegador.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Formato da resposta que volta para o formulário mostrar na tela.
// email: o que foi digitado, para o campo voltar preenchido depois de um erro
// (o React limpa o formulário a cada envio).
export type EstadoAuth = { erro?: string; email?: string };

function lerCampos(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    senha: String(formData.get("senha") ?? ""),
  };
}

export async function entrar(
  _estadoAnterior: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const { email, senha } = lerCampos(formData);
  if (!email || !senha) return { erro: "Preencha e-mail e senha.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    // Mensagem genérica de propósito: não revela se o e-mail existe.
    return { erro: "E-mail ou senha incorretos. Confira e tente de novo.", email };
  }

  // Login OK: o Supabase já gravou o cookie de sessão. Vai para o painel.
  redirect("/painel");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

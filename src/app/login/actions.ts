"use server";
// "use server" = estas funções rodam SÓ no servidor. O formulário no navegador
// chama a função, mas o código (e as chaves) nunca vão para o navegador.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Formato da resposta que volta para o formulário mostrar na tela.
export type EstadoAuth = { erro?: string; mensagem?: string };

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
  if (!email || !senha) return { erro: "Preencha e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    // Mensagem genérica de propósito: não revela se o e-mail existe.
    return { erro: "E-mail ou senha inválidos (ou e-mail ainda não confirmado)." };
  }

  // Login OK: o Supabase já gravou o cookie de sessão. Vai para a lista.
  redirect("/clientes");
}

// Mesmo valor do minLength em form-login.tsx e da senha mínima no painel do
// Supabase (Authentication > Sign In / Providers > Email).
const SENHA_MIN = 8;

// Endereço oficial do site, usado no link de confirmação do e-mail.
// Vem de variável de ambiente, e não do cabeçalho "origin" da requisição,
// porque esse cabeçalho pode ser forjado por quem chama.
function urlDoSite(): string | null {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurada) return configurada.replace(/\/+$/, ""); // tira "/" do final

  // Na Vercel: domínio de produção do projeto, preenchido pela própria Vercel.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  // Rodando local (npm run dev) sem a variável.
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";

  return null;
}

export async function cadastrar(
  _estadoAnterior: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const { email, senha } = lerCampos(formData);
  if (!email || !senha) return { erro: "Preencha e-mail e senha." };
  if (senha.length < SENHA_MIN)
    return { erro: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` };

  const site = urlDoSite();
  if (!site) {
    console.error("cadastrar: defina NEXT_PUBLIC_SITE_URL nas variáveis de ambiente.");
    return { erro: "Cadastro indisponível no momento. Tente mais tarde." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: `${site}/auth/callback` },
  });

  if (error) {
    // Senha fraca ou vazada (proteção do painel do Supabase): pode avisar,
    // porque isso fala da senha digitada, não de quem já tem conta.
    if (error.code === "weak_password") {
      return { erro: "Senha fraca ou já vazada em outros sites. Escolha outra." };
    }
    // Limite de tentativas/e-mails do Supabase: também pode avisar, porque
    // vale para qualquer e-mail (não revela quem tem conta).
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return { erro: "Muitas tentativas agora. Tente de novo mais tarde." };
    }
    // Qualquer outro erro: mensagem genérica de propósito. O texto original
    // pode dizer "usuário já cadastrado" e revelar quais e-mails existem.
    console.error("cadastrar:", error.code ?? error.message);
    return { erro: "Não foi possível criar a conta. Confira os dados e tente de novo." };
  }

  // Se a confirmação de e-mail estiver DESLIGADA no Supabase, já vem sessão.
  if (data.session) redirect("/clientes");

  // Se estiver LIGADA (padrão), o usuário precisa clicar no link do e-mail.
  return {
    mensagem: "Conta criada! Confira seu e-mail e clique no link para ativar.",
  };
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

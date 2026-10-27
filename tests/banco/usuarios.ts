import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Ajudantes dos testes de banco. Usam só a chave publishable, como o app
// (e um atacante) usaria. Nunca a secret.
const url = process.env.SUPABASE_URL!;
const chave = process.env.SUPABASE_PUBLISHABLE_KEY!;
const mailpit = process.env.MAILPIT_URL!;

const SENHA = "senha-de-teste-123";

export function clienteAnonimo(): SupabaseClient {
  return createClient(url, chave, { auth: { persistSession: false } });
}

export type UsuarioTeste = { id: string; email: string; supabase: SupabaseClient };

// Cria uma conta nova, confirma pelo link do e-mail (lido no Mailpit) e faz
// login com senha. Devolve um cliente Supabase autenticado como esse usuário.
export async function criarUsuarioConfirmado(apelido: string): Promise<UsuarioTeste> {
  const email = `${apelido}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.local`;

  const cadastro = await clienteAnonimo().auth.signUp({ email, password: SENHA });
  if (cadastro.error) throw new Error(`signUp falhou: ${cadastro.error.code}`);

  // "Clicar" no link: o GET no /auth/v1/verify confirma o e-mail no Supabase.
  // Não seguimos o redirecionamento (ele vai para o app, que não está rodando).
  const link = await linkDeConfirmacao(email);
  await fetch(link, { redirect: "manual" });

  const supabase = clienteAnonimo();
  const login = await supabase.auth.signInWithPassword({ email, password: SENHA });
  if (login.error) throw new Error(`login falhou: ${login.error.code}`);

  return { id: login.data.user.id, email, supabase };
}

// O e-mail pode levar um instante para chegar no Mailpit: tenta por até ~5 s.
async function linkDeConfirmacao(email: string): Promise<string> {
  const busca = `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`;
  for (let tentativa = 0; tentativa < 25; tentativa++) {
    const { messages } = (await (await fetch(busca)).json()) as { messages?: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`)).json()) as {
        HTML: string;
      };
      const href = msg.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1];
      if (!href) throw new Error("E-mail de confirmação sem link.");
      return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`E-mail de confirmação não chegou no Mailpit para ${email}.`);
}

export type UsuarioComOficina = UsuarioTeste & { oficina: string };

// Usuário confirmado que já passou pelo onboarding (tem oficina).
export async function criarUsuarioComOficina(apelido: string): Promise<UsuarioComOficina> {
  const u = await criarUsuarioConfirmado(apelido);
  const { data, error } = await u.supabase.rpc("criar_oficina", {
    nome: `Oficina ${apelido}`,
    telefone: "47999990000",
  });
  if (error) throw new Error(`criar_oficina falhou: ${error.message}`);
  return { ...u, oficina: data as string };
}

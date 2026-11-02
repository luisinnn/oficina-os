import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// O proxy roda ANTES de cada página (pense num reverse proxy na frente do app).
// Duas tarefas:
// 1) Renovar o token de login do Supabase quando ele está perto de expirar,
//    gravando o cookie novo na resposta.
// 2) Barrar quem não está logado nas rotas privadas (/painel/... e /onboarding).
// Não roda na página pública /aprovar/<token> (veja o matcher no fim).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Atualiza os cookies na requisição (para a página enxergar o token
          // novo) e na resposta (para o navegador guardar o token novo).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cabeçalhos anti-cache: impedem que um CDN entregue a sessão de um
          // usuário para outro.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims() valida o token (assinatura e validade). Não confie em
  // getSession() no servidor: ele só lê o cookie, sem validar.
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // Não logado tentando abrir área privada -> vai para o login.
  if (!logado && (pathname.startsWith("/painel") || pathname.startsWith("/onboarding"))) {
    return redirecionar(request, "/login", response);
  }

  // Já logado abrindo a tela de login -> vai direto para o painel.
  if (logado && pathname === "/login") {
    return redirecionar(request, "/painel", response);
  }

  return response;
}

// Redireciona preservando os cookies que o Supabase acabou de renovar.
function redirecionar(request: NextRequest, path: string, from: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Roda em tudo, menos arquivos estáticos (JS/CSS/imagens), que não precisam
  // de sessão, e a página pública de aprovação (/aprovar/<token>), que não
  // usa login: o cliente abre sem conta.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|aprovar/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

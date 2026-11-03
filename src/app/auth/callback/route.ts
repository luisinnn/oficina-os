import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { urlDoSite } from "@/lib/site";

// GET /auth/callback?code=...
// O link do e-mail de confirmação traz um "code" de uso único. Trocamos esse
// code por uma sessão (cookies de login) e mandamos o usuário para o painel.
export async function GET(request: NextRequest) {
  // Endereço oficial do site, e não o origin da requisição: atrás do Caddy,
  // no Docker, ele vira "https://0.0.0.0:3000".
  const site = urlDoSite() ?? request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${site}/painel`);
    }
  }

  // Código ausente, expirado ou já usado.
  return NextResponse.redirect(`${site}/login`);
}

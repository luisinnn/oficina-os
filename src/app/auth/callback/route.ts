import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /auth/callback?code=...
// O link do e-mail de confirmação traz um "code" de uso único. Trocamos esse
// code por uma sessão (cookies de login) e mandamos o usuário para o painel.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/painel`);
    }
  }

  // Código ausente, expirado ou já usado.
  return NextResponse.redirect(`${origin}/login`);
}

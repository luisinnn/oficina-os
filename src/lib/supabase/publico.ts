import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente Supabase anônimo, sem cookies nem sessão, para as páginas públicas
// (aprovação do orçamento). As funções públicas do banco são liberadas só
// para "anon": se o dono da oficina abrir o link no mesmo navegador em que
// está logado, a chamada continua anônima.
export function createClientPublico() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

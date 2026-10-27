import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cria um cliente Supabase para usar no servidor (páginas, Server Actions,
// Route Handlers). Precisa ser criado de novo a cada requisição, porque cada
// requisição tem os cookies (a sessão) de um usuário diferente.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Supabase lê a sessão a partir dos cookies da requisição...
        getAll() {
          return cookieStore.getAll();
        },
        // ...e grava cookies novos quando faz login/logout ou renova o token.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Páginas (Server Components) não podem gravar cookies; só Server
            // Actions e Route Handlers podem. Nesse caso ignoramos, porque o
            // proxy (src/proxy.ts) já renova a sessão antes de cada página.
          }
        },
      },
    },
  );
}

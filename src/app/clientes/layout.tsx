import Link from "next/link";
import { Suspense } from "react";
import { getUsuario } from "@/lib/auth";
import { sair } from "@/app/login/actions";

// Layout = moldura que envolve todas as páginas dentro de /clientes.
// "children" é a página atual (lista, novo, editar).
export default function ClientesLayout({ children }: LayoutProps<"/clientes">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/clientes" className="font-semibold text-zinc-900">
            Cadastro de Clientes
          </Link>
          {/* Ler a sessão depende da requisição, então fica atrás de um
              Suspense: o cabeçalho aparece na hora e o e-mail chega depois. */}
          <Suspense fallback={<span className="text-sm text-zinc-400">...</span>}>
            <MenuUsuario />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

async function MenuUsuario() {
  const usuario = await getUsuario();
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-zinc-600">{usuario.email}</span>
      {/* Formulário que chama a Server Action "sair" (logout). */}
      <form action={sair}>
        <button type="submit" className="font-medium text-blue-600 hover:underline">
          Sair
        </button>
      </form>
    </div>
  );
}

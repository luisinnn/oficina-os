import Link from "next/link";
import { Suspense } from "react";
import { sair } from "@/app/login/actions";
import { getOficina } from "@/lib/oficina";

// Layout = moldura que envolve todas as páginas dentro de /painel.
// "children" é a página atual.
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          {/* Ler a oficina depende do usuário logado, então fica atrás de um
              Suspense: o cabeçalho aparece na hora e o nome chega depois. */}
          <Suspense fallback={<NomeOficina nome="oficina-os" />}>
            <OficinaAtual />
          </Suspense>
          <nav className="flex shrink-0 items-center gap-4 text-sm">
            <Link href="/painel/configuracoes" className="flex min-h-12 items-center font-medium text-zinc-600 hover:underline">
              Configurações
            </Link>
            {/* Formulário que chama a Server Action "sair" (logout). */}
            <form action={sair}>
              <button type="submit" className="min-h-12 font-medium text-blue-600 hover:underline">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* Nenhuma tela do painel aparece para quem ainda não tem oficina. */}
        <Suspense>
          <ExigeOficina>{children}</ExigeOficina>
        </Suspense>
      </main>
    </div>
  );
}

function NomeOficina({ nome }: { nome: string }) {
  return (
    <Link href="/painel" className="flex min-h-12 min-w-0 items-center font-semibold text-zinc-900">
      <span className="truncate">
        {nome}
      </span>
    </Link>
  );
}

async function OficinaAtual() {
  const oficina = await getOficina();
  return <NomeOficina nome={oficina.nome} />;
}

// Sem oficina, getOficina() manda para /onboarding antes de mostrar a página.
async function ExigeOficina({ children }: { children: React.ReactNode }) {
  await getOficina();
  return children;
}

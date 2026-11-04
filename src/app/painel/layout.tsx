import Link from "next/link";
import { Suspense } from "react";
import { sair } from "@/app/login/actions";
import { getOficina } from "@/lib/oficina";

// Layout = moldura que envolve todas as páginas dentro de /painel.
// "children" é a página atual.
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="painel flex flex-1 flex-col bg-concreto text-grafite">
      <header className="bg-grafite text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
          {/* Ler a oficina depende do usuário logado, então fica atrás de um
              Suspense: o cabeçalho aparece na hora e o nome chega depois. */}
          <Suspense fallback={<NomeOficina nome="Pátio" />}>
            <OficinaAtual />
          </Suspense>
          <nav className="flex shrink-0 items-center gap-3 sm:gap-4">
            <Link href="/painel/historico" className="flex min-h-12 items-center font-semibold hover:underline">
              Histórico
            </Link>
            <Link href="/painel/configuracoes" className="flex min-h-12 items-center font-semibold hover:underline">
              Configurações
            </Link>
            {/* Formulário que chama a Server Action "sair" (logout). */}
            <form action={sair}>
              <button type="submit" className="min-h-12 font-semibold hover:underline">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
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
    <Link href="/painel" className="flex min-h-12 min-w-0 items-center font-condensada text-titulo font-bold">
      <span className="truncate">{nome}</span>
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

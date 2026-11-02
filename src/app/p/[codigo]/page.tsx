import type { Metadata } from "next";
import { Suspense } from "react";
import { codigoComFormato, LINK_INVALIDO } from "@/lib/pre-cadastro";
import { createClientPublico } from "@/lib/supabase/publico";
import { FormPreCadastro } from "./form-pre-cadastro";

export const metadata: Metadata = {
  title: "Pré-cadastro",
  robots: { index: false, follow: false },
};

// Página pública (sem login): link fixo da oficina, divulgado no WhatsApp
// Business e no Google. O cliente se adianta e a oficina confirma no painel.
export default function PreCadastroPage({ params }: PageProps<"/p/[codigo]">) {
  return (
    <main className="flex flex-1 justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<p className="text-zinc-500">Carregando...</p>}>
          <Conteudo params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/p/[codigo]">, "params">) {
  const { codigo } = await params;
  const oficina = await nomeOficina(codigo);

  if (!oficina) {
    return (
      <section role="alert" className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-medium text-zinc-900">{LINK_INVALIDO}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900">Pré-cadastro — {oficina}</h1>
      <p className="text-zinc-700">Adiante seus dados e os do carro. A oficina confere e fala com você.</p>
      <FormPreCadastro codigo={codigo} oficina={oficina} />
    </section>
  );
}

// null = código que não existe (ou trocado por "Gerar novo link").
async function nomeOficina(codigo: string): Promise<string | null> {
  if (!codigoComFormato(codigo)) return null;
  const { data, error } = await createClientPublico().rpc("nome_oficina_publico", { codigo });
  if (error) throw new Error(`Erro ao ler a oficina: ${error.code ?? "sem código"}`);
  return data as string | null;
}

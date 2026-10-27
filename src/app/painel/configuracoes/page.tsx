import type { Metadata } from "next";
import { Suspense } from "react";
import { FormOficina } from "@/components/form-oficina";
import { getOficina } from "@/lib/oficina";
import { salvarOficina } from "./actions";

export const metadata: Metadata = { title: "Configurações | oficina-os" };

// Dados da oficina. (O link de pré-cadastro entra aqui no ticket 09.)
export default function ConfiguracoesPage() {
  return (
    <section className="mx-auto max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Configurações</h1>
      <Suspense fallback={<p className="text-sm text-zinc-400">...</p>}>
        <FormDadosOficina />
      </Suspense>
    </section>
  );
}

async function FormDadosOficina() {
  const { nome, telefone } = await getOficina();
  return <FormOficina acao={salvarOficina} inicial={{ nome, telefone }} botao="Salvar" />;
}

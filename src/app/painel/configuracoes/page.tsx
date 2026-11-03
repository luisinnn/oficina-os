import type { Metadata } from "next";
import { Suspense } from "react";
import { FormOficina } from "@/components/form-oficina";
import { getOficina } from "@/lib/oficina";
import { linkPreCadastro } from "@/lib/pre-cadastro";
import { urlDoSite } from "@/lib/site";
import { salvarOficina } from "./actions";
import { LinkPreCadastro } from "./link-pre-cadastro";

export const metadata: Metadata = { title: "Configurações | oficina-os" };

// Dados da oficina e link de pré-cadastro.
export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Configurações</h1>
        <Suspense fallback={<p className="text-sm text-zinc-600">...</p>}>
          <FormDadosOficina />
        </Suspense>
      </section>
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-zinc-900">Link de pré-cadastro</h2>
        <p className="mb-4 text-sm text-zinc-600">
          Coloque no WhatsApp Business e no Google. O cliente preenche os dados e o carro aparece no painel para
          você confirmar.
        </p>
        <Suspense fallback={<p className="text-sm text-zinc-600">...</p>}>
          <SecaoLink />
        </Suspense>
      </section>
    </div>
  );
}

async function FormDadosOficina() {
  const { nome, telefone } = await getOficina();
  return <FormOficina acao={salvarOficina} inicial={{ nome, telefone }} botao="Salvar" />;
}

async function SecaoLink() {
  const { codigo_publico } = await getOficina();
  const site = urlDoSite();
  if (!site) return <p className="text-sm text-red-700">Endereço do site não configurado (NEXT_PUBLIC_SITE_URL).</p>;
  return <LinkPreCadastro link={linkPreCadastro(site, codigo_publico)} />;
}

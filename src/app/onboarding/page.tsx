import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormOficina } from "@/components/form-oficina";
import { buscarOficina } from "@/lib/oficina";
import { criarOficina } from "./actions";

export const metadata: Metadata = { title: "Sua oficina | oficina-os" };

// Primeira tela depois do cadastro: o usuário informa a oficina dele.
// Quem já tem oficina vai direto para o painel.
export default function OnboardingPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Sua oficina</h1>
        <p className="mb-6 text-sm text-zinc-500">
          O nome aparece para os clientes no orçamento e no link de pré-cadastro.
        </p>
        {/* Checar a oficina depende do usuário logado: fica atrás de um Suspense. */}
        <Suspense fallback={<p className="text-sm text-zinc-400">...</p>}>
          <FormSeNaoTemOficina />
        </Suspense>
      </div>
    </main>
  );
}

async function FormSeNaoTemOficina() {
  if (await buscarOficina()) redirect("/painel");
  return <FormOficina acao={criarOficina} inicial={{ nome: "", telefone: "" }} botao="Começar" />;
}

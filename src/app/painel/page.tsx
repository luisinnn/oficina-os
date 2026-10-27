import type { Metadata } from "next";

export const metadata: Metadata = { title: "Painel | oficina-os" };

// Página provisória: a tela inicial de verdade (busca, nova OS, pré-cadastros)
// chega no ticket 04.
export default function PainelPage() {
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">Em construção</h1>
      <p className="mt-2 text-sm text-zinc-500">O painel da oficina vai aparecer aqui.</p>
    </section>
  );
}

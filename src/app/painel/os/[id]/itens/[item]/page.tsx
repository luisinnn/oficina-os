import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { centavosParaCampo } from "@/lib/dinheiro";
import { foiEnviado } from "@/lib/orcamento";
import { buscarItem } from "@/lib/ordens";
import { FormItem, RemoverItem } from "../form-item";

export const metadata: Metadata = { title: "Editar item | Pátio" };

export default function EditarItemPage({ params }: PageProps<"/painel/os/[id]/itens/[item]">) {
  return (
    <section className="mx-auto max-w-md space-y-4">
      <Suspense fallback={<p className="text-sm text-zinc-600">Carregando...</p>}>
        <EditarItem params={params} />
      </Suspense>
    </section>
  );
}

async function EditarItem({ params }: Pick<PageProps<"/painel/os/[id]/itens/[item]">, "params">) {
  const { id, item: itemId } = await params;
  const encontrado = await buscarItem(id, itemId);
  if (!encontrado) notFound();
  const { item, estado, numero } = encontrado;
  const enviado = foiEnviado(estado);

  return (
    <>
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">Editar item · OS #{numero}</h1>
        <FormItem
          alvo={{ itemId: item.id }}
          inicial={{
            tipo: item.tipo,
            descricao: item.descricao,
            quantidade: String(item.quantidade),
            valor: centavosParaCampo(item.valor_unitario_centavos),
          }}
          enviado={enviado}
        />
        <RemoverItem itemId={item.id} enviado={enviado} />
      </div>
      <Link href={`/painel/os/${id}`} className="flex min-h-12 items-center font-medium text-placa hover:underline">
        ← Voltar para a OS
      </Link>
    </>
  );
}

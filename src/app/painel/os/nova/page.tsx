import type { Metadata } from "next";
import { formatarTelefone, normalizarPlaca, validarPlaca } from "@/lib/formatos";
import { buscarCarro } from "@/lib/ordens";
import { FormNovaOs } from "./form-nova-os";

export const metadata: Metadata = { title: "Nova OS | oficina-os" };

// /painel/os/nova?placa=ABC1D23 vem da busca por placa: placa já preenchida
// e, se o carro já existe, modelo e dono atual também.
export default async function NovaOsPage({ searchParams }: PageProps<"/painel/os/nova">) {
  const { placa: param } = await searchParams;
  const placa = typeof param === "string" ? normalizarPlaca(param) : "";
  const carro = validarPlaca(placa) ? await buscarCarro(placa) : null;

  return (
    <section className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Nova OS</h1>
      <FormNovaOs
        inicial={{
          placa,
          modelo: carro?.modelo ?? "",
          nome: carro?.dono.nome ?? "",
          telefone: carro ? formatarTelefone(carro.dono.telefone) : "",
          problema: "",
          km: "",
          obs: "",
        }}
      />
    </section>
  );
}

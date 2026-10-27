import type { Metadata } from "next";
import { criarCliente } from "../actions";
import { FormCliente } from "../form-cliente";

export const metadata: Metadata = { title: "Novo cliente | Cadastro de Clientes" };

// Tela de criação: o formulário vazio ligado à ação criarCliente.
// O login é conferido dentro da ação (e pelo proxy antes de abrir a página).
export default function NovoClientePage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Novo cliente</h1>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <FormCliente acao={criarCliente} textoBotao="Salvar cliente" />
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar | Cadastro de Clientes" };

// Página estática: só centraliza o formulário. Quem já está logado é
// redirecionado para /clientes pelo proxy, antes de chegar aqui.
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-4">
      <FormLogin />
    </main>
  );
}

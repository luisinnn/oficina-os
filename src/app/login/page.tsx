import type { Metadata } from "next";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar | oficina-os" };

// Página estática. Quem já está logado é redirecionado para /painel pelo
// proxy, antes de chegar aqui. Não tem cadastro: as contas são criadas no
// painel do Supabase (README, seção Deploy).
export default function LoginPage() {
  return (
    <main className="painel flex flex-1 justify-center bg-concreto px-4 py-10 text-grafite sm:items-center">
      <div className="w-full max-w-sm">
        {/* A marca do sistema desenhada como a placa do painel. */}
        <p className="mb-8 inline-flex flex-col overflow-hidden rounded border-2 border-grafite bg-chapa">
          <span aria-hidden="true" className="h-2.5 bg-placa" />
          <span className="px-4 py-1 font-condensada text-destaque font-bold leading-none tracking-wide">
            OFICINA OS
          </span>
        </p>
        <FormLogin />
        <p className="mt-6 text-sm">Não tem acesso? Peça ao responsável pelo sistema para criar sua conta.</p>
      </div>
    </main>
  );
}

import "server-only";

// Endereço oficial do site, usado nos links que saem do sistema (confirmação
// do e-mail, aprovação do orçamento). Vem de variável de ambiente, e não do
// cabeçalho "origin" da requisição, porque esse cabeçalho pode ser forjado
// por quem chama. null = não configurado.
export function urlDoSite(): string | null {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurada) return configurada.replace(/\/+$/, ""); // tira "/" do final

  // Na Vercel: domínio de produção do projeto, preenchido pela própria Vercel.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  // Rodando local (npm run dev) sem a variável.
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";

  return null;
}

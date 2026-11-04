import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Ticket 12: a lista manual do ticket 10 (tests/seguranca/navegador.e2e.ts)
// rodada contra PRODUÇÃO. Usa duas contas de teste criadas à mão no painel do
// Supabase (Add user, Auto Confirm), sem oficina ainda. O teste cria as
// oficinas, clientes e OS nelas: depois, apague as contas e os dados.
//
//   CONTA_A=... CONTA_B=... SENHA_CONTAS=... npm run test:producao
//
// Limpeza, no SQL Editor do Supabase (a oficina leva junto tudo dela):
//   delete from public.oficinas where nome in ('Oficina segA', 'Oficina segB');
//   delete from auth.users where email in ('<conta A>', '<conta B>');
//
// URL e chave publishable vêm das Variables do GitHub (valores públicos).
const exigir = (nome: string) => {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Falta a variável ${nome} (ver vitest.producao.config.mts).`);
  return valor;
};

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/seguranca/navegador.e2e.ts"],
    environment: "node",
    env: {
      APP_URL: process.env.APP_URL ?? "https://superautomec.com.br",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "https://tdzzxgkqnudqstcmkjhl.supabase.co",
      SUPABASE_PUBLISHABLE_KEY:
        process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_tiEsfnwOXFe3l0xKAev9XQ_zdyvpYD8",
      // montarOficina("A") cria o usuário "segA".
      CONTA_segA: exigir("CONTA_A"),
      CONTA_segB: exigir("CONTA_B"),
      SENHA_CONTAS: exigir("SENHA_CONTAS"),
    },
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});

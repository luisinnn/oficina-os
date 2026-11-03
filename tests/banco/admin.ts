import { execFileSync } from "node:child_process";

// SQL como dono do banco, direto no Postgres local do Docker. Só para montar
// cenários que o app ainda não sabe criar (ex.: orçamento "aprovado" antes do
// ticket 08). Não passa pela API nem usa chave nenhuma, e só funciona no PC
// com o Supabase local: nunca use para testar se a API deixa ou não fazer
// algo. Exceção: ler o catálogo do Postgres (tests/seguranca/catalogo.test.ts).
// Container = "supabase_db_" + project_id de supabase/config.toml.
export const CONTAINER = "supabase_db_oficina-os";

// conexao: outro banco/usuário (URL vista de dentro do container). Padrão:
// banco postgres como usuário postgres.
export function sqlAdmin(sql: string, conexao?: string): string {
  // O SQL vai pela entrada padrão: no Windows, argumento com quebra de linha
  // chega cortado no docker.
  return execFileSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", ...(conexao ? [conexao] : ["-U", "postgres"]), "-tA", "-q", "-v", "ON_ERROR_STOP=1"],
    { encoding: "utf8", input: sql, stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

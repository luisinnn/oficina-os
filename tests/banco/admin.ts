import { execFileSync } from "node:child_process";

// SQL como dono do banco, direto no Postgres local do Docker. Só para montar
// cenários que o app ainda não sabe criar (ex.: orçamento "aprovado" antes do
// ticket 08). Não passa pela API nem usa chave nenhuma, e só funciona no PC
// com o Supabase local: nunca use para conferir permissão.
// Container = "supabase_db_" + project_id de supabase/config.toml.
const CONTAINER = "supabase_db_oficina-os";

export function sqlAdmin(sql: string): string {
  // O SQL vai pela entrada padrão: no Windows, argumento com quebra de linha
  // chega cortado no docker.
  return execFileSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-tA", "-q", "-v", "ON_ERROR_STOP=1"],
    { encoding: "utf8", input: sql, stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

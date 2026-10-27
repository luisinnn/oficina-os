import "server-only";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/validacao-cliente";

// Formato de um cliente, igual às colunas da tabela em supabase/schema.sql.
export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  user_id: string;
  created_at: string;
};

// Lista os clientes do usuário logado, em ordem alfabética.
// Não precisamos filtrar por user_id aqui: o RLS do banco já devolve só as
// linhas do dono do token. Mesmo que este código tivesse um bug, o banco
// não entregaria clientes de outra pessoa.
export async function listarClientes(): Promise<Cliente[]> {
  await getUsuario(); // garante login (senão redireciona para /login)
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nome", { ascending: true });

  if (error) throw new Error(`Erro ao listar clientes: ${error.message}`);
  return data;
}

// Busca um cliente pelo id. Retorna null se não existir ou não for do usuário
// (o RLS faz os dois casos parecerem iguais: "não encontrado").
export async function buscarCliente(id: string): Promise<Cliente | null> {
  // id fora do formato UUID daria erro no Postgres; tratamos como "não existe".
  if (!UUID.test(id)) return null;
  await getUsuario();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar cliente: ${error.message}`);
  return data;
}

import { describe, expect, it } from "vitest";
import { sqlAdmin } from "../banco/admin";
import { TABELAS, VIEWS } from "./cenario";

// Ticket 10: testes "de catálogo". Leem as permissões direto do Postgres e
// comparam com a lista do que é liberado de propósito. Pegam o grant
// esquecido (ou o revoke que faltou) numa migração nova, antes de alguém
// achar pela API.
//
// Mudou de propósito? Atualize a lista aqui, no mesmo commit da migração.

// Consulta que devolve uma linha de JSON.
const json = <T>(sql: string): T => JSON.parse(sqlAdmin(`select coalesce(json_agg(t), '[]') from (${sql}) t`));

// "tabela: col1,col2" de um tipo de permissão do authenticated, por coluna.
// Inclui o que vem de grant na tabela inteira (vira todas as colunas).
function colunasLiberadas(permissao: "UPDATE" | "INSERT") {
  const linhas = json<{ tabela: string; colunas: string }[]>(`
    select table_name as tabela, string_agg(column_name, ',' order by column_name) as colunas
    from information_schema.column_privileges
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type = '${permissao}'
    group by table_name order by table_name`);
  return Object.fromEntries(linhas.map((l) => [l.tabela, l.colunas]));
}

describe("colunas que o usuário logado pode gravar direto", () => {
  it("UPDATE só nas colunas editáveis", () => {
    expect(colunasLiberadas("UPDATE")).toEqual({
      clientes: "nome,telefone",
      oficinas: "nome,telefone",
      orcamento_itens: "descricao,quantidade,tipo,valor_unitario_centavos",
      ordens: "km,obs_interna,problema,tanque",
      veiculos: "cliente_id,modelo",
    });
  });

  it("INSERT só nas colunas que o app preenche (oficina_id vem do default)", () => {
    expect(colunasLiberadas("INSERT")).toEqual({
      clientes: "nome,telefone",
      orcamento_itens: "descricao,orcamento_id,quantidade,tipo,valor_unitario_centavos",
      ordens: "cliente_id,km,obs_interna,problema,tanque,veiculo_id",
      veiculos: "cliente_id,modelo,placa",
    });
  });
});

describe("permissões na tabela inteira", () => {
  // O Supabase dá tudo para anon e authenticated em tabela nova: sem o
  // revoke, ela aparece aqui.
  const permissoes = (papel: string) =>
    Object.fromEntries(
      json<{ tabela: string; permissoes: string }[]>(`
        select table_name as tabela, string_agg(privilege_type, ',' order by privilege_type) as permissoes
        from information_schema.role_table_grants
        where grantee = '${papel}' and table_schema = 'public'
        group by table_name order by table_name`).map((l) => [l.tabela, l.permissoes]),
    );

  it("anon: nenhuma", () => {
    expect(permissoes("anon")).toEqual({});
  });

  it("authenticated: só leitura (e apagar item de orçamento)", () => {
    const leitura = Object.fromEntries([...TABELAS, ...VIEWS].map((t) => [t, "SELECT"]));
    expect(permissoes("authenticated")).toEqual({ ...leitura, orcamento_itens: "DELETE,SELECT" });
  });
});

describe("tabelas e RLS", () => {
  const tabelas = json<{ nome: string; tipo: string; rls: boolean }[]>(`
    select c.relname as nome, c.relkind as tipo, c.relrowsecurity as rls
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
    order by c.relname`);

  it("toda tabela e view do schema public está nos testes de segurança", () => {
    expect(tabelas.map((t) => t.nome).sort()).toEqual([...TABELAS, ...VIEWS].sort());
  });

  it("toda tabela tem RLS ligado", () => {
    expect(tabelas.filter((t) => t.tipo !== "v" && !t.rls).map((t) => t.nome)).toEqual([]);
  });

  it("toda view lê com as permissões de quem consulta (security_invoker)", () => {
    const semInvoker = json<{ nome: string }[]>(`
      select c.relname as nome from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
        and not coalesce('security_invoker=true' = any(c.reloptions), false)`);
    expect(semInvoker).toEqual([]);
  });
});

describe("funções do schema public", () => {
  const funcoes = json<{ nome: string; anon: boolean; definer: boolean; config: string[] | null }[]>(`
    select p.proname as nome,
           has_function_privilege('anon', p.oid, 'execute') as anon,
           p.prosecdef as definer,
           p.proconfig as config
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
    order by p.proname`);

  it("anon só executa as funções públicas de propósito", () => {
    expect(funcoes.filter((f) => f.anon).map((f) => f.nome)).toEqual([
      "enviar_pre_cadastro",
      "nome_oficina_publico",
      "responder_orcamento",
      "ver_orcamento",
    ]);
  });

  it('toda função security definer tem search_path = ""', () => {
    const semSearchPath = funcoes.filter((f) => f.definer && !f.config?.includes('search_path=""'));
    expect(semSearchPath.map((f) => f.nome)).toEqual([]);
  });
});

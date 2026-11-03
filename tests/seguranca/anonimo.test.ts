import { beforeAll, describe, expect, it } from "vitest";
import { clienteAnonimo, SENHA } from "../banco/usuarios";
import { linhaDe, montarOficina, MUDANCA, TABELAS, VIEWS, type Oficina } from "./cenario";

// Ticket 10: sem login, ninguém lê nem grava em tabela. As partes públicas
// passam só pelas funções liberadas (publicas.test.ts).

let a: Oficina;
const anon = clienteAnonimo();

beforeAll(async () => {
  // Com dados no banco: "recusado" não pode ser só tabela vazia.
  a = await montarOficina("A");
});

describe("anônimo nas tabelas: tudo recusado", () => {
  it.each([...TABELAS, ...VIEWS])("select em %s", async (tabela) => {
    const { data, error } = await anon.from(tabela).select("*");
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it.each(TABELAS)("insert em %s", async (tabela) => {
    // oficinas é a única sem oficina_id.
    const linha = tabela === "oficinas" ? MUDANCA[tabela] : { oficina_id: a.oficina, ...MUDANCA[tabela] };
    const { error } = await anon.from(tabela).insert(linha);
    expect(error?.code).toBe("42501");
  });

  it.each(TABELAS)("update em %s", async (tabela) => {
    const { coluna, id } = linhaDe(a, tabela);
    const { error } = await anon.from(tabela).update(MUDANCA[tabela]).eq(coluna, id);
    expect(error?.code).toBe("42501");
  });

  it.each(TABELAS)("delete em %s", async (tabela) => {
    const { coluna, id } = linhaDe(a, tabela);
    const { error } = await anon.from(tabela).delete().eq(coluna, id);
    expect(error?.code).toBe("42501");
  });

  it("os dados de A continuam lá", async () => {
    const { data } = await a.usuario.supabase.from("ordens").select("id, problema").eq("id", a.ordem).single();
    expect(data).toEqual({ id: a.ordem, problema: "Barulho no freio" });
  });
});

describe("cadastro exige confirmar o e-mail (igual à produção)", () => {
  it("conta nova sem clicar no link não entra", async () => {
    const email = `semconfirmar-${Date.now()}@teste.local`;
    const cadastro = await clienteAnonimo().auth.signUp({ email, password: SENHA });
    expect(cadastro.error).toBeNull();
    expect(cadastro.data.session).toBeNull();

    const login = await clienteAnonimo().auth.signInWithPassword({ email, password: SENHA });
    expect(login.error?.code).toBe("email_not_confirmed");
  });
});

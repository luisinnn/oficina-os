import { beforeAll, describe, expect, it } from "vitest";
import { clienteAnonimo, criarUsuarioConfirmado, type UsuarioTeste } from "./usuarios";

// Ticket 02: oficinas, membros e o RLS que separa uma oficina da outra.
// Dois usuários, A e B, cada um com sua oficina. A tenta mexer no que é de B.

let a: UsuarioTeste;
let b: UsuarioTeste;
let oficinaA: string;
let oficinaB: string;

async function criarOficina(u: UsuarioTeste, nome: string, telefone = "47999990000") {
  const { data, error } = await u.supabase.rpc("criar_oficina", { nome, telefone });
  if (error) throw new Error(`criar_oficina falhou: ${error.message}`);
  return data as string;
}

beforeAll(async () => {
  a = await criarUsuarioConfirmado("a");
  b = await criarUsuarioConfirmado("b");
  oficinaA = await criarOficina(a, "Oficina do A");
  oficinaB = await criarOficina(b, "Oficina do B");
});

describe("criar_oficina", () => {
  it("cria a oficina com código público aleatório e numeração de OS começando em 1", async () => {
    const { data, error } = await a.supabase.from("oficinas").select("*").eq("id", oficinaA).single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ nome: "Oficina do A", telefone: "47999990000", proximo_numero_os: 1 });
    // 9 bytes aleatórios em base64url = 12 caracteres, sem "=" no final.
    expect(data.codigo_publico).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it("coloca o usuário como dono da oficina", async () => {
    const { data } = await a.supabase.from("oficina_membros").select("oficina_id, user_id, papel");
    expect(data).toEqual([{ oficina_id: oficinaA, user_id: a.id, papel: "dono" }]);
  });

  it("minha_oficina() devolve a oficina do usuário logado", async () => {
    expect((await a.supabase.rpc("minha_oficina")).data).toBe(oficinaA);
    expect((await b.supabase.rpc("minha_oficina")).data).toBe(oficinaB);
  });

  it("falha na segunda chamada com o mesmo usuário", async () => {
    const { error } = await a.supabase.rpc("criar_oficina", { nome: "Outra", telefone: "47999990000" });
    expect(error?.message).toMatch(/já tem uma oficina/);
  });

  it("recusa nome vazio, nome grande demais e telefone fora do formato", async () => {
    const c = await criarUsuarioConfirmado("c");
    for (const [nome, telefone] of [
      ["", "47999990000"],
      ["x".repeat(101), "47999990000"],
      ["Oficina", "999990000"],
      ["Oficina", "(47) 99999-0000"],
    ]) {
      const { error } = await c.supabase.rpc("criar_oficina", { nome, telefone });
      expect(error, `${nome.slice(0, 10)} / ${telefone}`).not.toBeNull();
    }
    // Nenhuma das tentativas deixou oficina pela metade.
    expect((await c.supabase.rpc("minha_oficina")).data).toBeNull();
  });
});

describe("isolamento: A não enxerga nem mexe na oficina de B", () => {
  it("A só lê a própria oficina", async () => {
    const { data } = await a.supabase.from("oficinas").select("id");
    expect(data).toEqual([{ id: oficinaA }]);
  });

  it("A não acha a oficina de B nem pelo id", async () => {
    const { data } = await a.supabase.from("oficinas").select("id").eq("id", oficinaB);
    expect(data).toEqual([]);
  });

  it("A não lê os membros de B", async () => {
    const { data } = await a.supabase.from("oficina_membros").select("user_id").eq("oficina_id", oficinaB);
    expect(data).toEqual([]);
  });

  it("update de A no nome da oficina de B não afeta nenhuma linha", async () => {
    const { data } = await a.supabase.from("oficinas").update({ nome: "Invadida" }).eq("id", oficinaB).select();
    expect(data).toEqual([]);
    const { data: deB } = await b.supabase.from("oficinas").select("nome").single();
    expect(deB?.nome).toBe("Oficina do B");
  });

  it("A não se coloca como membro da oficina de B", async () => {
    const { error } = await a.supabase
      .from("oficina_membros")
      .insert({ oficina_id: oficinaB, user_id: a.id, papel: "dono" });
    expect(error).not.toBeNull();
  });

  it("A não cria oficina por insert direto, só pela função", async () => {
    const { error } = await a.supabase
      .from("oficinas")
      .insert({ nome: "Pirata", telefone: "47999990000", codigo_publico: "aaaaaaaaaaaa" });
    expect(error).not.toBeNull();
  });

  it("delete de A na oficina de B (e na própria) não apaga nada", async () => {
    for (const id of [oficinaB, oficinaA]) {
      const { data } = await a.supabase.from("oficinas").delete().eq("id", id).select();
      expect(data ?? []).toEqual([]);
    }
    expect((await a.supabase.from("oficinas").select("id")).data).toEqual([{ id: oficinaA }]);
    expect((await b.supabase.from("oficinas").select("id")).data).toEqual([{ id: oficinaB }]);
  });
});

describe("colunas protegidas da própria oficina", () => {
  it("A altera nome e telefone da própria oficina", async () => {
    const { data, error } = await a.supabase
      .from("oficinas")
      .update({ nome: "Oficina do A (novo)", telefone: "4733334444" })
      .eq("id", oficinaA)
      .select("nome, telefone");
    expect(error).toBeNull();
    expect(data).toEqual([{ nome: "Oficina do A (novo)", telefone: "4733334444" }]);
  });

  it("o banco recusa nome e telefone fora do formato também no update", async () => {
    for (const mudanca of [{ nome: "" }, { nome: "x".repeat(101) }, { telefone: "47-99999-0000" }]) {
      const { error } = await a.supabase.from("oficinas").update(mudanca).eq("id", oficinaA);
      expect(error, JSON.stringify(mudanca)).not.toBeNull();
    }
  });

  it.each([
    ["codigo_publico", "trocado-pelo-A"],
    ["proximo_numero_os", 999],
    ["id", "00000000-0000-0000-0000-000000000000"],
  ])("A não troca %s por update direto", async (coluna, valor) => {
    const antes = (await a.supabase.from("oficinas").select("*").single()).data;
    const { error } = await a.supabase.from("oficinas").update({ [coluna]: valor }).eq("id", oficinaA);
    expect(error?.code).toBe("42501"); // permission denied
    const depois = (await a.supabase.from("oficinas").select("*").single()).data;
    expect(depois).toEqual(antes);
  });

  it("A não troca de papel nem de oficina em oficina_membros", async () => {
    const { error } = await a.supabase.from("oficina_membros").update({ oficina_id: oficinaB }).eq("user_id", a.id);
    expect(error).not.toBeNull();
    expect((await a.supabase.rpc("minha_oficina")).data).toBe(oficinaA);
  });
});

describe("anônimo", () => {
  it.each(["oficinas", "oficina_membros"])("não lê nada de %s", async (tabela) => {
    const { data, error } = await clienteAnonimo().from(tabela).select("*");
    // Anônimo não tem permissão nenhuma na tabela: a API responde "permission denied".
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it.each([
    ["criar_oficina", { nome: "Anônima", telefone: "47999990000" }],
    ["minha_oficina", {}],
  ])("não executa %s", async (funcao, args) => {
    const { error } = await clienteAnonimo().rpc(funcao, args);
    expect(error).not.toBeNull();
  });
});

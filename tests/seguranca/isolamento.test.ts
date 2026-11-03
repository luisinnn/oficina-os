import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { linhaDe, montarOficina, MUDANCA, semEfeito, TABELAS, VIEWS, type Oficina, type Tabela } from "./cenario";

// Ticket 10: uma oficina nunca enxerga nem mexe na outra. A ataca B pela API,
// logado e com a chave publishable, como faria pelo DevTools do navegador.

let a: Oficina;
let b: Oficina;
let sa: SupabaseClient;

beforeAll(async () => {
  a = await montarOficina("A");
  b = await montarOficina("B");
  sa = a.usuario.supabase;
});

// Como B vê a própria linha: serve de "antes e depois" do ataque.
async function linhaDeB(tabela: Tabela) {
  const { coluna, id } = linhaDe(b, tabela);
  const { data, error } = await b.usuario.supabase.from(tabela).select("*").eq(coluna, id).single();
  expect(error).toBeNull();
  return data;
}

// Dono de cada linha: oficina_id, ou o próprio id na tabela oficinas.
const donoDa = (tabela: Tabela, linha: Record<string, unknown>) =>
  tabela === "oficinas" ? linha.id : linha.oficina_id;

describe("select: A só lê o que é de A", () => {
  it.each(TABELAS)("%s", async (tabela) => {
    const { data, error } = await sa.from(tabela).select("*");
    expect(error).toBeNull();
    // Não vale passar por estar vazio: A tem linha em todas as tabelas.
    expect(data!.length).toBeGreaterThan(0);
    for (const linha of data!) expect(donoDa(tabela, linha)).toBe(a.oficina);

    const { coluna, id } = linhaDe(b, tabela);
    const direto = await sa.from(tabela).select("*").eq(coluna, id);
    expect(direto.data).toEqual([]);
  });

  it.each(VIEWS)("view %s", async (view) => {
    const { data, error } = await sa.from(view).select("id");
    expect(error).toBeNull();
    const ids = data!.map((l) => l.id);
    expect(ids).toEqual([a.ordemFechada]);
  });
});

describe("A não muda nem apaga linha de B pelo id", () => {
  it.each(TABELAS)("update em %s", async (tabela) => {
    const antes = await linhaDeB(tabela);
    const { coluna, id } = linhaDe(b, tabela);
    semEfeito(await sa.from(tabela).update(MUDANCA[tabela]).eq(coluna, id).select());
    expect(await linhaDeB(tabela)).toEqual(antes);
  });

  it.each(TABELAS)("delete em %s", async (tabela) => {
    const antes = await linhaDeB(tabela);
    const { coluna, id } = linhaDe(b, tabela);
    semEfeito(await sa.from(tabela).delete().eq(coluna, id).select());
    expect(await linhaDeB(tabela)).toEqual(antes);
  });
});

describe("orcamento_respostas é histórico: nem a própria oficina apaga ou muda", () => {
  const lerResposta = () => sa.from("orcamento_respostas").select("*").eq("id", a.resposta).single();

  it("update", async () => {
    const antes = await lerResposta();
    semEfeito(await sa.from("orcamento_respostas").update({ total_centavos: 1 }).eq("id", a.resposta).select());
    expect(await lerResposta()).toEqual(antes);
  });

  it("delete", async () => {
    semEfeito(await sa.from("orcamento_respostas").delete().eq("id", a.resposta).select());
    expect((await lerResposta()).data).not.toBeNull();
  });
});

// A primeira barreira é a coluna: oficina_id não tem grant de insert (vem do
// default). O RLS "with check" fica de reserva; se alguém liberar a coluna,
// o teste de catálogo acusa.
describe("insert com oficina_id de B: recusado", () => {
  const linhas = (): Partial<Record<Tabela, Record<string, unknown>>> => ({
    clientes: { oficina_id: b.oficina, nome: "Intruso", telefone: "47900000000" },
    veiculos: { oficina_id: b.oficina, placa: "INV0000", modelo: "Intruso", cliente_id: b.cliente },
    ordens: { oficina_id: b.oficina, veiculo_id: b.veiculo, cliente_id: b.cliente, problema: "Intruso", km: 1 },
    orcamentos: { oficina_id: b.oficina, ordem_id: b.ordem },
    orcamento_itens: {
      oficina_id: b.oficina,
      orcamento_id: b.orcamento,
      tipo: "peca",
      descricao: "Intruso",
      quantidade: 1,
      valor_unitario_centavos: 1,
    },
    orcamento_respostas: {
      oficina_id: b.oficina,
      orcamento_id: b.orcamento,
      resposta: "aprovado",
      total_centavos: 1,
      itens: [],
      respondido_em: new Date().toISOString(),
    },
    pre_cadastros: {
      oficina_id: b.oficina,
      nome: "Intruso",
      telefone: "47900000000",
      placa: "INV0000",
      modelo: "Intruso",
      problema: "Intruso",
    },
  });

  // oficinas não tem oficina_id; oficina_membros tem o próprio bloco abaixo.
  it.each(TABELAS.filter((t) => t !== "oficinas" && t !== "oficina_membros"))("%s", async (tabela) => {
    const { error } = await sa.from(tabela).insert(linhas()[tabela]!);
    expect(error?.code).toBe("42501");
  });
});

describe("dado de A apontando para dado de B: recusado", () => {
  // As chaves estrangeiras levam a oficina junto: (oficina_id, veiculo_id)
  // precisa existir em veiculos, e o veículo de B não é da oficina de A.
  it("OS de A com veículo e cliente de B", async () => {
    const { error } = await sa
      .from("ordens")
      .insert({ veiculo_id: b.veiculo, cliente_id: b.cliente, problema: "Intruso", km: 1 });
    // O carro de B tem OS aberta: o índice "uma OS aberta por carro" (23505)
    // pode recusar antes da chave estrangeira (23503). Os dois barram.
    expect(["23503", "23505"]).toContain(error?.code);
    const { data } = await sa.from("ordens").select("id").eq("veiculo_id", b.veiculo);
    expect(data).toEqual([]);
  });

  it("veículo de A com cliente de B", async () => {
    const { error } = await sa.from("veiculos").insert({ placa: "INV0001", modelo: "Intruso", cliente_id: b.cliente });
    expect(error?.code).toBe("23503");
  });

  it("veículo de A passando para cliente de B", async () => {
    const { error } = await sa.from("veiculos").update({ cliente_id: b.cliente }).eq("id", a.veiculo);
    expect(error?.code).toBe("23503");
  });

  it("item no orçamento de B", async () => {
    const { error } = await sa.from("orcamento_itens").insert({
      orcamento_id: b.orcamento,
      tipo: "peca",
      descricao: "Intruso",
      quantidade: 1,
      valor_unitario_centavos: 1,
    });
    expect(error?.code).toBe("23503");
  });
});

describe("funções do painel com ids de B: erro, e B fica igual", () => {
  it("mudar_status", async () => {
    const antes = await linhaDeB("ordens");
    const { error } = await sa.rpc("mudar_status", { ordem_id: b.ordem, novo_status: "em_servico" });
    expect(error?.code).toBe("P0002");
    expect(await linhaDeB("ordens")).toEqual(antes);
  });

  it("enviar_orcamento", async () => {
    const antes = await linhaDeB("orcamentos");
    const { data, error } = await sa.rpc("enviar_orcamento", { ordem_id: b.ordem });
    expect(error?.code).toBe("P0002");
    expect(data).toBeNull();
    expect(await linhaDeB("orcamentos")).toEqual(antes);
  });

  it("confirmar_pre_cadastro", async () => {
    const antes = await linhaDeB("pre_cadastros");
    const { error } = await sa.rpc("confirmar_pre_cadastro", { id: b.preCadastro, km: 1000 });
    expect(error?.code).toBe("P0002");
    expect(await linhaDeB("pre_cadastros")).toEqual(antes);
  });

  it("descartar_pre_cadastro", async () => {
    const antes = await linhaDeB("pre_cadastros");
    const { error } = await sa.rpc("descartar_pre_cadastro", { id: b.preCadastro });
    expect(error?.code).toBe("P0002");
    expect(await linhaDeB("pre_cadastros")).toEqual(antes);
  });

  // criar_ordem não recebe id: o ataque possível é usar placa e telefone de B.
  it("criar_ordem com a placa e o telefone de B: cria em A e não mexe em B", async () => {
    const antes = await linhaDeB("veiculos");
    const { data: ordem, error } = await sa.rpc("criar_ordem", {
      placa: b.placa,
      modelo: "Outro",
      nome: "Outro Nome",
      telefone: b.telefoneCliente,
      problema: "Teste",
      km: 1,
    });
    expect(error).toBeNull();
    const nova = await sa.from("ordens").select("oficina_id").eq("id", ordem).single();
    expect(nova.data!.oficina_id).toBe(a.oficina);
    expect(await linhaDeB("veiculos")).toEqual(antes);
    const deB = await b.usuario.supabase.from("ordens").select("id").eq("id", ordem);
    expect(deB.data).toEqual([]);
  });
});

describe("oficina_membros: A não entra na oficina de B", () => {
  it("insert de A como membro de B", async () => {
    const { error } = await sa.from("oficina_membros").insert({ oficina_id: b.oficina, user_id: a.usuario.id });
    expect(error?.code).toBe("42501");
  });

  it("update da própria linha para a oficina de B", async () => {
    semEfeito(await sa.from("oficina_membros").update({ oficina_id: b.oficina }).eq("user_id", a.usuario.id).select());
    const { data } = await sa.from("oficina_membros").select("oficina_id").single();
    expect(data!.oficina_id).toBe(a.oficina);
  });

  it("criar_oficina de novo não troca A de oficina", async () => {
    const { error } = await sa.rpc("criar_oficina", { nome: "Segunda", telefone: "47999990000" });
    expect(error).not.toBeNull();
    const { data } = await sa.from("oficina_membros").select("oficina_id");
    expect(data).toEqual([{ oficina_id: a.oficina }]);
  });
});

describe("colunas protegidas da própria oficina: A não muda por update direto", () => {
  // Mesmo regravando o valor atual: o banco recusa só por tentar a coluna.
  async function recusaColuna(tabela: Tabela, id: string, coluna: string) {
    const antes = await sa.from(tabela).select("*").eq("id", id).single();
    const { error } = await sa
      .from(tabela)
      .update({ [coluna]: (antes.data as Record<string, unknown>)[coluna] })
      .eq("id", id);
    expect(error?.code, `${tabela}.${coluna}`).toBe("42501");
  }

  it.each(["codigo_publico", "proximo_numero_os"])("oficinas.%s", (coluna) =>
    recusaColuna("oficinas", a.oficina, coluna),
  );

  it.each(["status", "numero", "oficina_id"])("ordens.%s", (coluna) => recusaColuna("ordens", a.ordem, coluna));

  it("todas as colunas de orcamentos", async () => {
    const { data } = await sa.from("orcamentos").select("*").eq("id", a.orcamento).single();
    const colunas = Object.keys(data!);
    expect(colunas).toContain("estado");
    for (const coluna of colunas) await recusaColuna("orcamentos", a.orcamento, coluna);
  });

  it("valor diferente também não passa (status direto para entregue)", async () => {
    const { error } = await sa.from("ordens").update({ status: "entregue" }).eq("id", a.ordem);
    expect(error?.code).toBe("42501");
    const { data } = await sa.from("ordens").select("status").eq("id", a.ordem).single();
    expect(data!.status).toBe("aguardando");
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { sqlAdmin } from "./admin";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "./usuarios";
import type { DadosItem } from "@/lib/orcamento";

// Ticket 06: orçamento da OS (1 por OS), itens, total calculado e histórico
// de respostas que ninguém apaga.

let a: UsuarioComOficina;
let b: UsuarioComOficina;

let sequencia = 1000;
const placaNova = () => `ORC${sequencia++}`;

const PECA: DadosItem = { tipo: "peca", descricao: "Pastilha de freio", quantidade: 2, valor_unitario_centavos: 8990 };

// OS nova pelo caminho do app. Devolve o id da OS e do orçamento dela.
async function novaOs(u: UsuarioComOficina) {
  const { data: ordem, error } = await u.supabase.rpc("criar_ordem", {
    placa: placaNova(),
    modelo: "Gol 1.0",
    nome: "João da Silva",
    telefone: "47911112222",
    problema: "Barulho no freio",
  });
  if (error) throw new Error(`criar_ordem: ${error.message}`);
  const orc = await u.supabase.from("orcamentos").select("id").eq("ordem_id", ordem).single();
  if (orc.error) throw new Error(`select orcamentos: ${orc.error.message}`);
  return { ordem: ordem as string, orcamento: orc.data.id as string };
}

function inserirItem(u: UsuarioComOficina, orcamento_id: string, item: Partial<DadosItem> = {}) {
  return u.supabase
    .from("orcamento_itens")
    .insert({ orcamento_id, ...PECA, ...item })
    .select("id")
    .single();
}

async function novoItem(u: UsuarioComOficina, orcamento_id: string, item: Partial<DadosItem> = {}) {
  const { data, error } = await inserirItem(u, orcamento_id, item);
  if (error) throw new Error(`insert orcamento_itens: ${error.message}`);
  return data.id as string;
}

async function lerOrcamento(u: UsuarioComOficina, id: string) {
  const { data, error } = await u.supabase
    .from("orcamentos")
    .select("estado, token_hash, token_expira_em, enviado_em, respondido_em, motivo_recusa, total_centavos")
    .eq("id", id)
    .single();
  if (error) throw new Error(`select orcamentos: ${error.message}`);
  return data;
}

// Hash de mentira, diferente a cada vez (token_hash é único).
const HASH_FALSO = "decode(md5(gen_random_uuid()::text), 'hex')";

// Põe o orçamento como já respondido pelo cliente, com a linha no histórico,
// do jeito que o ticket 08 vai gravar.
function simularResposta(orcamento: string, resposta: "aprovado" | "recusado", total: number) {
  sqlAdmin(`
    update public.orcamentos set estado = '${resposta}', token_hash = ${HASH_FALSO},
      token_expira_em = now() + interval '30 days', enviado_em = now(), respondido_em = now(),
      motivo_recusa = ${resposta === "recusado" ? "'Caro'" : "null"}
    where id = '${orcamento}';
    insert into public.orcamento_respostas (oficina_id, orcamento_id, resposta, total_centavos, itens, motivo)
    select oficina_id, id, '${resposta}', ${total}, '[]'::jsonb, motivo_recusa
    from public.orcamentos where id = '${orcamento}';
  `);
}

function simularEnvio(orcamento: string) {
  sqlAdmin(`
    update public.orcamentos set estado = 'enviado', token_hash = ${HASH_FALSO},
      token_expira_em = now() + interval '30 days', enviado_em = now()
    where id = '${orcamento}';
  `);
}

beforeAll(async () => {
  a = await criarUsuarioComOficina("a");
  b = await criarUsuarioComOficina("b");
});

describe("orçamento da OS", () => {
  it("toda OS nova já vem com orçamento em rascunho, sem itens e total zero", async () => {
    const { orcamento } = await novaOs(a);
    const orc = await lerOrcamento(a, orcamento);
    expect(orc).toMatchObject({ estado: "rascunho", token_hash: null, total_centavos: 0 });
  });

  it("OS antigas (de antes do ticket 06) também têm orçamento", () => {
    const semOrcamento = sqlAdmin(
      "select count(*) from public.ordens o where not exists (select 1 from public.orcamentos x where x.ordem_id = o.id)",
    );
    expect(semOrcamento).toBe("0");
  });

  it("só um orçamento por OS", () => {
    expect(() =>
      sqlAdmin(`insert into public.orcamentos (oficina_id, ordem_id)
        select oficina_id, id from public.ordens limit 1`),
    ).toThrow(/orcamentos_oficina_id_ordem_id_key/);
  });

  it("estado do orçamento não muda o status da OS", async () => {
    const { ordem, orcamento } = await novaOs(a);
    simularResposta(orcamento, "aprovado", 0);
    const { data } = await a.supabase.from("ordens").select("status").eq("id", ordem).single();
    expect(data?.status).toBe("aguardando");
  });
});

describe("total", () => {
  it("é a soma de quantidade × valor de todos os itens", async () => {
    const { orcamento } = await novaOs(a);
    await novoItem(a, orcamento, { quantidade: 2, valor_unitario_centavos: 8990 });
    await novoItem(a, orcamento, { tipo: "mao_de_obra", quantidade: 1, valor_unitario_centavos: 15000 });
    await novoItem(a, orcamento, { quantidade: 4, valor_unitario_centavos: 1 });
    expect((await lerOrcamento(a, orcamento)).total_centavos).toBe(2 * 8990 + 15000 + 4);
  });

  it("acompanha edição e remoção de item", async () => {
    const { orcamento } = await novaOs(a);
    const item = await novoItem(a, orcamento, { quantidade: 1, valor_unitario_centavos: 1000 });
    await novoItem(a, orcamento, { quantidade: 1, valor_unitario_centavos: 500 });

    await a.supabase.from("orcamento_itens").update({ quantidade: 3 }).eq("id", item);
    expect((await lerOrcamento(a, orcamento)).total_centavos).toBe(3500);

    await a.supabase.from("orcamento_itens").delete().eq("id", item);
    expect((await lerOrcamento(a, orcamento)).total_centavos).toBe(500);
  });

  it("não estoura com valores no limite", async () => {
    const { orcamento } = await novaOs(a);
    await novoItem(a, orcamento, { quantidade: 999, valor_unitario_centavos: 10_000_000 });
    await novoItem(a, orcamento, { quantidade: 999, valor_unitario_centavos: 10_000_000 });
    expect((await lerOrcamento(a, orcamento)).total_centavos).toBe(2 * 999 * 10_000_000);
  });
});

describe("limites do item", () => {
  let orcamento: string;
  beforeAll(async () => {
    ({ orcamento } = await novaOs(a));
  });

  it.each([
    ["quantidade 0", { quantidade: 0 }],
    ["quantidade negativa", { quantidade: -1 }],
    ["quantidade 1000", { quantidade: 1000 }],
    ["valor negativo", { valor_unitario_centavos: -1 }],
    ["valor acima do teto", { valor_unitario_centavos: 10_000_001 }],
    ["descrição vazia", { descricao: "" }],
    ["descrição com espaço nas pontas", { descricao: " Óleo " }],
    ["descrição longa", { descricao: "a".repeat(201) }],
    ["tipo inválido", { tipo: "brinde" as DadosItem["tipo"] }],
  ])("%s é recusado", async (_nome, item) => {
    const { error } = await inserirItem(a, orcamento, item);
    expect(error?.code).toBe("23514");
  });

  it("limites exatos valem (valor 0, quantidade 999, descrição de 200)", async () => {
    const { error } = await inserirItem(a, orcamento, {
      quantidade: 999,
      valor_unitario_centavos: 0,
      descricao: "🔧".repeat(200),
    });
    expect(error).toBeNull();
  });

  it("update também respeita os limites", async () => {
    const item = await novoItem(a, orcamento);
    const { error } = await a.supabase.from("orcamento_itens").update({ quantidade: 0 }).eq("id", item);
    expect(error?.code).toBe("23514");
  });
});

describe("editar depois de enviar", () => {
  it("editar item de orçamento aprovado volta para rascunho, anula o link e mantém o histórico", async () => {
    const { orcamento } = await novaOs(a);
    const item = await novoItem(a, orcamento, { quantidade: 1, valor_unitario_centavos: 40000 });
    simularResposta(orcamento, "aprovado", 40000);
    expect((await lerOrcamento(a, orcamento)).estado).toBe("aprovado");

    const { error } = await a.supabase.from("orcamento_itens").update({ valor_unitario_centavos: 50000 }).eq("id", item);
    expect(error).toBeNull();

    expect(await lerOrcamento(a, orcamento)).toMatchObject({
      estado: "rascunho",
      token_hash: null,
      token_expira_em: null,
      respondido_em: null,
      motivo_recusa: null,
      total_centavos: 50000,
    });
    const respostas = await a.supabase
      .from("orcamento_respostas")
      .select("resposta, total_centavos")
      .eq("orcamento_id", orcamento);
    expect(respostas.data).toEqual([{ resposta: "aprovado", total_centavos: 40000 }]);
  });

  it("recusado: limpa também o motivo", async () => {
    const { orcamento } = await novaOs(a);
    const item = await novoItem(a, orcamento);
    simularResposta(orcamento, "recusado", 17980);
    await a.supabase.from("orcamento_itens").update({ descricao: "Pastilha dianteira" }).eq("id", item);
    expect(await lerOrcamento(a, orcamento)).toMatchObject({ estado: "rascunho", motivo_recusa: null });
  });

  it.each(["insert", "delete"] as const)("enviado: %s de item também anula o link", async (acao) => {
    const { orcamento } = await novaOs(a);
    const item = await novoItem(a, orcamento);
    simularEnvio(orcamento);

    if (acao === "insert") await novoItem(a, orcamento);
    else await a.supabase.from("orcamento_itens").delete().eq("id", item);

    expect(await lerOrcamento(a, orcamento)).toMatchObject({ estado: "rascunho", token_hash: null });
  });

  it("salvar item sem mudar nada não anula o link", async () => {
    const { orcamento } = await novaOs(a);
    const item = await novoItem(a, orcamento);
    simularEnvio(orcamento);
    const { error } = await a.supabase.from("orcamento_itens").update(PECA).eq("id", item);
    expect(error).toBeNull();
    expect((await lerOrcamento(a, orcamento)).estado).toBe("enviado");
  });

  it("enviado_em continua (mostra que já foi enviado uma vez)", async () => {
    const { orcamento } = await novaOs(a);
    simularEnvio(orcamento);
    await novoItem(a, orcamento);
    expect((await lerOrcamento(a, orcamento)).enviado_em).not.toBeNull();
  });
});

describe("permissões", () => {
  let orcamento: string;
  let item: string;
  beforeAll(async () => {
    ({ orcamento } = await novaOs(a));
    item = await novoItem(a, orcamento);
    simularResposta(orcamento, "aprovado", 17980);
  });

  it("membro lê o histórico de respostas", async () => {
    const { data, error } = await a.supabase.from("orcamento_respostas").select("id").eq("orcamento_id", orcamento);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("ninguém edita, apaga ou grava resposta pela API", async () => {
    const r = a.supabase.from("orcamento_respostas");
    expect((await r.update({ total_centavos: 1 }).eq("orcamento_id", orcamento)).error?.code).toBe("42501");
    expect((await r.delete().eq("orcamento_id", orcamento)).error?.code).toBe("42501");
    const insert = await r.insert({ orcamento_id: orcamento, resposta: "aprovado", total_centavos: 1, itens: [] });
    expect(insert.error?.code).toBe("42501");
    expect(sqlAdmin(`select count(*) from public.orcamento_respostas where orcamento_id = '${orcamento}'`)).toBe("1");
  });

  it("update direto em orcamentos (estado, token) dá erro de permissão", async () => {
    const r = a.supabase.from("orcamentos");
    expect((await r.update({ estado: "aprovado" }).eq("id", orcamento)).error?.code).toBe("42501");
    expect((await r.update({ token_hash: null }).eq("id", orcamento)).error?.code).toBe("42501");
  });

  it("orçamento não se cria nem se apaga pela API", async () => {
    const { ordem } = await novaOs(a);
    const r = a.supabase.from("orcamentos");
    expect((await r.insert({ ordem_id: ordem })).error?.code).toBe("42501");
    expect((await r.delete().eq("id", orcamento)).error?.code).toBe("42501");
  });

  it("item não muda de orçamento", async () => {
    const outro = (await novaOs(a)).orcamento;
    const { error } = await a.supabase.from("orcamento_itens").update({ orcamento_id: outro }).eq("id", item);
    expect(error?.code).toBe("42501");
  });

  it("oficina_id do item vem da oficina do usuário, não do que ele manda", async () => {
    const { error } = await a.supabase
      .from("orcamento_itens")
      .insert({ orcamento_id: orcamento, oficina_id: b.oficina, ...PECA });
    expect(error?.code).toBe("42501");
  });

  it("anônimo não lê nada", async () => {
    const anon = clienteAnonimo();
    for (const tabela of ["orcamentos", "orcamento_itens", "orcamento_respostas"]) {
      expect((await anon.from(tabela).select("id")).error?.code).toBe("42501");
    }
  });
});

describe("entre oficinas", () => {
  let orcamentoB: string;
  let itemB: string;
  beforeAll(async () => {
    ({ orcamento: orcamentoB } = await novaOs(b));
    itemB = await novoItem(b, orcamentoB);
    simularResposta(orcamentoB, "aprovado", 17980);
  });

  it("A não vê orçamento, itens nem respostas de B", async () => {
    expect((await a.supabase.from("orcamentos").select("id").eq("id", orcamentoB)).data).toEqual([]);
    expect((await a.supabase.from("orcamento_itens").select("id").eq("id", itemB)).data).toEqual([]);
    expect((await a.supabase.from("orcamento_respostas").select("id").eq("orcamento_id", orcamentoB)).data).toEqual(
      [],
    );
  });

  it("A não põe item no orçamento de B", async () => {
    const { error } = await inserirItem(a, orcamentoB);
    expect(error).not.toBeNull();
    expect(sqlAdmin(`select count(*) from public.orcamento_itens where orcamento_id = '${orcamentoB}'`)).toBe("1");
  });

  it("A não edita nem apaga item de B (e o orçamento de B não volta para rascunho)", async () => {
    await a.supabase.from("orcamento_itens").update({ quantidade: 5 }).eq("id", itemB);
    await a.supabase.from("orcamento_itens").delete().eq("id", itemB);
    expect(sqlAdmin(`select quantidade from public.orcamento_itens where id = '${itemB}'`)).toBe("2");
    expect((await lerOrcamento(b, orcamentoB)).estado).toBe("aprovado");
  });
});

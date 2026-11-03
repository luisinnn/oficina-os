import { beforeAll, describe, expect, it } from "vitest";
import { sqlAdmin } from "./admin";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "./usuarios";

// Ticket 08: página pública de aprovação. O cliente (anônimo) vê o orçamento
// pelo token do link (ver_orcamento) e aprova ou recusa (responder_orcamento).

let a: UsuarioComOficina;

let sequencia = 3000;
const placaNova = () => `APR${sequencia++}`;

// Itens de toda OS de teste: 2 × R$ 89,90 + 1 × R$ 150,00 = R$ 329,80.
const ITENS = [
  { tipo: "peca", descricao: "Pastilha de freio", quantidade: 2, valor_unitario_centavos: 8990 },
  { tipo: "mao_de_obra", descricao: "Troca das pastilhas", quantidade: 1, valor_unitario_centavos: 15000 },
];
const TOTAL = 32980;

// OS com os ITENS, já enviada.
async function osEnviada(u: UsuarioComOficina = a) {
  const { data: ordem, error } = await u.supabase.rpc("criar_ordem", {
    placa: placaNova(),
    modelo: "Gol 1.0",
    nome: "João da Silva",
    telefone: "47911112222",
    problema: "Barulho no freio",
    km: 50000,
    obs_interna: "Cliente chato com prazo",
  });
  if (error) throw new Error(`criar_ordem: ${error.message}`);
  const orc = await u.supabase.from("orcamentos").select("id").eq("ordem_id", ordem).single();
  if (orc.error) throw new Error(`select orcamentos: ${orc.error.message}`);
  // Um por vez, como no app: inseridos juntos teriam o mesmo created_at e a
  // ordem entre eles ficaria indefinida.
  for (const item of ITENS) {
    const ins = await u.supabase.from("orcamento_itens").insert({ orcamento_id: orc.data.id, ...item });
    if (ins.error) throw new Error(`insert orcamento_itens: ${ins.error.message}`);
  }
  const token = await u.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
  if (token.error) throw new Error(`enviar_orcamento: ${token.error.message}`);
  return { ordem: ordem as string, orcamento: orc.data.id as string, token: token.data as string };
}

const ver = (token: string) => clienteAnonimo().rpc("ver_orcamento", { token });

const responder = (token: string, aprovar: boolean, motivo: string | null = null) =>
  clienteAnonimo().rpc("responder_orcamento", { token, aprovar, motivo });

async function lerOrcamento(id: string) {
  const { data, error } = await a.supabase
    .from("orcamentos")
    .select("estado, respondido_em, motivo_recusa")
    .eq("id", id)
    .single();
  if (error) throw new Error(`select orcamentos: ${error.message}`);
  return data;
}

async function respostas(orcamento: string) {
  const { data, error } = await a.supabase
    .from("orcamento_respostas")
    .select("resposta, total_centavos, itens, motivo, respondido_em")
    .eq("orcamento_id", orcamento);
  if (error) throw new Error(`select orcamento_respostas: ${error.message}`);
  return data;
}

// Faz o link do orçamento vencer (não dá para esperar 30 dias).
const vencer = (orcamento: string) =>
  sqlAdmin(`update public.orcamentos set token_expira_em = now() - interval '1 second' where id = '${orcamento}'`);

// Token no formato certo, mas que não é de nenhum orçamento.
const TOKEN_FALSO = "A".repeat(43);

beforeAll(async () => {
  a = await criarUsuarioComOficina("aprova");
});

describe("ver_orcamento", () => {
  it("devolve só oficina, OS, carro, km, itens, total, estado e expirado", async () => {
    const { ordem, token } = await osEnviada();
    const { data, error } = await ver(token);
    expect(error).toBeNull();

    const { data: os } = await a.supabase.from("ordens").select("numero").eq("id", ordem).single();
    expect(data).toEqual({
      oficina: "Oficina aprova",
      numero: os!.numero,
      placa: expect.stringMatching(/^APR\d{4}$/),
      modelo: "Gol 1.0",
      km: 50000,
      itens: ITENS,
      total_centavos: TOTAL,
      estado: "enviado",
      expirado: false,
    });

    // Nada do cliente, ids internos ou observação interna.
    const texto = JSON.stringify(data);
    for (const proibido of ["João", "47911112222", "Cliente chato", ordem, a.oficina]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("token errado ou vazio: null", async () => {
    for (const token of [TOKEN_FALSO, "", "x"]) {
      const { data, error } = await ver(token);
      expect(error).toBeNull();
      expect(data).toBeNull();
    }
  });

  it("token anulado por edição do orçamento: null", async () => {
    const { orcamento, token } = await osEnviada();
    await a.supabase.from("orcamento_itens").update({ quantidade: 3 }).eq("orcamento_id", orcamento).eq("tipo", "peca");
    expect((await ver(token)).data).toBeNull();
  });

  it("token anulado por reenvio: null", async () => {
    const { ordem, token } = await osEnviada();
    await a.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
    expect((await ver(token)).data).toBeNull();
  });

  it("token vencido sem resposta: null, igual a token errado", async () => {
    const { orcamento, token } = await osEnviada();
    vencer(orcamento);
    const { data, error } = await ver(token);
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("já respondido e vencido: ainda mostra a resposta, com expirado = true", async () => {
    const { orcamento, token } = await osEnviada();
    await responder(token, false);
    vencer(orcamento);
    expect((await ver(token)).data).toMatchObject({ estado: "recusado", expirado: true });
  });

  it("depois de responder, mostra o estado da resposta", async () => {
    const { token } = await osEnviada();
    await responder(token, true);
    expect((await ver(token)).data).toMatchObject({ estado: "aprovado" });
  });
});

describe("responder_orcamento", () => {
  it("aprovar: estado aprovado, sem motivo, e grava o histórico com total e itens", async () => {
    const { orcamento, token } = await osEnviada();
    const { data, error } = await responder(token, true, "ignorado na aprovação");
    expect(error).toBeNull();
    expect(data).toBe("aprovado");

    const orc = await lerOrcamento(orcamento);
    expect(orc).toMatchObject({ estado: "aprovado", motivo_recusa: null });
    expect(Date.now() - new Date(orc.respondido_em!).getTime()).toBeLessThan(60_000);

    const hist = await respostas(orcamento);
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({
      resposta: "aprovado",
      total_centavos: TOTAL,
      motivo: null,
      respondido_em: orc.respondido_em,
      itens: ITENS,
    });
  });

  it("recusar com motivo: grava o motivo sem espaços nas pontas", async () => {
    const { orcamento, token } = await osEnviada();
    const { data, error } = await responder(token, false, "  Achei caro  ");
    expect(error).toBeNull();
    expect(data).toBe("recusado");
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "recusado", motivo_recusa: "Achei caro" });
    expect(await respostas(orcamento)).toMatchObject([{ resposta: "recusado", motivo: "Achei caro" }]);
  });

  it.each([null, "", "   "])("recusar com motivo %j: motivo null", async (motivo) => {
    const { orcamento, token } = await osEnviada();
    expect((await responder(token, false, motivo)).error).toBeNull();
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "recusado", motivo_recusa: null });
    expect(await respostas(orcamento)).toMatchObject([{ motivo: null }]);
  });

  it("motivo com mais de 500 caracteres: recusa e nada muda", async () => {
    const { orcamento, token } = await osEnviada();
    const { error } = await responder(token, false, "a".repeat(501));
    expect(error).not.toBeNull();
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "enviado" });
    expect(await respostas(orcamento)).toHaveLength(0);
    // 500 cabe.
    expect((await responder(token, false, "a".repeat(500))).error).toBeNull();
  });

  // Todos os casos de falha dão a mesma resposta: não dá para saber qual foi.
  async function falhaGenerica(token: string) {
    const { data, error } = await responder(token, true);
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "P0002", message: "Orçamento não encontrado." });
  }

  it("token errado: não encontrado", async () => {
    await falhaGenerica(TOKEN_FALSO);
    await falhaGenerica("");
  });

  it("token vencido: não encontrado e nada muda", async () => {
    const { orcamento, token } = await osEnviada();
    vencer(orcamento);
    await falhaGenerica(token);
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "enviado" });
    expect(await respostas(orcamento)).toHaveLength(0);
  });

  it("já respondido: segunda resposta falha e o histórico fica com uma linha", async () => {
    const { orcamento, token } = await osEnviada();
    expect((await responder(token, true)).error).toBeNull();
    await falhaGenerica(token);
    const { error } = await responder(token, false, "Mudei de ideia");
    expect(error?.code).toBe("P0002");
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "aprovado" });
    expect(await respostas(orcamento)).toHaveLength(1);
  });

  it("anulado por edição: não encontrado", async () => {
    const { orcamento, token } = await osEnviada();
    await a.supabase.from("orcamento_itens").delete().eq("orcamento_id", orcamento).eq("tipo", "mao_de_obra");
    await falhaGenerica(token);
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "rascunho" });
    expect(await respostas(orcamento)).toHaveLength(0);
  });

  it("anulado por reenvio: o link antigo falha e o novo funciona", async () => {
    const { ordem, token } = await osEnviada();
    const novo = await a.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
    await falhaGenerica(token);
    expect((await responder(novo.data as string, true)).error).toBeNull();
  });

  it("duas respostas ao mesmo tempo: só uma dá certo e só uma linha no histórico", async () => {
    const { orcamento, token } = await osEnviada();
    const resultados = await Promise.all([
      responder(token, true),
      responder(token, false, "Caro"),
      responder(token, true),
    ]);
    expect(resultados.filter((r) => r.error === null)).toHaveLength(1);
    expect(resultados.filter((r) => r.error?.code === "P0002")).toHaveLength(2);
    expect(await respostas(orcamento)).toHaveLength(1);
  });

  it("o histórico guarda os itens do momento, mesmo depois de editar", async () => {
    const { orcamento, token } = await osEnviada();
    await responder(token, true);
    await a.supabase.from("orcamento_itens").update({ quantidade: 4 }).eq("orcamento_id", orcamento).eq("tipo", "peca");
    const [hist] = await respostas(orcamento);
    expect(hist.total_centavos).toBe(TOTAL);
    expect(hist.itens).toContainEqual(expect.objectContaining({ descricao: "Pastilha de freio", quantidade: 2 }));
  });
});

describe("permissões", () => {
  it("anônimo continua sem acesso direto às tabelas do orçamento", async () => {
    const { orcamento } = await osEnviada();
    const anon = clienteAnonimo();
    for (const tabela of ["orcamentos", "orcamento_itens", "orcamento_respostas"]) {
      const { error } = await anon.from(tabela).select("*").limit(1);
      expect(error?.code, tabela).toBe("42501");
    }
    const upd = await anon.from("orcamentos").update({ estado: "aprovado" }).eq("id", orcamento);
    expect(upd.error?.code).toBe("42501");
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "enviado" });
  });

  it("usuário logado não responde pela API (função é só para anônimo)", async () => {
    const { orcamento, token } = await osEnviada();
    const { error } = await a.supabase.rpc("responder_orcamento", { token, aprovar: true, motivo: null });
    expect(error?.code).toBe("42501");
    expect(await lerOrcamento(orcamento)).toMatchObject({ estado: "enviado" });
  });
});

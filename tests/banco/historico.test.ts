import { beforeAll, describe, expect, it } from "vitest";
import { filtroBusca, termoBusca } from "@/lib/historico";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "./usuarios";

// Ticket 14: histórico das OS fechadas. Coluna cancelada_em (gravada pela
// mudar_status) e view historico_ordens (RLS de quem lê, valor aprovado).

let a: UsuarioComOficina;
let b: UsuarioComOficina;

let sequencia = 4000;
const placaNova = () => `HIS${sequencia++}`;

// 2 × R$ 89,90 + 1 × R$ 150,00 = R$ 329,80.
const ITENS = [
  { tipo: "peca", descricao: "Pastilha de freio", quantidade: 2, valor_unitario_centavos: 8990 },
  { tipo: "mao_de_obra", descricao: "Troca das pastilhas", quantidade: 1, valor_unitario_centavos: 15000 },
];
const TOTAL = 32980;

async function abrirOrdem(u: UsuarioComOficina, placa = placaNova(), nome = "João da Silva") {
  const { data, error } = await u.supabase.rpc("criar_ordem", {
    placa,
    modelo: "Gol 1.0",
    nome,
    // Telefone novo a cada OS: o mesmo telefone reaproveitaria o cliente (e o nome).
    telefone: `4799990${sequencia++}`,
    problema: "Barulho no freio",
    km: 120300,
  });
  if (error) throw new Error(`criar_ordem: ${error.message}`);
  return data as string;
}

async function mudar(u: UsuarioComOficina, ordem_id: string, ...passos: string[]) {
  for (const novo_status of passos) {
    const { error } = await u.supabase.rpc("mudar_status", { ordem_id, novo_status });
    if (error) throw new Error(`mudar_status ${novo_status}: ${error.message}`);
  }
}

const entregar = (u: UsuarioComOficina, id: string) => mudar(u, id, "em_servico", "pronto", "entregue");

// Itens + envio + resposta do cliente pelo link.
async function responderOrcamento(u: UsuarioComOficina, ordem: string, aprovar: boolean) {
  const orc = await u.supabase.from("orcamentos").select("id").eq("ordem_id", ordem).single();
  if (orc.error) throw new Error(`select orcamentos: ${orc.error.message}`);
  for (const item of ITENS) {
    const ins = await u.supabase.from("orcamento_itens").insert({ orcamento_id: orc.data.id, ...item });
    if (ins.error) throw new Error(`insert orcamento_itens: ${ins.error.message}`);
  }
  const token = await u.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
  if (token.error) throw new Error(`enviar_orcamento: ${token.error.message}`);
  const r = await clienteAnonimo().rpc("responder_orcamento", {
    token: token.data,
    aprovar,
    motivo: aprovar ? null : "Muito caro",
  });
  if (r.error) throw new Error(`responder_orcamento: ${r.error.message}`);
}

async function linhaHistorico(u: UsuarioComOficina, id: string) {
  const { data, error } = await u.supabase.from("historico_ordens").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`select historico_ordens: ${error.message}`);
  return data;
}

beforeAll(async () => {
  a = await criarUsuarioComOficina("hist-a");
  b = await criarUsuarioComOficina("hist-b");
});

describe("cancelada_em", () => {
  it("cancelar grava cancelada_em; entregar não", async () => {
    const cancelada = await abrirOrdem(a);
    const antes = Date.now();
    await mudar(a, cancelada, "em_servico", "cancelada");
    const entregue = await abrirOrdem(a);
    await entregar(a, entregue);

    const { data } = await a.supabase
      .from("ordens")
      .select("id, cancelada_em, entregue_em")
      .in("id", [cancelada, entregue]);
    const c = data!.find((o) => o.id === cancelada)!;
    const e = data!.find((o) => o.id === entregue)!;
    expect(new Date(c.cancelada_em).getTime()).toBeGreaterThanOrEqual(antes - 5000);
    expect(c.entregue_em).toBeNull();
    expect(e.cancelada_em).toBeNull();
    expect(e.entregue_em).not.toBeNull();
  });

  it("OS aberta não tem cancelada_em", async () => {
    const id = await abrirOrdem(a);
    const { data } = await a.supabase.from("ordens").select("cancelada_em").eq("id", id).single();
    expect(data!.cancelada_em).toBeNull();
  });

  it("o usuário não consegue alterar cancelada_em direto", async () => {
    const id = await abrirOrdem(a);
    await mudar(a, id, "cancelada");
    const { error } = await a.supabase
      .from("ordens")
      .update({ cancelada_em: "2020-01-01T00:00:00Z" })
      .eq("id", id);
    expect(error?.code).toBe("42501");

    const aberta = await abrirOrdem(a);
    const marcar = await a.supabase
      .from("ordens")
      .update({ cancelada_em: new Date().toISOString() })
      .eq("id", aberta);
    expect(marcar.error?.code).toBe("42501");
  });
});

describe("historico_ordens", () => {
  it("mostra só OS fechadas, com data de fechamento, km, carro e cliente", async () => {
    const entregue = await abrirOrdem(a, undefined, "Maria Souza");
    await entregar(a, entregue);
    const cancelada = await abrirOrdem(a);
    await mudar(a, cancelada, "cancelada");
    const aberta = await abrirOrdem(a);

    const { data: os } = await a.supabase
      .from("ordens")
      .select("numero, entregue_em, veiculos(placa)")
      .eq("id", entregue)
      .single();
    expect(await linhaHistorico(a, entregue)).toEqual({
      id: entregue,
      numero: os!.numero,
      status: "entregue",
      fechada_em: os!.entregue_em,
      km: 120300,
      placa: (os!.veiculos as unknown as { placa: string }).placa,
      modelo: "Gol 1.0",
      cliente: "Maria Souza",
      valor_centavos: null,
    });

    const { data: c } = await a.supabase.from("ordens").select("cancelada_em").eq("id", cancelada).single();
    expect((await linhaHistorico(a, cancelada))?.fechada_em).toBe(c!.cancelada_em);
    expect(await linhaHistorico(a, aberta)).toBeNull();
  });

  it("só mostra OS da oficina do usuário", async () => {
    const id = await abrirOrdem(a);
    await entregar(a, id);
    expect(await linhaHistorico(b, id)).toBeNull();

    const { data } = await b.supabase.from("historico_ordens").select("id");
    expect(data).toEqual([]);
  });

  it("anônimo não lê nada", async () => {
    const { data, error } = await clienteAnonimo().from("historico_ordens").select("*");
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("valor = total da resposta de aprovação", async () => {
    const id = await abrirOrdem(a);
    await responderOrcamento(a, id, true);
    await entregar(a, id);
    expect((await linhaHistorico(a, id))?.valor_centavos).toBe(TOTAL);
  });

  it("orçamento recusado: sem valor", async () => {
    const id = await abrirOrdem(a);
    await responderOrcamento(a, id, false);
    await mudar(a, id, "cancelada");
    expect((await linhaHistorico(a, id))?.valor_centavos).toBeNull();
  });

  it("orçamento aprovado e mexido depois: continua o valor que o cliente aceitou", async () => {
    const id = await abrirOrdem(a);
    await responderOrcamento(a, id, true);
    const orc = await a.supabase.from("orcamentos").select("id").eq("ordem_id", id).single();
    const ins = await a.supabase
      .from("orcamento_itens")
      .insert({ orcamento_id: orc.data!.id, ...ITENS[0], descricao: "Fluido de freio" });
    expect(ins.error).toBeNull();
    await entregar(a, id);
    expect((await linhaHistorico(a, id))?.valor_centavos).toBe(TOTAL);
  });

  it("aprovado, reenviado e recusado: vale a última resposta (sem valor)", async () => {
    const id = await abrirOrdem(a);
    await responderOrcamento(a, id, true);
    await responderOrcamento(a, id, false);
    await mudar(a, id, "cancelada");
    expect((await linhaHistorico(a, id))?.valor_centavos).toBeNull();
  });
});

describe("busca (filtro da tela na view)", () => {
  let antiga: string;
  let mercosul: string;
  let dAvila: string;

  // Mesmo filtro da tela: termoBusca + filtroBusca.
  async function buscar(texto: string) {
    const termo = termoBusca(texto);
    if (!termo) throw new Error(`termo vazio: ${texto}`);
    const { data, error } = await a.supabase.from("historico_ordens").select("id").or(filtroBusca(termo));
    if (error) throw new Error(`busca "${texto}": ${error.message}`);
    return data.map((o) => o.id);
  }

  beforeAll(async () => {
    antiga = await abrirOrdem(a, "BSC1234", "Rosângela Pereira");
    await entregar(a, antiga);
    mercosul = await abrirOrdem(a, "BSC1D23", "Carlos Lima");
    await mudar(a, mercosul, "cancelada");
    dAvila = await abrirOrdem(a, "BSC5678", "Ana D'Ávila, Jr.");
    await entregar(a, dAvila);
  });

  it("placa com ou sem hífen, maiúscula ou não", async () => {
    expect(await buscar("BSC-1234")).toEqual([antiga]);
    expect(await buscar("bsc1234")).toEqual([antiga]);
    expect(await buscar("bsc1d")).toEqual([mercosul]);
  });

  it("parte do nome, sem diferenciar maiúscula", async () => {
    expect(await buscar("rosângela")).toEqual([antiga]);
    expect(await buscar("LIMA")).toEqual([mercosul]);
    expect(await buscar("d'ávila")).toEqual([dAvila]);
  });

  it("caracteres especiais não quebram o filtro", async () => {
    expect(await buscar("lima,(x)")).toEqual([]);
    expect(await buscar("li*ma")).toEqual([mercosul]);
  });

  it("não acha OS de outra oficina", async () => {
    const termo = termoBusca("rosângela")!;
    const { data } = await b.supabase.from("historico_ordens").select("id").or(filtroBusca(termo));
    expect(data).toEqual([]);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "./usuarios";

// Ticket 15: km de entrada obrigatória (prova da garantia das peças) e nível
// do tanque na chegada.

let a: UsuarioComOficina;

let sequencia = 5000;
const placaNova = () => `KMT${sequencia++}`;

const criar = (extra: Record<string, unknown> = {}) =>
  a.supabase.rpc("criar_ordem", {
    placa: placaNova(),
    modelo: "Gol 1.0",
    nome: "João da Silva",
    telefone: "47911112222",
    problema: "Barulho no freio",
    km: 120300,
    ...extra,
  });

async function osNova(extra: Record<string, unknown> = {}) {
  const { data, error } = await criar(extra);
  if (error) throw new Error(`criar_ordem: ${error.code} ${error.message}`);
  return data as string;
}

async function lerOs(id: string) {
  const { data, error } = await a.supabase.from("ordens").select("km, tanque").eq("id", id).single();
  if (error) throw new Error(`select ordens: ${error.message}`);
  return data;
}

const mudar = (id: string, campos: Record<string, unknown>) => a.supabase.from("ordens").update(campos).eq("id", id);

async function adicionarItem(ordem: string) {
  const orc = await a.supabase.from("orcamentos").select("id").eq("ordem_id", ordem).single();
  if (orc.error) throw new Error(`select orcamentos: ${orc.error.message}`);
  const ins = await a.supabase.from("orcamento_itens").insert({
    orcamento_id: orc.data.id,
    tipo: "peca",
    descricao: "Pastilha de freio",
    quantidade: 1,
    valor_unitario_centavos: 8990,
  });
  if (ins.error) throw new Error(`insert orcamento_itens: ${ins.error.message}`);
  return orc.data.id as string;
}

async function enviar(ordem: string) {
  const { data, error } = await a.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
  if (error) throw new Error(`enviar_orcamento: ${error.message}`);
  return data as string;
}

async function preCadastroPendente() {
  const { data: oficina } = await a.supabase.from("oficinas").select("codigo_publico").single();
  const placa = placaNova();
  const envio = await clienteAnonimo().rpc("enviar_pre_cadastro", {
    codigo: oficina!.codigo_publico,
    nome: "Maria Souza",
    telefone: "47933334444",
    placa,
    modelo: "Onix 1.4",
    problema: "Luz do óleo acesa",
  });
  if (envio.error) throw new Error(`enviar_pre_cadastro: ${envio.error.message}`);
  const { data } = await a.supabase.from("pre_cadastros").select("id").eq("placa", placa).single();
  return data!.id as string;
}

beforeAll(async () => {
  a = await criarUsuarioComOficina("kmt");
});

describe("km obrigatória", () => {
  it("criar_ordem sem km ou com km null dá OS005", async () => {
    const semKm = await a.supabase.rpc("criar_ordem", {
      placa: placaNova(),
      modelo: "Gol 1.0",
      nome: "João da Silva",
      telefone: "47911112222",
      problema: "Barulho no freio",
    });
    expect(semKm.error?.code).toBe("OS005");
    expect((await criar({ km: null })).error?.code).toBe("OS005");
  });

  it("confirmar pré-cadastro sem km dá OS005 e ele continua pendente", async () => {
    const id = await preCadastroPendente();
    const { error } = await a.supabase.rpc("confirmar_pre_cadastro", { id, trocar_dono: null });
    expect(error?.code).toBe("OS005");
    const { data } = await a.supabase.from("pre_cadastros").select("situacao").eq("id", id).single();
    expect(data?.situacao).toBe("pendente");
  });

  it("confirmar pré-cadastro grava km e tanque", async () => {
    const id = await preCadastroPendente();
    const { data: ordem, error } = await a.supabase.rpc("confirmar_pre_cadastro", {
      id,
      trocar_dono: null,
      km: 98765,
      tanque: "3/4",
    });
    expect(error).toBeNull();
    expect(await lerOs(ordem as string)).toEqual({ km: 98765, tanque: "3/4" });
  });

  it("não dá para apagar a km de uma OS", async () => {
    const id = await osNova();
    expect((await mudar(id, { km: null })).error?.code).toBe("OS005");
    expect((await lerOs(id)).km).toBe(120300);
  });
});

describe("tanque", () => {
  it("é opcional e aceita as 5 opções", async () => {
    expect((await lerOs(await osNova())).tanque).toBeNull();
    for (const tanque of ["reserva", "1/4", "1/2", "3/4", "cheio"]) {
      expect((await lerOs(await osNova({ tanque }))).tanque).toBe(tanque);
    }
  });

  it("fora das 5 opções dá erro", async () => {
    expect((await criar({ tanque: "meio" })).error?.code).toBe("23514");
    const id = await osNova();
    expect((await mudar(id, { tanque: "" })).error?.code).toBe("23514");
  });

  it("pode ser anotado depois, mesmo com o orçamento enviado", async () => {
    const id = await osNova();
    await adicionarItem(id);
    await enviar(id);
    expect((await mudar(id, { tanque: "1/2" })).error).toBeNull();
    expect((await lerOs(id)).tanque).toBe("1/2");
  });

  it("OS fechada: tanque e km não mudam (OS007)", async () => {
    const id = await osNova({ tanque: "cheio" });
    expect((await a.supabase.rpc("mudar_status", { ordem_id: id, novo_status: "cancelada" })).error).toBeNull();
    expect((await mudar(id, { tanque: "1/4" })).error?.code).toBe("OS007");
    expect((await mudar(id, { km: 1 })).error?.code).toBe("OS007");
    expect(await lerOs(id)).toEqual({ km: 120300, tanque: "cheio" });
  });
});

describe("km travada depois do envio do orçamento", () => {
  it("antes de enviar, corrige; depois, OS006", async () => {
    const id = await osNova();
    expect((await mudar(id, { km: 120400 })).error).toBeNull();
    await adicionarItem(id);
    expect((await mudar(id, { km: 120500 })).error).toBeNull();

    await enviar(id);
    expect((await mudar(id, { km: 120600 })).error?.code).toBe("OS006");
    expect((await lerOs(id)).km).toBe(120500);
  });

  it("continua travada se o orçamento voltar para rascunho", async () => {
    const id = await osNova();
    await adicionarItem(id);
    await enviar(id);
    await adicionarItem(id); // volta para rascunho
    const { data } = await a.supabase.from("orcamentos").select("estado").eq("ordem_id", id).single();
    expect(data?.estado).toBe("rascunho");
    expect((await mudar(id, { km: 1 })).error?.code).toBe("OS006");
  });

  it("salvar a mesma km não conta como mudança", async () => {
    const id = await osNova();
    await adicionarItem(id);
    await enviar(id);
    expect((await mudar(id, { km: 120300, tanque: "reserva" })).error).toBeNull();
  });
});

describe("resposta do cliente guarda a km", () => {
  it("orcamento_respostas.km = km da OS no momento da resposta", async () => {
    const id = await osNova({ km: 77777 });
    const orcamento = await adicionarItem(id);
    const token = await enviar(id);

    const ver = await clienteAnonimo().rpc("ver_orcamento", { token });
    expect(ver.data?.km).toBe(77777);

    const resp = await clienteAnonimo().rpc("responder_orcamento", { token, aprovar: true, motivo: null });
    expect(resp.error).toBeNull();
    const { data } = await a.supabase.from("orcamento_respostas").select("km").eq("orcamento_id", orcamento).single();
    expect(data?.km).toBe(77777);
  });

});

describe("insert direto na tabela", () => {
  it("OS sem km também é recusada (OS005)", async () => {
    // Fecha uma OS para o carro ficar livre e tenta abrir outra sem a função.
    const id = await osNova();
    await a.supabase.rpc("mudar_status", { ordem_id: id, novo_status: "cancelada" });
    const { data: os } = await a.supabase.from("ordens").select("veiculo_id, cliente_id").eq("id", id).single();
    const { error } = await a.supabase.from("ordens").insert({ ...os, problema: "Revisão" });
    expect(error?.code).toBe("OS005");
  });
});

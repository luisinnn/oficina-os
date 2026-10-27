import { beforeAll, describe, expect, it } from "vitest";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "./usuarios";

// Ticket 03: clientes, veículos e OS. Regras que o banco garante sozinho
// (numeração, 1 OS aberta por carro, tudo da mesma oficina) e o RLS entre
// a oficina de A e a de B.

let a: UsuarioComOficina;
let b: UsuarioComOficina;
// Dados de B, que A vai tentar ler e mexer.
let clienteB: string;
let veiculoB: string;
let ordemB: string;

async function novoCliente(u: UsuarioComOficina, nome = "Cliente Teste", telefone = "47988887777") {
  const { data, error } = await u.supabase.from("clientes").insert({ nome, telefone }).select("id").single();
  if (error) throw new Error(`insert clientes: ${error.message}`);
  return data.id as string;
}

async function novoVeiculo(u: UsuarioComOficina, cliente_id: string, placa: string, modelo = "Gol 1.0") {
  const { data, error } = await u.supabase
    .from("veiculos")
    .insert({ placa, modelo, cliente_id })
    .select("id")
    .single();
  if (error) throw new Error(`insert veiculos: ${error.message}`);
  return data.id as string;
}

function inserirOrdem(u: UsuarioComOficina, ordem: Record<string, unknown>) {
  return u.supabase
    .from("ordens")
    .insert({ problema: "Barulho no freio", ...ordem })
    .select("*")
    .single();
}

async function novaOrdem(u: UsuarioComOficina, veiculo_id: string, cliente_id: string) {
  const { data, error } = await inserirOrdem(u, { veiculo_id, cliente_id });
  if (error) throw new Error(`insert ordens: ${error.message}`);
  return data;
}

async function proximoNumero(u: UsuarioComOficina) {
  const { data } = await u.supabase.from("oficinas").select("proximo_numero_os").single();
  return data?.proximo_numero_os as number;
}

// Placas diferentes para os testes que criam vários carros.
let sequencia = 1000;
const placaNova = () => `ZZZ${sequencia++}`;

// Carro novo de um cliente novo, pronto para receber OS.
async function novoCarro(u: UsuarioComOficina, placa: string) {
  const cliente = await novoCliente(u);
  return { cliente, veiculo: await novoVeiculo(u, cliente, placa) };
}

beforeAll(async () => {
  a = await criarUsuarioComOficina("a");
  b = await criarUsuarioComOficina("b");
  ({ cliente: clienteB, veiculo: veiculoB } = await novoCarro(b, "BBB1B11"));
  ordemB = (await novaOrdem(b, veiculoB, clienteB)).id;
});

describe("numeração da OS", () => {
  it("é sequencial por oficina: A recebe #1 e #2, e a primeira de B foi #1", async () => {
    const c1 = await novoCarro(a, "AAA1111");
    const c2 = await novoCarro(a, "AAA2222");
    expect((await novaOrdem(a, c1.veiculo, c1.cliente)).numero).toBe(1);
    expect((await novaOrdem(a, c2.veiculo, c2.cliente)).numero).toBe(2);

    const { data } = await b.supabase.from("ordens").select("numero").eq("id", ordemB).single();
    expect(data?.numero).toBe(1);
  });

  it("não repete número com várias OS ao mesmo tempo", async () => {
    const proximo = await proximoNumero(a);
    const carros = await Promise.all(["AAA3A01", "AAA3A02", "AAA3A03", "AAA3A04", "AAA3A05"].map((p) => novoCarro(a, p)));
    const ordens = await Promise.all(carros.map((c) => novaOrdem(a, c.veiculo, c.cliente)));
    const numeros = ordens.map((o) => o.numero as number).sort((x, y) => x - y);
    expect(numeros).toEqual([0, 1, 2, 3, 4].map((i) => proximo + i));
    expect(await proximoNumero(a)).toBe(proximo + 5);
  });

  it("uma OS recusada não gasta número", async () => {
    const c = await novoCarro(a, "AAA4444");
    const antes = await proximoNumero(a);
    const { error } = await inserirOrdem(a, { veiculo_id: c.veiculo, cliente_id: c.cliente, problema: "" });
    expect(error).not.toBeNull();
    expect(await proximoNumero(a)).toBe(antes);
    expect((await novaOrdem(a, c.veiculo, c.cliente)).numero).toBe(antes);
  });
});

describe("uma OS aberta por carro", () => {
  it("a 2ª OS aberta para o mesmo carro falha no banco", async () => {
    const c = await novoCarro(a, "AAA5555");
    await novaOrdem(a, c.veiculo, c.cliente);
    const { error } = await inserirOrdem(a, { veiculo_id: c.veiculo, cliente_id: c.cliente });
    expect(error?.code).toBe("23505"); // unique violation
  });
});

describe("tudo da mesma oficina", () => {
  it("OS apontando para veículo de outra oficina falha", async () => {
    const clienteA = await novoCliente(a);
    const { error } = await inserirOrdem(a, { veiculo_id: veiculoB, cliente_id: clienteA });
    expect(error).not.toBeNull();
  });

  it("OS apontando para cliente de outra oficina falha", async () => {
    const c = await novoCarro(a, "AAA6666");
    const { error } = await inserirOrdem(a, { veiculo_id: c.veiculo, cliente_id: clienteB });
    expect(error).not.toBeNull();
  });

  it("veículo com dono de outra oficina falha, no insert e no update", async () => {
    const { error } = await a.supabase
      .from("veiculos")
      .insert({ placa: "AAA7777", modelo: "Uno", cliente_id: clienteB });
    expect(error).not.toBeNull();

    const c = await novoCarro(a, "AAA7778");
    const troca = await a.supabase.from("veiculos").update({ cliente_id: clienteB }).eq("id", c.veiculo);
    expect(troca.error).not.toBeNull();
  });

  it("A não grava com oficina_id de B", async () => {
    const { error } = await a.supabase
      .from("clientes")
      .insert({ oficina_id: b.oficina, nome: "Infiltrado", telefone: "47988887777" });
    expect(error?.code).toBe("42501");
    expect((await b.supabase.from("clientes").select("id")).data).toEqual([{ id: clienteB }]);
  });

  it("o que A cria fica na oficina de A", async () => {
    const c = await novoCarro(a, "AAA8888");
    const { data } = await a.supabase.from("veiculos").select("oficina_id").eq("id", c.veiculo).single();
    expect(data?.oficina_id).toBe(a.oficina);
  });
});

describe("formatos e limites no banco", () => {
  it("placa só maiúscula sem hífen, antiga ou Mercosul", async () => {
    const cliente = await novoCliente(a);
    for (const placa of ["abc1234", "ABC-1234", "ABC123", "ABC1DD3", ""]) {
      const { error } = await a.supabase.from("veiculos").insert({ placa, modelo: "Uno", cliente_id: cliente });
      expect(error, placa).not.toBeNull();
    }
    await novoVeiculo(a, cliente, "ABC1D23");
  });

  it("placa repetida na mesma oficina falha; em outra oficina pode", async () => {
    const cliente = await novoCliente(a);
    const { error } = await a.supabase
      .from("veiculos")
      .insert({ placa: "AAA1111", modelo: "Outro", cliente_id: cliente });
    expect(error?.code).toBe("23505");
    await novoVeiculo(a, cliente, "BBB1B11"); // a mesma placa do carro de B
  });

  it("cliente: nome 1–100 sem espaço sobrando e telefone só dígitos", async () => {
    for (const [nome, telefone] of [
      ["", "47988887777"],
      [" Ana", "47988887777"],
      ["x".repeat(101), "47988887777"],
      ["Ana", "(47) 98888-7777"],
      ["Ana", "988887777"],
    ]) {
      const { error } = await a.supabase.from("clientes").insert({ nome, telefone });
      expect(error, `${nome.slice(0, 10)} / ${telefone}`).not.toBeNull();
    }
    await novoCliente(a, "x".repeat(100), "4733334444");
  });

  it("veículo: modelo 1–60", async () => {
    const cliente = await novoCliente(a);
    for (const modelo of ["", "x".repeat(61)]) {
      const { error } = await a.supabase.from("veiculos").insert({ placa: "AAA9999", modelo, cliente_id: cliente });
      expect(error, modelo.slice(0, 10)).not.toBeNull();
    }
    await novoVeiculo(a, cliente, "AAA9999", "x".repeat(60));
  });

  it("OS: problema 1–1000, km inteiro ≥ 0, obs interna até 1000", async () => {
    const c = await novoCarro(a, "AAB1111");
    for (const extra of [
      { problema: "" },
      { problema: "x".repeat(1001) },
      { km: -1 },
      { km: 1.5 },
      { obs_interna: "x".repeat(1001) },
      { obs_interna: "" },
    ]) {
      const { error } = await inserirOrdem(a, { veiculo_id: c.veiculo, cliente_id: c.cliente, ...extra });
      expect(error, JSON.stringify(extra).slice(0, 30)).not.toBeNull();
    }
    const { data, error } = await inserirOrdem(a, {
      veiculo_id: c.veiculo,
      cliente_id: c.cliente,
      problema: "x".repeat(1000),
      km: 0,
      obs_interna: "x".repeat(1000),
    });
    expect(error).toBeNull();
    expect(data?.km).toBe(0);
  });

  it("OS nova começa aguardando, de balcão, sem data de entrega", async () => {
    const c = await novoCarro(a, "AAB2222");
    const ordem = await novaOrdem(a, c.veiculo, c.cliente);
    expect(ordem).toMatchObject({ status: "aguardando", origem: "balcao", entregue_em: null, oficina_id: a.oficina });
    expect(ordem.updated_at).toBe(ordem.created_at);
  });
});

describe("colunas protegidas da OS", () => {
  it.each([
    ["status", "entregue"],
    ["origem", "link"],
    ["numero", 999],
    ["entregue_em", new Date().toISOString()],
  ])("A não escolhe %s no insert", async (coluna, valor) => {
    const c = await novoCarro(a, placaNova());
    const { error } = await inserirOrdem(a, { veiculo_id: c.veiculo, cliente_id: c.cliente, [coluna]: valor });
    expect(error?.code).toBe("42501");
  });

  it.each([
    ["status", "entregue"],
    ["origem", "link"],
    ["numero", 999],
    ["oficina_id", "00000000-0000-0000-0000-000000000000"],
    ["veiculo_id", "00000000-0000-0000-0000-000000000000"],
  ])("A não troca %s por update direto", async (coluna, valor) => {
    const c = await novoCarro(a, placaNova());
    const ordem = await novaOrdem(a, c.veiculo, c.cliente);
    const { error } = await a.supabase.from("ordens").update({ [coluna]: valor }).eq("id", ordem.id);
    expect(error?.code).toBe("42501");
  });

  it("A edita problema, km e obs interna, e updated_at anda", async () => {
    const c = await novoCarro(a, "AAE1111");
    const ordem = await novaOrdem(a, c.veiculo, c.cliente);
    const { data, error } = await a.supabase
      .from("ordens")
      .update({ problema: "Troca de óleo", km: 85000, obs_interna: "Cliente pediu óleo sintético" })
      .eq("id", ordem.id)
      .select("problema, km, obs_interna, updated_at")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ problema: "Troca de óleo", km: 85000, obs_interna: "Cliente pediu óleo sintético" });
    expect(new Date(data!.updated_at).getTime()).toBeGreaterThan(new Date(ordem.updated_at).getTime());
  });

  it("A edita nome e telefone do cliente e modelo e dono do veículo, mas não a placa", async () => {
    const c = await novoCarro(a, "AAE2222");
    const outroDono = await novoCliente(a, "Outro Dono");
    expect((await a.supabase.from("clientes").update({ nome: "Novo Nome" }).eq("id", c.cliente)).error).toBeNull();
    expect(
      (await a.supabase.from("veiculos").update({ modelo: "Gol 1.6", cliente_id: outroDono }).eq("id", c.veiculo)).error,
    ).toBeNull();
    const placa = await a.supabase.from("veiculos").update({ placa: "AAE3333" }).eq("id", c.veiculo);
    expect(placa.error?.code).toBe("42501");
  });
});

describe("isolamento: A não enxerga nem mexe nos dados de B", () => {
  const tabelas = () =>
    [
      ["clientes", clienteB],
      ["veiculos", veiculoB],
      ["ordens", ordemB],
    ] as const;

  it("A só lê linhas da própria oficina", async () => {
    for (const [tabela, idB] of tabelas()) {
      const { data, error } = await a.supabase.from(tabela).select("id, oficina_id");
      expect(error, tabela).toBeNull();
      expect(data!.length, tabela).toBeGreaterThan(0);
      expect(data!.every((l) => l.oficina_id === a.oficina), tabela).toBe(true);
      expect((await a.supabase.from(tabela).select("id").eq("id", idB)).data, tabela).toEqual([]);
    }
  });

  it("update de A nos dados de B não afeta nenhuma linha", async () => {
    const mudancas = { clientes: { nome: "Invadido" }, veiculos: { modelo: "Invadido" }, ordens: { problema: "Invadido" } };
    for (const [tabela, idB] of tabelas()) {
      const { data } = await a.supabase.from(tabela).update(mudancas[tabela]).eq("id", idB).select();
      expect(data, tabela).toEqual([]);
    }
    expect((await b.supabase.from("clientes").select("nome").single()).data?.nome).toBe("Cliente Teste");
    expect((await b.supabase.from("veiculos").select("modelo").single()).data?.modelo).toBe("Gol 1.0");
    expect((await b.supabase.from("ordens").select("problema").single()).data?.problema).toBe("Barulho no freio");
  });

  it("ninguém apaga nada (OS se cancela, não se apaga)", async () => {
    for (const [tabela, idB] of tabelas()) {
      const deB = await b.supabase.from(tabela).delete().eq("id", idB);
      expect(deB.error?.code, tabela).toBe("42501");
      expect((await b.supabase.from(tabela).select("id").eq("id", idB)).data, tabela).toEqual([{ id: idB }]);
    }
  });
});

describe("anônimo", () => {
  it.each<[string, Record<string, unknown>]>([
    ["clientes", { nome: "Anônimo", telefone: "47988887777" }],
    ["veiculos", { placa: "ANO1234", modelo: "Uno", cliente_id: "00000000-0000-0000-0000-000000000000" }],
    ["ordens", { problema: "x", veiculo_id: "00000000-0000-0000-0000-000000000000" }],
  ])("não lê nem grava em %s", async (tabela, linha) => {
    const anon = clienteAnonimo();
    const leitura = await anon.from(tabela).select("*");
    expect(leitura.data).toBeNull();
    expect(leitura.error?.code).toBe("42501");
    const escrita = await anon.from(tabela).insert(linha);
    expect(escrita.error?.code).toBe("42501");
  });
});

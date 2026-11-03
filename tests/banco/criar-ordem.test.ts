import { beforeAll, describe, expect, it } from "vitest";
import {
  clienteAnonimo,
  criarUsuarioComOficina,
  criarUsuarioConfirmado,
  type UsuarioComOficina,
} from "./usuarios";

// Ticket 04: função criar_ordem, que abre a OS do balcão numa transação só
// (cliente + veículo + OS) e decide o dono do carro.

let a: UsuarioComOficina;
let b: UsuarioComOficina;

let sequencia = 1000;
const placaNova = () => `CRD${sequencia++}`;
let telefones = 47900000000;
const telefoneNovo = () => String(telefones++);

type Params = {
  placa: string;
  modelo?: string;
  nome?: string;
  telefone?: string;
  problema?: string;
  km?: number | null;
  obs_interna?: string | null;
  trocar_dono?: boolean | null;
};

function criarOrdem(u: { supabase: UsuarioComOficina["supabase"] }, p: Params) {
  return u.supabase.rpc("criar_ordem", {
    modelo: "Gol 1.0",
    nome: "João da Silva",
    telefone: "47911112222",
    problema: "Barulho no freio",
    km: 50000,
    ...p,
  });
}

async function ordemCriada(u: UsuarioComOficina, p: Params) {
  const { data, error } = await criarOrdem(u, p);
  if (error) throw new Error(`criar_ordem: ${error.code} ${error.message}`);
  return lerOrdem(u, data as string);
}

async function lerOrdem(u: UsuarioComOficina, id: string) {
  const { data, error } = await u.supabase
    .from("ordens")
    .select("*, veiculos(id, placa, modelo, cliente_id), clientes(id, nome, telefone)")
    .eq("id", id)
    .single();
  if (error) throw new Error(`ler ordem: ${error.message}`);
  return data;
}

async function veiculo(u: UsuarioComOficina, placa: string) {
  const { data } = await u.supabase.from("veiculos").select("*, clientes(nome, telefone)").eq("placa", placa).maybeSingle();
  return data;
}

async function contar(u: UsuarioComOficina, tabela: string) {
  const { count } = await u.supabase.from(tabela).select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function proximoNumero(u: UsuarioComOficina) {
  const { data } = await u.supabase.from("oficinas").select("proximo_numero_os").single();
  return data?.proximo_numero_os as number;
}

// Carro de A que já tem OS aberta.
let placaComOsAberta: string;
let ordemAberta: string;

beforeAll(async () => {
  a = await criarUsuarioComOficina("ca");
  b = await criarUsuarioComOficina("cb");
  placaComOsAberta = placaNova();
  ordemAberta = (await ordemCriada(a, { placa: placaComOsAberta })).id;
});

describe("placa nova", () => {
  it("cria cliente, veículo e OS de uma vez", async () => {
    const placa = placaNova();
    const telefone = telefoneNovo();
    const antes = await proximoNumero(a);

    const os = await ordemCriada(a, {
      placa,
      modelo: "Onix",
      nome: "Maria",
      telefone,
      problema: "Troca de óleo",
      km: 120000,
      obs_interna: "Cliente com pressa",
    });

    expect(os).toMatchObject({
      numero: antes,
      status: "aguardando",
      origem: "balcao",
      problema: "Troca de óleo",
      km: 120000,
      obs_interna: "Cliente com pressa",
      oficina_id: a.oficina,
      veiculos: { placa, modelo: "Onix" },
      clientes: { nome: "Maria", telefone },
    });
    // O carro fica com o cliente da OS como dono.
    expect(os.veiculos.cliente_id).toBe(os.cliente_id);
  });

  it("reaproveita o cliente que já tem o mesmo telefone, sem renomear", async () => {
    const telefone = telefoneNovo();
    const primeira = await ordemCriada(a, { placa: placaNova(), nome: "Zé", telefone });
    const clientes = await contar(a, "clientes");

    const segunda = await ordemCriada(a, { placa: placaNova(), nome: "José Souza", telefone });

    expect(segunda.cliente_id).toBe(primeira.cliente_id);
    expect(segunda.clientes.nome).toBe("Zé");
    expect(await contar(a, "clientes")).toBe(clientes);
  });

  it("é tudo ou nada: se a OS falha, cliente e veículo não ficam gravados", async () => {
    const placa = placaNova();
    const clientes = await contar(a, "clientes");

    const { error } = await criarOrdem(a, { placa, telefone: telefoneNovo(), problema: "" });

    expect(error?.code).toBe("23514");
    expect(await veiculo(a, placa)).toBeNull();
    expect(await contar(a, "clientes")).toBe(clientes);
  });

  it("a mesma placa em outra oficina é carro novo (B não vê nem muda o de A)", async () => {
    const placa = placaNova();
    const osA = await ordemCriada(a, { placa, nome: "Dono em A", telefone: telefoneNovo() });

    const osB = await ordemCriada(b, { placa, nome: "Dono em B", telefone: telefoneNovo() });

    expect(osB.veiculo_id).not.toBe(osA.veiculo_id);
    expect(osB.oficina_id).toBe(b.oficina);
    expect((await veiculo(a, placa))?.clientes.nome).toBe("Dono em A");
  });
});

describe("placa existente", () => {
  // Carro já cadastrado e sem OS aberta. Vai direto nas tabelas: se viesse de
  // criar_ordem, já teria uma OS aberta (e ainda não dá para fechar, ticket 05).
  async function carroSemOs(nome = "Dono Atual", telefone = telefoneNovo()) {
    const placa = placaNova();
    const cliente = await a.supabase.from("clientes").insert({ nome, telefone }).select("id").single();
    const carro = await a.supabase
      .from("veiculos")
      .insert({ placa, modelo: "Gol 1.0", cliente_id: cliente.data?.id })
      .select("id")
      .single();
    if (cliente.error || carro.error) throw new Error("não criou o carro de teste");
    return { placa, telefone, cliente: cliente.data.id as string, veiculo: carro.data.id as string };
  }

  it("mesmo nome e telefone do dono: usa o dono sem perguntar e atualiza o modelo", async () => {
    const carro = await carroSemOs("João Silva");
    const clientes = await contar(a, "clientes");

    const os = await ordemCriada(a, {
      placa: carro.placa,
      modelo: "Gol 1.6",
      nome: "João Silva",
      telefone: carro.telefone,
    });

    expect(os.veiculo_id).toBe(carro.veiculo);
    expect(os.cliente_id).toBe(carro.cliente);
    expect(os.veiculos.modelo).toBe("Gol 1.6");
    expect(await contar(a, "clientes")).toBe(clientes);
  });

  it.each([
    ["outro telefone", "Dono Atual", false],
    ["outro nome com o mesmo telefone", "Outra Pessoa", true],
  ])("%s sem resposta: recusa com OS002 e não grava nada", async (_caso, nome, mesmoTelefone) => {
    const carro = await carroSemOs("Dono Atual");
    const antes = await proximoNumero(a);
    const clientes = await contar(a, "clientes");

    const { error } = await criarOrdem(a, {
      placa: carro.placa,
      modelo: "Outro Modelo",
      nome,
      telefone: mesmoTelefone ? carro.telefone : telefoneNovo(),
    });

    expect(error?.code).toBe("OS002");
    expect(await proximoNumero(a)).toBe(antes);
    expect(await contar(a, "clientes")).toBe(clientes);
    expect(await veiculo(a, carro.placa)).toMatchObject({ modelo: "Gol 1.0", clientes: { nome: "Dono Atual" } });
  });

  it("trocar_dono = false: mantém o dono sem mexer no cadastro dele (só o modelo muda)", async () => {
    const carro = await carroSemOs("Dono Atual");
    const clientes = await contar(a, "clientes");

    const os = await ordemCriada(a, {
      placa: carro.placa,
      modelo: "Outro Modelo",
      nome: "Outra Pessoa",
      telefone: carro.telefone,
      trocar_dono: false,
    });

    expect(os.cliente_id).toBe(carro.cliente);
    expect(os.clientes.nome).toBe("Dono Atual");
    expect(os.veiculos).toMatchObject({ cliente_id: carro.cliente, modelo: "Outro Modelo" });
    expect(await contar(a, "clientes")).toBe(clientes);
  });

  it("trocar_dono = true com o mesmo telefone do dono: só corrige o nome dele", async () => {
    const carro = await carroSemOs("Joao");
    const clientes = await contar(a, "clientes");

    const os = await ordemCriada(a, { placa: carro.placa, nome: "João Silva", telefone: carro.telefone, trocar_dono: true });

    expect(os.cliente_id).toBe(carro.cliente);
    expect(os.clientes.nome).toBe("João Silva");
    expect(await contar(a, "clientes")).toBe(clientes);
  });

  it("trocar_dono = true com telefone novo: cria o cliente e passa o carro para ele", async () => {
    const carro = await carroSemOs("Dono Antigo");
    const telefone = telefoneNovo();

    const os = await ordemCriada(a, { placa: carro.placa, nome: "Dono Novo", telefone, trocar_dono: true });

    expect(os.cliente_id).not.toBe(carro.cliente);
    expect(os.clientes).toMatchObject({ nome: "Dono Novo", telefone });
    expect(os.veiculos.cliente_id).toBe(os.cliente_id);
    // O dono antigo continua cadastrado.
    const antigo = await a.supabase.from("clientes").select("nome").eq("id", carro.cliente).single();
    expect(antigo.data?.nome).toBe("Dono Antigo");
  });

  it("trocar_dono = true com telefone de cliente que já existe: reaproveita e usa o nome digitado", async () => {
    const outro = await carroSemOs("Cliente Antigo");
    const carro = await carroSemOs("Dono Antigo");

    const os = await ordemCriada(a, {
      placa: carro.placa,
      nome: "Cliente Antigo Souza",
      telefone: outro.telefone,
      trocar_dono: true,
    });

    expect(os.cliente_id).toBe(outro.cliente);
    expect(os.veiculos.cliente_id).toBe(outro.cliente);
    expect(os.clientes.nome).toBe("Cliente Antigo Souza");
  });

  it("OS aberta bloqueia: recusa com OS001, sem gastar número nem trocar dono", async () => {
    const antes = await proximoNumero(a);
    const dono = (await veiculo(a, placaComOsAberta))?.cliente_id;

    const { error } = await criarOrdem(a, {
      placa: placaComOsAberta,
      nome: "Outra Pessoa",
      telefone: telefoneNovo(),
      trocar_dono: true,
    });

    expect(error?.code).toBe("OS001");
    expect(await proximoNumero(a)).toBe(antes);
    expect((await veiculo(a, placaComOsAberta))?.cliente_id).toBe(dono);
    const { count } = await a.supabase
      .from("ordens")
      .select("*", { count: "exact", head: true })
      .eq("veiculo_id", (await lerOrdem(a, ordemAberta)).veiculo_id);
    expect(count).toBe(1);
  });
});

describe("limites", () => {
  it("km acima do teto é recusado pelo banco", async () => {
    const { error } = await criarOrdem(a, { placa: placaNova(), telefone: telefoneNovo(), km: 10_000_000 });
    expect(error?.code).toBe("23514");
  });
});

describe("quem pode chamar", () => {
  it("anônimo não pode", async () => {
    const { error } = await criarOrdem({ supabase: clienteAnonimo() }, { placa: placaNova() });
    expect(error?.code).toBe("42501");
  });

  it("usuário sem oficina não pode", async () => {
    const semOficina = await criarUsuarioConfirmado("semoficina");
    const { error } = await criarOrdem(semOficina, { placa: placaNova() });
    expect(error?.code).toBe("42501");
  });
});

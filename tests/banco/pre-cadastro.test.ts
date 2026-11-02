import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sqlAdmin } from "./admin";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "./usuarios";

// Ticket 09: pré-cadastro público. O cliente (anônimo) manda os dados pelo
// link da oficina (/p/<codigo>); a oficina confirma (vira OS) ou descarta.

let a: UsuarioComOficina;
let b: UsuarioComOficina;

let sequencia = 1000;
const placaNova = () => `PRE${sequencia++}`;

async function codigoDe(u: UsuarioComOficina): Promise<string> {
  const { data, error } = await u.supabase.from("oficinas").select("codigo_publico").single();
  if (error) throw new Error(`select oficinas: ${error.message}`);
  return data.codigo_publico;
}

type Envio = { nome: string; telefone: string; placa: string; modelo: string; problema: string };

const envioPadrao = (extra: Partial<Envio> = {}): Envio => ({
  nome: "Maria Souza",
  telefone: "47933334444",
  placa: placaNova(),
  modelo: "Onix 1.4",
  problema: "Luz do óleo acesa",
  ...extra,
});

const enviar = (codigo: string, dados: Envio) => clienteAnonimo().rpc("enviar_pre_cadastro", { codigo, ...dados });

// Envia pela oficina "u" e devolve o id do pré-cadastro (lido pelo painel).
async function preCadastro(u: UsuarioComOficina, extra: Partial<Envio> = {}) {
  const dados = envioPadrao(extra);
  const { error } = await enviar(await codigoDe(u), dados);
  if (error) throw new Error(`enviar_pre_cadastro: ${error.message}`);
  const lido = await u.supabase.from("pre_cadastros").select("id").eq("placa", dados.placa.toUpperCase().replace(/[\s-]/g, "")).eq("situacao", "pendente").single();
  if (lido.error) throw new Error(`select pre_cadastros: ${lido.error.message}`);
  return { id: lido.data.id as string, dados };
}

async function lerPre(u: UsuarioComOficina, id: string) {
  const { data, error } = await u.supabase.from("pre_cadastros").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`select pre_cadastros: ${error.message}`);
  return data;
}

// Tudo de clientes e veículos da oficina, para comparar antes e depois.
async function cadastro(u: UsuarioComOficina) {
  const cli = await u.supabase.from("clientes").select("*").order("id");
  const vei = await u.supabase.from("veiculos").select("*").order("id");
  if (cli.error || vei.error) throw new Error("select clientes/veiculos");
  return { clientes: cli.data, veiculos: vei.data };
}

// OS de balcão: deixa a placa cadastrada no nome de "João da Silva".
async function osBalcao(u: UsuarioComOficina, placa: string) {
  const { data, error } = await u.supabase.rpc("criar_ordem", {
    placa,
    modelo: "Gol 1.0",
    nome: "João da Silva",
    telefone: "47911112222",
    problema: "Revisão",
  });
  if (error) throw new Error(`criar_ordem: ${error.message}`);
  return data as string;
}

// Fecha a OS (cancelada) para o carro ficar livre para outra.
const cancelar = (ordem: string) =>
  sqlAdmin(`update public.ordens set status = 'cancelada' where id = '${ordem}'`);

// Joga os envios da oficina para 2 horas atrás: o limite por hora não acumula
// entre os testes.
const envelhecer = (u: UsuarioComOficina) =>
  sqlAdmin(`update public.pre_cadastros set created_at = now() - interval '2 hours' where oficina_id = '${u.oficina}'`);

const confirmar = (u: UsuarioComOficina, id: string, trocar_dono: boolean | null = null) =>
  u.supabase.rpc("confirmar_pre_cadastro", { id, trocar_dono });

beforeAll(async () => {
  a = await criarUsuarioComOficina("precad-a");
  b = await criarUsuarioComOficina("precad-b");
});

beforeEach(() => {
  envelhecer(a);
  envelhecer(b);
});

describe("nome_oficina_publico", () => {
  it("devolve só o nome da oficina", async () => {
    const { data, error } = await clienteAnonimo().rpc("nome_oficina_publico", { codigo: await codigoDe(a) });
    expect(error).toBeNull();
    expect(data).toBe("Oficina precad-a");
  });

  it("código inválido: null", async () => {
    for (const codigo of ["", "naoexiste123", "x"]) {
      const { data, error } = await clienteAnonimo().rpc("nome_oficina_publico", { codigo });
      expect(error).toBeNull();
      expect(data).toBeNull();
    }
  });
});

describe("enviar_pre_cadastro", () => {
  it("grava pendente, já normalizado, e devolve só 'ok'", async () => {
    const placa = placaNova();
    const { data, error } = await enviar(await codigoDe(a), {
      nome: "  Maria Souza ",
      telefone: "+55 (47) 93333-4444",
      placa: ` ${placa.slice(0, 3).toLowerCase()}-${placa.slice(3)} `,
      modelo: " Onix 1.4 ",
      problema: " Luz do óleo acesa ",
    });
    expect(error).toBeNull();
    expect(data).toBe("ok");

    const { data: lido } = await a.supabase.from("pre_cadastros").select("*").eq("placa", placa).single();
    expect(lido).toMatchObject({
      oficina_id: a.oficina,
      nome: "Maria Souza",
      telefone: "47933334444",
      placa,
      modelo: "Onix 1.4",
      problema: "Luz do óleo acesa",
      situacao: "pendente",
      ordem_id: null,
    });
  });

  it("vai só para a oficina do código: a outra não enxerga", async () => {
    const { id } = await preCadastro(a);
    expect(await lerPre(b, id)).toBeNull();
  });

  it("código inválido: erro genérico e nada gravado", async () => {
    const dados = envioPadrao();
    for (const codigo of ["", "naoexiste123"]) {
      const { data, error } = await enviar(codigo, dados);
      expect(data).toBeNull();
      expect(error).toMatchObject({ code: "P0002", message: "Link inválido." });
    }
    const { count } = await a.supabase.from("pre_cadastros").select("*", { count: "exact", head: true }).eq("placa", dados.placa);
    expect(count).toBe(0);
  });

  it.each<[string, Partial<Envio>]>([
    ["placa ruim", { placa: "AB12" }],
    ["telefone curto", { telefone: "123" }],
    ["telefone com letra", { telefone: "4799999abcd" }],
    ["nome vazio", { nome: "   " }],
    ["nome grande", { nome: "a".repeat(101) }],
    ["modelo vazio", { modelo: "" }],
    ["modelo grande", { modelo: "a".repeat(61) }],
    ["problema vazio", { problema: " " }],
    ["problema grande", { problema: "a".repeat(1001) }],
  ])("%s: recusa com 22023", async (_caso, extra) => {
    const { error } = await enviar(await codigoDe(a), envioPadrao(extra));
    expect(error?.code).toBe("22023");
  });

  it("nulos: recusa com 22023", async () => {
    const { error } = await clienteAnonimo().rpc("enviar_pre_cadastro", {
      codigo: await codigoDe(a),
      nome: null,
      telefone: null,
      placa: null,
      modelo: null,
      problema: null,
    });
    expect(error?.code).toBe("22023");
  });

  it("2º pendente da mesma placa: recusado; depois de descartar, aceita de novo", async () => {
    const { id, dados } = await preCadastro(a);
    const codigo = await codigoDe(a);

    const segundo = await enviar(codigo, { ...dados, nome: "Outra Pessoa" });
    expect(segundo.error?.code).toBe("PC002");
    const { count } = await a.supabase.from("pre_cadastros").select("*", { count: "exact", head: true }).eq("placa", dados.placa);
    expect(count).toBe(1);

    expect((await a.supabase.rpc("descartar_pre_cadastro", { id })).error).toBeNull();
    expect((await enviar(codigo, dados)).error).toBeNull();
  });

  it("a mesma placa pendente em outra oficina não conta", async () => {
    const { dados } = await preCadastro(a);
    expect((await enviar(await codigoDe(b), dados)).error).toBeNull();
  });

  it("21º envio na mesma hora: recusado; envios de mais de 1 hora não contam", async () => {
    const c = await criarUsuarioComOficina("precad-spam");
    const codigo = await codigoDe(c);
    for (let i = 0; i < 20; i++) {
      const { error } = await enviar(codigo, envioPadrao());
      expect(error, `envio ${i + 1}`).toBeNull();
    }
    const vigesimoPrimeiro = await enviar(codigo, envioPadrao());
    expect(vigesimoPrimeiro.error?.code).toBe("PC001");
    const { count } = await c.supabase.from("pre_cadastros").select("*", { count: "exact", head: true });
    expect(count).toBe(20);

    // Outra oficina não é afetada.
    expect((await enviar(await codigoDe(a), envioPadrao())).error).toBeNull();

    envelhecer(c);
    expect((await enviar(codigo, envioPadrao())).error).toBeNull();
  });

  it("usuário logado não chama pela API (função é só para anônimo)", async () => {
    const { error } = await a.supabase.rpc("enviar_pre_cadastro", { codigo: await codigoDe(a), ...envioPadrao() });
    expect(error?.code).toBe("42501");
  });
});

describe("confirmar_pre_cadastro", () => {
  it("placa nova: cria cliente, veículo e OS #n aguardando com origem link", async () => {
    const { id, dados } = await preCadastro(a);
    const { data: ordem, error } = await confirmar(a, id);
    expect(error).toBeNull();

    const { data: os } = await a.supabase
      .from("ordens")
      .select("numero, status, origem, problema, km, obs_interna, veiculos(placa, modelo), clientes(nome, telefone)")
      .eq("id", ordem)
      .single();
    expect(os).toMatchObject({
      numero: expect.any(Number),
      status: "aguardando",
      origem: "link",
      problema: dados.problema,
      km: null,
      obs_interna: null,
      veiculos: { placa: dados.placa, modelo: dados.modelo },
      clientes: { nome: dados.nome, telefone: dados.telefone },
    });

    expect(await lerPre(a, id)).toMatchObject({ situacao: "confirmado", ordem_id: ordem });
  });

  it("número da OS segue a sequência da oficina", async () => {
    const balcao = await osBalcao(a, placaNova());
    const { data: anterior } = await a.supabase.from("ordens").select("numero").eq("id", balcao).single();
    const { id } = await preCadastro(a);
    const { data: ordem } = await confirmar(a, id);
    const { data: os } = await a.supabase.from("ordens").select("numero").eq("id", ordem).single();
    expect(os!.numero).toBe(anterior!.numero + 1);
  });

  it("telefone já cadastrado e placa nova: reaproveita o cliente sem renomear", async () => {
    await osBalcao(a, placaNova()); // cria "João da Silva" 47911112222
    const { id } = await preCadastro(a, { nome: "Joãozinho", telefone: "47911112222" });
    const { data: ordem, error } = await confirmar(a, id);
    expect(error).toBeNull();
    const { data: os } = await a.supabase.from("ordens").select("clientes(nome)").eq("id", ordem).single();
    expect(os).toMatchObject({ clientes: { nome: "João da Silva" } });
    const { count } = await a.supabase.from("clientes").select("*", { count: "exact", head: true }).eq("telefone", "47911112222");
    expect(count).toBe(1);
  });

  it("placa existente do mesmo dono: OS nele, sem mexer em clientes/veiculos (nem no modelo)", async () => {
    const placa = placaNova();
    cancelar(await osBalcao(a, placa));
    const { id } = await preCadastro(a, { placa, nome: "João da Silva", telefone: "47911112222", modelo: "Gol G5" });
    const antes = await cadastro(a);

    const { data: ordem, error } = await confirmar(a, id);
    expect(error).toBeNull();
    expect(await cadastro(a)).toEqual(antes);
    const { data: os } = await a.supabase.from("ordens").select("origem, clientes(nome)").eq("id", ordem).single();
    expect(os).toMatchObject({ origem: "link", clientes: { nome: "João da Silva" } });
  });

  it("placa de outro dono sem resposta: OS002, nada muda e continua pendente", async () => {
    const placa = placaNova();
    cancelar(await osBalcao(a, placa));
    const { id } = await preCadastro(a, { placa });
    const antes = await cadastro(a);

    const { error } = await confirmar(a, id, null);
    expect(error?.code).toBe("OS002");
    expect(await cadastro(a)).toEqual(antes);
    expect(await lerPre(a, id)).toMatchObject({ situacao: "pendente", ordem_id: null });
  });

  it("placa de outro dono, manter dono: OS no dono atual e clientes/veiculos intactos", async () => {
    const placa = placaNova();
    cancelar(await osBalcao(a, placa));
    const { id } = await preCadastro(a, { placa, modelo: "Gol G5" });
    const antes = await cadastro(a);

    const { data: ordem, error } = await confirmar(a, id, false);
    expect(error).toBeNull();
    expect(await cadastro(a)).toEqual(antes);
    const { data: os } = await a.supabase.from("ordens").select("clientes(nome, telefone)").eq("id", ordem).single();
    expect(os).toMatchObject({ clientes: { nome: "João da Silva", telefone: "47911112222" } });
    expect(await lerPre(a, id)).toMatchObject({ situacao: "confirmado", ordem_id: ordem });
  });

  it("placa de outro dono, trocar dono: carro passa para o cliente do pré-cadastro", async () => {
    const placa = placaNova();
    cancelar(await osBalcao(a, placa));
    const { id, dados } = await preCadastro(a, { placa, telefone: "47955556666", nome: "Ana Lima" });

    const { data: ordem, error } = await confirmar(a, id, true);
    expect(error).toBeNull();
    const { data: carro } = await a.supabase.from("veiculos").select("modelo, clientes(nome, telefone)").eq("placa", placa).single();
    expect(carro).toMatchObject({ modelo: "Gol 1.0", clientes: { nome: "Ana Lima", telefone: dados.telefone } });
    const { data: os } = await a.supabase.from("ordens").select("clientes(nome)").eq("id", ordem).single();
    expect(os).toMatchObject({ clientes: { nome: "Ana Lima" } });
  });

  it("carro com OS aberta: OS001 e continua pendente", async () => {
    const placa = placaNova();
    await osBalcao(a, placa);
    const { id } = await preCadastro(a, { placa });
    const antes = await cadastro(a);

    const { error } = await confirmar(a, id, true);
    expect(error?.code).toBe("OS001");
    expect(await cadastro(a)).toEqual(antes);
    expect(await lerPre(a, id)).toMatchObject({ situacao: "pendente" });
  });

  it("já confirmado ou descartado: não encontrado", async () => {
    const { id } = await preCadastro(a);
    await confirmar(a, id);
    expect((await confirmar(a, id)).error).toMatchObject({ code: "P0002" });

    const outro = await preCadastro(a);
    await a.supabase.rpc("descartar_pre_cadastro", { id: outro.id });
    expect((await confirmar(a, outro.id)).error).toMatchObject({ code: "P0002" });
  });

  it("pré-cadastro de outra oficina: não encontrado e nada muda", async () => {
    const { id } = await preCadastro(a);
    expect((await confirmar(b, id)).error).toMatchObject({ code: "P0002" });
    expect(await lerPre(a, id)).toMatchObject({ situacao: "pendente" });
  });

  it("anônimo não chama", async () => {
    const { id } = await preCadastro(a);
    const { error } = await clienteAnonimo().rpc("confirmar_pre_cadastro", { id, trocar_dono: null });
    expect(error?.code).toBe("42501");
  });
});

describe("descartar_pre_cadastro", () => {
  it("marca descartado; segunda vez: não encontrado", async () => {
    const { id } = await preCadastro(a);
    expect((await a.supabase.rpc("descartar_pre_cadastro", { id })).error).toBeNull();
    expect(await lerPre(a, id)).toMatchObject({ situacao: "descartado", ordem_id: null });
    expect((await a.supabase.rpc("descartar_pre_cadastro", { id })).error).toMatchObject({ code: "P0002" });
  });

  it("de outra oficina: não encontrado e nada muda", async () => {
    const { id } = await preCadastro(a);
    expect((await b.supabase.rpc("descartar_pre_cadastro", { id })).error).toMatchObject({ code: "P0002" });
    expect(await lerPre(a, id)).toMatchObject({ situacao: "pendente" });
  });

  it("anônimo não chama", async () => {
    const { id } = await preCadastro(a);
    const { error } = await clienteAnonimo().rpc("descartar_pre_cadastro", { id });
    expect(error?.code).toBe("42501");
  });
});

describe("trocar_codigo_publico", () => {
  it("gera código novo; o antigo responde erro na hora e o novo funciona", async () => {
    const c = await criarUsuarioComOficina("precad-troca");
    const antigo = await codigoDe(c);

    const { data: novo, error } = await c.supabase.rpc("trocar_codigo_publico");
    expect(error).toBeNull();
    expect(novo).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(novo).not.toBe(antigo);
    expect(await codigoDe(c)).toBe(novo);

    expect((await enviar(antigo, envioPadrao())).error).toMatchObject({ code: "P0002" });
    expect((await clienteAnonimo().rpc("nome_oficina_publico", { codigo: antigo })).data).toBeNull();
    expect((await enviar(novo as string, envioPadrao())).error).toBeNull();
  });

  it("só troca o da própria oficina", async () => {
    const antes = await codigoDe(a);
    await b.supabase.rpc("trocar_codigo_publico");
    expect(await codigoDe(a)).toBe(antes);
  });

  it("anônimo não chama", async () => {
    const { error } = await clienteAnonimo().rpc("trocar_codigo_publico");
    expect(error?.code).toBe("42501");
  });
});

describe("permissões", () => {
  it("anônimo não tem acesso direto à tabela", async () => {
    const anon = clienteAnonimo();
    expect((await anon.from("pre_cadastros").select("*").limit(1)).error?.code).toBe("42501");
    const ins = await anon.from("pre_cadastros").insert({ oficina_id: a.oficina, ...envioPadrao() });
    expect(ins.error?.code).toBe("42501");
  });

  it("usuário logado só lê: não insere nem muda direto", async () => {
    const { id } = await preCadastro(a);
    const ins = await a.supabase.from("pre_cadastros").insert({ ...envioPadrao() });
    expect(ins.error?.code).toBe("42501");
    const upd = await a.supabase.from("pre_cadastros").update({ situacao: "descartado" }).eq("id", id);
    expect(upd.error?.code).toBe("42501");
    const del = await a.supabase.from("pre_cadastros").delete().eq("id", id);
    expect(del.error?.code).toBe("42501");
    expect(await lerPre(a, id)).toMatchObject({ situacao: "pendente" });
  });

  it("usuário logado não troca o código pelo update da oficina", async () => {
    const antes = await codigoDe(a);
    const { error } = await a.supabase.from("oficinas").update({ codigo_publico: "codigoescolhido" }).eq("id", a.oficina);
    expect(error?.code).toBe("42501");
    expect(await codigoDe(a)).toBe(antes);
  });
});

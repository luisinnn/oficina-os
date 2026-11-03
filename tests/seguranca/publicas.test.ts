import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { sqlAdmin } from "../banco/admin";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "../banco/usuarios";
import { montarOficina, osEnviada, type Oficina } from "./cenario";

// Ticket 10: as quatro funções que o anônimo pode chamar só fazem o que
// devem. Link errado, vencido ou anulado não abre nada, e o que volta não
// tem dado que a oficina não quis mostrar.

let a: Oficina;
const anon = clienteAnonimo();

let sequencia = 10;
const placaNova = () => `PUB1A${sequencia++}`;
const novaOsEnviada = () => osEnviada(a.usuario, placaNova(), a);

const ver = (token: string) => anon.rpc("ver_orcamento", { token });
const responder = (token: string, aprovar: boolean) => anon.rpc("responder_orcamento", { token, aprovar });

// Troca um caractere do meio por outro que também vale em base64url.
function mudarUmCaractere(token: string) {
  const i = Math.floor(token.length / 2);
  return token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
}

beforeAll(async () => {
  a = await montarOficina("A");
});

describe("ver_orcamento: link que não vale dá 'não encontrado' (null)", () => {
  it("o link certo funciona (base dos casos abaixo)", async () => {
    const { data, error } = await ver(a.token);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("token aleatório", async () => {
    const { data, error } = await ver(randomBytes(32).toString("base64url"));
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("token de outro orçamento com 1 caractere trocado", async () => {
    const { data, error } = await ver(mudarUmCaractere(a.token));
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("vencido", async () => {
    const os = await novaOsEnviada();
    sqlAdmin(`update public.orcamentos set token_expira_em = now() - interval '1 second' where id = '${os.orcamento}'`);
    expect((await ver(os.token)).data).toBeNull();
  });

  it("anulado por edição do orçamento (volta para rascunho)", async () => {
    const os = await novaOsEnviada();
    const edita = await a.usuario.supabase.from("orcamento_itens").update({ quantidade: 3 }).eq("id", os.item);
    expect(edita.error).toBeNull();
    expect((await ver(os.token)).data).toBeNull();
  });

  it("vazio", async () => {
    expect((await ver("")).data).toBeNull();
  });
});

describe("ver_orcamento: o que volta não tem dado interno", () => {
  it("só os campos da página, sem nome e telefone do cliente, ids ou observação interna", async () => {
    const { data } = await ver(a.token);
    expect(Object.keys(data).sort()).toEqual(
      ["estado", "expirado", "itens", "km", "modelo", "numero", "oficina", "placa", "total_centavos"].sort(),
    );

    const texto = JSON.stringify(data);
    for (const segredo of [a.nomeCliente, "Cliente Secreto", a.telefoneCliente, a.obsInterna, a.codigoPublico]) {
      expect(texto).not.toContain(segredo);
    }
    // Nenhum uuid (id de oficina, OS, orçamento, item, cliente, veículo...).
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("responder_orcamento", () => {
  it("segunda resposta falha e não muda a primeira", async () => {
    const os = await novaOsEnviada();
    expect((await responder(os.token, true)).data).toBe("aprovado");

    const segunda = await responder(os.token, false);
    expect(segunda.error?.code).toBe("P0002");
    expect(segunda.data).toBeNull();

    const { data } = await a.usuario.supabase
      .from("orcamento_respostas")
      .select("resposta")
      .eq("orcamento_id", os.orcamento);
    expect(data).toEqual([{ resposta: "aprovado" }]);
  });

  // Editar volta para rascunho e apaga o hash do token: não existe caminho
  // pela API para um rascunho com token válido, então este é o caso real.
  it("orçamento em rascunho (editado depois de enviado) não aceita resposta", async () => {
    const os = await novaOsEnviada();
    await a.usuario.supabase.from("orcamento_itens").update({ quantidade: 3 }).eq("id", os.item);

    const { error } = await responder(os.token, true);
    expect(error?.code).toBe("P0002");
    const { data } = await a.usuario.supabase.from("orcamentos").select("estado").eq("id", os.orcamento).single();
    expect(data!.estado).toBe("rascunho");
  });

  it("token aleatório", async () => {
    const { error } = await responder(randomBytes(32).toString("base64url"), true);
    expect(error?.code).toBe("P0002");
  });
});

describe("enviar_pre_cadastro", () => {
  // Oficina só para estes testes: o limite por hora e a troca de código não
  // atrapalham os outros.
  let c: UsuarioComOficina;
  let codigo: string;

  const valido = (placa: string) => ({
    nome: "Maria Souza",
    telefone: "47912345678",
    placa,
    modelo: "Uno",
    problema: "Revisão",
  });
  const enviar = (dados: Record<string, unknown>, cod = codigo) =>
    anon.rpc("enviar_pre_cadastro", { codigo: cod, ...dados });
  const contar = async () => (await c.supabase.from("pre_cadastros").select("id")).data!.length;

  beforeAll(async () => {
    c = await criarUsuarioComOficina("segC");
    codigo = (await c.supabase.from("oficinas").select("codigo_publico").single()).data!.codigo_publico;
  });

  it("envio certo devolve só 'ok', sem dado nenhum", async () => {
    const { data, error } = await enviar(valido("PRE1A00"));
    expect(error).toBeNull();
    expect(data).toBe("ok");
  });

  it("código inválido: recusado", async () => {
    const { data, error } = await enviar(valido("PRE1A01"), "codigo-que-nao-existe");
    expect(error?.code).toBe("P0002");
    expect(data).toBeNull();
  });

  it("placa já pendente: recusada", async () => {
    const { error } = await enviar(valido("PRE1A00"));
    expect(error?.code).toBe("PC002");
  });

  const GIGANTE = "x".repeat(100_000);
  it.each([
    ["nome com 101 letras", { nome: "a".repeat(101) }],
    ["nome gigante", { nome: GIGANTE }],
    ["nome vazio", { nome: "   " }],
    ["modelo com 61 letras", { modelo: "a".repeat(61) }],
    ["problema com 1001 letras", { problema: "a".repeat(1001) }],
    ["problema gigante", { problema: GIGANTE }],
    ["telefone curto", { telefone: "479123456" }],
    ["telefone com letra", { telefone: "4791234567a" }],
    ["telefone gigante", { telefone: "4".repeat(1000) }],
    ["placa fora do formato", { placa: "AB12345" }],
    ["placa gigante", { placa: GIGANTE }],
    ["campo nulo", { nome: null }],
  ])("%s: recusado sem gravar nada", async (_, campo) => {
    const antes = await contar();
    const { error } = await enviar({ ...valido("PRE1A02"), ...campo });
    expect(error?.code).toBe("22023");
    expect(await contar()).toBe(antes);
  });

  it("21º envio na mesma hora: recusado", async () => {
    const jaEnviados = await contar();
    for (let i = jaEnviados; i < 20; i++) {
      const { error } = await enviar(valido(`LIM1A${String(i).padStart(2, "0")}`));
      expect(error).toBeNull();
    }
    const { error } = await enviar(valido("LIM1A99"));
    expect(error?.code).toBe("PC001");
    expect(await contar()).toBe(20);
  });

  it("código antigo depois de 'Gerar novo link': recusado", async () => {
    const novo = await c.supabase.rpc("trocar_codigo_publico");
    expect(novo.error).toBeNull();

    // P0002 (link inválido), e não PC001 (limite): o código antigo nem acha a oficina.
    const { error } = await enviar(valido("PRE1A03"), codigo);
    expect(error?.code).toBe("P0002");
    expect((await anon.rpc("nome_oficina_publico", { codigo })).data).toBeNull();
  });
});

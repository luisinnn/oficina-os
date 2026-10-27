import { beforeAll, describe, expect, it } from "vitest";
import {
  clienteAnonimo,
  criarUsuarioComOficina,
  criarUsuarioConfirmado,
  type UsuarioComOficina,
} from "./usuarios";
import type { StatusOrdem } from "@/lib/status-ordem";

// Ticket 05: função mudar_status, o único jeito de mudar o status da OS.
// A tabela de transições é a mesma de src/lib/status-ordem.ts.

const TODOS: StatusOrdem[] = ["aguardando", "em_servico", "pronto", "entregue", "cancelada"];
const VALIDAS = new Set([
  "aguardando>em_servico",
  "em_servico>pronto",
  "pronto>entregue",
  "em_servico>aguardando",
  "pronto>em_servico",
  "aguardando>cancelada",
  "em_servico>cancelada",
  "pronto>cancelada",
]);
// Caminho válido até cada status, partindo de "aguardando".
const CAMINHO: Record<StatusOrdem, StatusOrdem[]> = {
  aguardando: [],
  em_servico: ["em_servico"],
  pronto: ["em_servico", "pronto"],
  entregue: ["em_servico", "pronto", "entregue"],
  cancelada: ["cancelada"],
};

let a: UsuarioComOficina;
let b: UsuarioComOficina;

let sequencia = 1000;
const placaNova = () => `MST${sequencia++}`;

function mudarStatus(u: { supabase: UsuarioComOficina["supabase"] }, ordem_id: string, novo_status: string) {
  return u.supabase.rpc("mudar_status", { ordem_id, novo_status });
}

async function lerOrdem(u: UsuarioComOficina, id: string) {
  const { data, error } = await u.supabase
    .from("ordens")
    .select("status, entregue_em, updated_at")
    .eq("id", id)
    .single();
  if (error) throw new Error(`select ordens: ${error.message}`);
  return data;
}

function abrirOrdem(u: UsuarioComOficina, placa: string) {
  return u.supabase.rpc("criar_ordem", {
    placa,
    modelo: "Gol 1.0",
    nome: "João da Silva",
    telefone: "47911112222",
    problema: "Barulho no freio",
  });
}

// OS nova (aguardando), levada até o status pedido.
async function ordemEm(u: UsuarioComOficina, status: StatusOrdem, placa = placaNova()) {
  const { data: id, error } = await abrirOrdem(u, placa);
  if (error) throw new Error(`criar_ordem: ${error.message}`);
  for (const passo of CAMINHO[status]) {
    const r = await mudarStatus(u, id, passo);
    if (r.error) throw new Error(`mudar_status ${passo}: ${r.error.message}`);
  }
  return id as string;
}

beforeAll(async () => {
  a = await criarUsuarioComOficina("a");
  b = await criarUsuarioComOficina("b");
});

describe("transições", () => {
  const combinacoes = TODOS.flatMap((de) => TODOS.map((para) => [de, para] as const));

  it.each(combinacoes)("%s → %s", async (de, para) => {
    const id = await ordemEm(a, de);
    const { error } = await mudarStatus(a, id, para);

    if (VALIDAS.has(`${de}>${para}`)) {
      expect(error).toBeNull();
      expect((await lerOrdem(a, id)).status).toBe(para);
    } else {
      expect(error?.code).toBe("OS003");
      expect((await lerOrdem(a, id)).status).toBe(de);
    }
  });

  it("status que não existe é recusado", async () => {
    const id = await ordemEm(a, "aguardando");
    const { error } = await mudarStatus(a, id, "sumiu");
    expect(error?.code).toBe("OS003");
  });
});

describe("datas", () => {
  it("entregue grava entregue_em; antes disso fica vazio", async () => {
    const id = await ordemEm(a, "pronto");
    expect((await lerOrdem(a, id)).entregue_em).toBeNull();

    const antes = Date.now();
    await mudarStatus(a, id, "entregue");
    const entregue = await lerOrdem(a, id);
    expect(entregue.entregue_em).not.toBeNull();
    // Relógio do Docker e do teste podem diferir um pouco.
    expect(Math.abs(new Date(entregue.entregue_em!).getTime() - antes)).toBeLessThan(60_000);
  });

  it("cancelada fica sem entregue_em", async () => {
    const id = await ordemEm(a, "cancelada");
    expect((await lerOrdem(a, id)).entregue_em).toBeNull();
  });

  it("mudar status anda o updated_at", async () => {
    const id = await ordemEm(a, "aguardando");
    const antes = (await lerOrdem(a, id)).updated_at;
    await mudarStatus(a, id, "em_servico");
    expect((await lerOrdem(a, id)).updated_at).not.toBe(antes);
  });
});

describe("carro liberado", () => {
  it.each(["entregue", "cancelada"] as const)("depois de %s, o carro aceita uma OS nova", async (fim) => {
    const placa = placaNova();
    await ordemEm(a, fim, placa);
    const { error } = await abrirOrdem(a, placa);
    expect(error).toBeNull();
  });
});

describe("quem pode mudar", () => {
  it("A não muda OS de B (parece que não existe)", async () => {
    const id = await ordemEm(b, "aguardando");
    const { error } = await mudarStatus(a, id, "em_servico");
    expect(error?.code).toBe("P0002");
    expect((await lerOrdem(b, id)).status).toBe("aguardando");
  });

  it("OS que não existe", async () => {
    const { error } = await mudarStatus(a, "00000000-0000-0000-0000-000000000000", "em_servico");
    expect(error?.code).toBe("P0002");
  });

  it("anônimo não pode", async () => {
    const id = await ordemEm(a, "aguardando");
    const { error } = await mudarStatus({ supabase: clienteAnonimo() }, id, "em_servico");
    expect(error?.code).toBe("42501");
  });

  it("usuário sem oficina não pode", async () => {
    const id = await ordemEm(a, "aguardando");
    const semOficina = await criarUsuarioConfirmado("semoficina");
    const { error } = await mudarStatus(semOficina, id, "em_servico");
    expect(error?.code).toBe("42501");
  });

  it("update direto de status, como usuário logado, dá erro de permissão", async () => {
    const id = await ordemEm(a, "pronto");
    const { error } = await a.supabase.from("ordens").update({ status: "entregue" }).eq("id", id);
    expect(error?.code).toBe("42501");
    expect((await lerOrdem(a, id)).status).toBe("pronto");
  });

  it("update direto de entregue_em também", async () => {
    const id = await ordemEm(a, "pronto");
    const { error } = await a.supabase
      .from("ordens")
      .update({ entregue_em: new Date().toISOString() })
      .eq("id", id);
    expect(error?.code).toBe("42501");
  });
});

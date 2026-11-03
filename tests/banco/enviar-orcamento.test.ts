import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { sqlAdmin } from "./admin";
import { clienteAnonimo, criarUsuarioComOficina, criarUsuarioConfirmado, type UsuarioComOficina } from "./usuarios";

// Ticket 07: enviar_orcamento gera o token do link de aprovação, grava só o
// hash dele e devolve o token uma vez.

let a: UsuarioComOficina;
let b: UsuarioComOficina;

let sequencia = 2000;
const placaNova = () => `ENV${sequencia++}`;

async function novaOs(u: UsuarioComOficina, comItem = true) {
  const { data: ordem, error } = await u.supabase.rpc("criar_ordem", {
    placa: placaNova(),
    modelo: "Gol 1.0",
    nome: "João da Silva",
    telefone: "47911112222",
    problema: "Barulho no freio",
    km: 50000,
  });
  if (error) throw new Error(`criar_ordem: ${error.message}`);
  const orc = await u.supabase.from("orcamentos").select("id").eq("ordem_id", ordem).single();
  if (orc.error) throw new Error(`select orcamentos: ${orc.error.message}`);
  if (comItem) {
    const item = await u.supabase.from("orcamento_itens").insert({
      orcamento_id: orc.data.id,
      tipo: "peca",
      descricao: "Pastilha de freio",
      quantidade: 2,
      valor_unitario_centavos: 8990,
    });
    if (item.error) throw new Error(`insert orcamento_itens: ${item.error.message}`);
  }
  return { ordem: ordem as string, orcamento: orc.data.id as string };
}

async function enviar(u: UsuarioComOficina, ordem: string): Promise<string> {
  const { data, error } = await u.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
  if (error) throw new Error(`enviar_orcamento: ${error.message}`);
  return data as string;
}

async function lerOrcamento(u: UsuarioComOficina, id: string) {
  const { data, error } = await u.supabase
    .from("orcamentos")
    .select("estado, token_hash, token_expira_em, enviado_em, respondido_em, motivo_recusa")
    .eq("id", id)
    .single();
  if (error) throw new Error(`select orcamentos: ${error.message}`);
  return data;
}

// bytea chega pela API como "\x<hex>".
const sha256 = (token: string) => `\\x${createHash("sha256").update(token).digest("hex")}`;

// Quantos orçamentos (de qualquer oficina) aceitariam este token.
const orcamentosComToken = (token: string) =>
  sqlAdmin(`select count(*) from public.orcamentos where token_hash = '${sha256(token)}'::bytea`);

beforeAll(async () => {
  a = await criarUsuarioComOficina("a");
  b = await criarUsuarioComOficina("b");
});

describe("enviar_orcamento", () => {
  it("devolve token base64url de 43 caracteres e marca o orçamento como enviado", async () => {
    const { ordem, orcamento } = await novaOs(a);
    const token = await enviar(a, ordem);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const orc = await lerOrcamento(a, orcamento);
    expect(orc.estado).toBe("enviado");
    expect(orc.respondido_em).toBeNull();
    const agora = Date.now();
    expect(Math.abs(new Date(orc.enviado_em!).getTime() - agora)).toBeLessThan(60_000);
    const trintaDias = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(new Date(orc.token_expira_em!).getTime() - (agora + trintaDias))).toBeLessThan(60_000);
  });

  it("token_hash é o sha256 do token, nunca o token em texto", async () => {
    const { ordem, orcamento } = await novaOs(a);
    const token = await enviar(a, ordem);
    const { token_hash } = await lerOrcamento(a, orcamento);

    expect(token_hash).toBe(sha256(token));
    const bytes = Buffer.from(String(token_hash).slice(2), "hex");
    expect(bytes).toHaveLength(32);
    expect(bytes.includes(Buffer.from(token))).toBe(false);
    expect(String(token_hash)).not.toContain(token);
    expect(String(token_hash)).not.toContain(Buffer.from(token).toString("hex"));
  });

  it("cada envio gera um token diferente", async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 3; i++) tokens.add(await enviar(a, (await novaOs(a)).ordem));
    expect(tokens.size).toBe(3);
  });

  it("reenviar gera link novo e o anterior para de funcionar", async () => {
    const { ordem, orcamento } = await novaOs(a);
    const antigo = await enviar(a, ordem);
    const novo = await enviar(a, ordem);

    expect(novo).not.toBe(antigo);
    expect((await lerOrcamento(a, orcamento)).token_hash).toBe(sha256(novo));
    expect(orcamentosComToken(antigo)).toBe("0");
    expect(orcamentosComToken(novo)).toBe("1");
  });

  it.each(["aprovado", "recusado"] as const)(
    "reenviar orçamento %s: volta a enviado, limpa a resposta e mantém o histórico",
    async (resposta) => {
      const { ordem, orcamento } = await novaOs(a);
      await enviar(a, ordem);
      // Resposta do cliente como o ticket 08 vai gravar.
      sqlAdmin(`
        update public.orcamentos set estado = '${resposta}', respondido_em = now(),
          motivo_recusa = ${resposta === "recusado" ? "'Caro'" : "null"}
        where id = '${orcamento}';
        insert into public.orcamento_respostas (oficina_id, orcamento_id, resposta, total_centavos, itens, motivo)
        select oficina_id, id, '${resposta}', 17980, '[]'::jsonb, motivo_recusa
        from public.orcamentos where id = '${orcamento}';
      `);

      const token = await enviar(a, ordem);
      expect(await lerOrcamento(a, orcamento)).toMatchObject({
        estado: "enviado",
        token_hash: sha256(token),
        respondido_em: null,
        motivo_recusa: null,
      });
      const { data } = await a.supabase.from("orcamento_respostas").select("resposta").eq("orcamento_id", orcamento);
      expect(data).toEqual([{ resposta }]);
    },
  );

  it("reenviar atualiza enviado_em", async () => {
    const { ordem, orcamento } = await novaOs(a);
    await enviar(a, ordem);
    sqlAdmin(`update public.orcamentos set enviado_em = now() - interval '1 day' where id = '${orcamento}'`);
    await enviar(a, ordem);
    const { enviado_em } = await lerOrcamento(a, orcamento);
    expect(Date.now() - new Date(enviado_em!).getTime()).toBeLessThan(60_000);
  });

  it("orçamento sem itens não é enviado (OS004) e continua rascunho", async () => {
    const { ordem, orcamento } = await novaOs(a, false);
    const { error } = await a.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
    expect(error?.code).toBe("OS004");
    expect(await lerOrcamento(a, orcamento)).toMatchObject({ estado: "rascunho", token_hash: null });
  });

  it("OS que não existe dá P0002", async () => {
    const { error } = await a.supabase.rpc("enviar_orcamento", { ordem_id: "00000000-0000-0000-0000-000000000000" });
    expect(error?.code).toBe("P0002");
  });
});

describe("permissões", () => {
  it("A não envia orçamento de B (P0002) e o de B não muda", async () => {
    const { ordem, orcamento } = await novaOs(b);
    const { error } = await a.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
    expect(error?.code).toBe("P0002");
    expect(await lerOrcamento(b, orcamento)).toMatchObject({ estado: "rascunho", token_hash: null });
  });

  it("anônimo não pode chamar", async () => {
    const { ordem } = await novaOs(a);
    const { error } = await clienteAnonimo().rpc("enviar_orcamento", { ordem_id: ordem });
    expect(error?.code).toBe("42501");
  });

  it("usuário sem oficina recebe 42501", async () => {
    const semOficina = await criarUsuarioConfirmado("sem-oficina");
    const { ordem } = await novaOs(a);
    const { error } = await semOficina.supabase.rpc("enviar_orcamento", { ordem_id: ordem });
    expect(error?.code).toBe("42501");
  });
});

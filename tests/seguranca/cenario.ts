import type { PostgrestError } from "@supabase/supabase-js";
import { expect } from "vitest";
import { clienteAnonimo, criarUsuarioComOficina, type UsuarioComOficina } from "../banco/usuarios";

// Ticket 10: cenário dos testes de segurança. Cada oficina tem cliente,
// veículo, OS com orçamento aprovado (gera orcamento_respostas) e depois
// cancelada (entra no histórico), OS com orçamento enviado esperando resposta
// e um pré-cadastro pendente. Tudo montado pela API com a chave publishable,
// como o app (e um atacante) faria.

export type Oficina = {
  usuario: UsuarioComOficina;
  oficina: string;
  codigoPublico: string;
  cliente: string;
  veiculo: string;
  // OS do orçamento respondido (aprovado) e depois cancelada.
  ordemFechada: string;
  orcamentoRespondido: string;
  resposta: string;
  // OS aberta com o orçamento enviado e sem resposta.
  ordem: string;
  placa: string;
  orcamento: string;
  item: string;
  token: string;
  preCadastro: string;
  // Dados sensíveis, para conferir que não vazam pelas partes públicas.
  nomeCliente: string;
  telefoneCliente: string;
  obsInterna: string;
};

// Placas e telefones diferentes por oficina deixam claro, num erro, de quem
// é cada linha. A oficina é nova a cada execução, então não colidem.
export async function montarOficina(apelido: "A" | "B"): Promise<Oficina> {
  const usuario = await criarUsuarioComOficina(`seg${apelido}`);
  const s = usuario.supabase;
  const nomeCliente = `Cliente Secreto ${apelido} da Silva`;
  const telefoneCliente = { A: "47988770001", B: "47988770002" }[apelido];
  const obsInterna = `Observação interna da oficina ${apelido}`;
  const novaOs = (placa: string) => osEnviada(usuario, placa, { nomeCliente, telefoneCliente, obsInterna });

  // OS 1: cliente aprova pela página pública, depois a oficina cancela.
  const fechada = await novaOs(`SG${apelido}1A01`);
  const aprovacao = await clienteAnonimo().rpc("responder_orcamento", { token: fechada.token, aprovar: true });
  falhaSe(aprovacao.error, "responder_orcamento");
  const cancela = await s.rpc("mudar_status", { ordem_id: fechada.ordem, novo_status: "cancelada" });
  falhaSe(cancela.error, "mudar_status");
  const resp = await s.from("orcamento_respostas").select("id").eq("orcamento_id", fechada.orcamento).single();
  falhaSe(resp.error, "select orcamento_respostas");

  // OS 2: orçamento enviado, esperando o cliente.
  const placa = `SG${apelido}1A02`;
  const aberta = await novaOs(placa);

  const ofi = await s.from("oficinas").select("codigo_publico").single();
  falhaSe(ofi.error, "select oficinas");
  const codigoPublico = ofi.data!.codigo_publico as string;

  const envio = await clienteAnonimo().rpc("enviar_pre_cadastro", {
    codigo: codigoPublico,
    nome: `Visitante ${apelido}`,
    telefone: "47912345678",
    placa: `SG${apelido}1A03`,
    modelo: "Uno",
    problema: "Revisão",
  });
  falhaSe(envio.error, "enviar_pre_cadastro");
  const pre = await s.from("pre_cadastros").select("id").single();
  falhaSe(pre.error, "select pre_cadastros");

  const os = await s.from("ordens").select("cliente_id, veiculo_id").eq("id", aberta.ordem).single();
  falhaSe(os.error, "select ordens");

  return {
    usuario,
    oficina: usuario.oficina,
    codigoPublico,
    cliente: os.data!.cliente_id,
    veiculo: os.data!.veiculo_id,
    ordemFechada: fechada.ordem,
    orcamentoRespondido: fechada.orcamento,
    resposta: resp.data!.id,
    ordem: aberta.ordem,
    placa,
    orcamento: aberta.orcamento,
    item: aberta.item,
    token: aberta.token,
    preCadastro: pre.data!.id,
    nomeCliente,
    telefoneCliente,
    obsInterna,
  };
}

type DadosCliente = Pick<Oficina, "nomeCliente" | "telefoneCliente" | "obsInterna">;

// OS nova com um item (2 × R$ 89,90) e o orçamento enviado. Devolve o token
// do link, que só aparece aqui (o banco guarda o hash).
export async function osEnviada(u: UsuarioComOficina, placa: string, cliente: DadosCliente) {
  const s = u.supabase;
  const { data, error } = await s.rpc("criar_ordem", {
    placa,
    modelo: "Gol 1.0",
    nome: cliente.nomeCliente,
    telefone: cliente.telefoneCliente,
    problema: "Barulho no freio",
    km: 50000,
    obs_interna: cliente.obsInterna,
  });
  falhaSe(error, "criar_ordem");
  const orc = await s.from("orcamentos").select("id").eq("ordem_id", data).single();
  falhaSe(orc.error, "select orcamentos");
  const item = await s
    .from("orcamento_itens")
    .insert({
      orcamento_id: orc.data!.id,
      tipo: "peca",
      descricao: "Pastilha de freio",
      quantidade: 2,
      valor_unitario_centavos: 8990,
    })
    .select("id")
    .single();
  falhaSe(item.error, "insert orcamento_itens");
  const token = await s.rpc("enviar_orcamento", { ordem_id: data });
  falhaSe(token.error, "enviar_orcamento");
  return {
    ordem: data as string,
    orcamento: orc.data!.id as string,
    item: item.data!.id as string,
    token: token.data as string,
  };
}

function falhaSe(error: PostgrestError | null, passo: string) {
  if (error) throw new Error(`${passo}: ${error.code} ${error.message}`);
}

// Tabelas com dados de oficina. Se criar tabela nova, ponha aqui: o teste de
// catálogo (catalogo.test.ts) falha se faltar alguma.
export const TABELAS = [
  "oficinas",
  "oficina_membros",
  "clientes",
  "veiculos",
  "ordens",
  "orcamentos",
  "orcamento_itens",
  "orcamento_respostas",
  "pre_cadastros",
] as const;
export type Tabela = (typeof TABELAS)[number];

// Views lidas pelo app (também passam pelo RLS de quem lê).
export const VIEWS = ["historico_ordens"] as const;

// Uma coluna qualquer de cada tabela, com um valor que caberia nela: o
// update de ataque.
export const MUDANCA: Record<Tabela, Record<string, unknown>> = {
  oficinas: { nome: "Invadida" },
  oficina_membros: { papel: "dono" },
  clientes: { nome: "Invadido" },
  veiculos: { modelo: "Invadido" },
  ordens: { problema: "Invadido" },
  orcamentos: { estado: "rascunho" },
  orcamento_itens: { descricao: "Invadido" },
  orcamento_respostas: { motivo: "Invadido" },
  pre_cadastros: { situacao: "descartado" },
};

// Coluna que identifica a linha e o id dela em cada tabela, da oficina "o".
export function linhaDe(o: Oficina, tabela: Tabela): { coluna: string; id: string } {
  switch (tabela) {
    case "oficinas":
      return { coluna: "id", id: o.oficina };
    case "oficina_membros":
      return { coluna: "user_id", id: o.usuario.id };
    case "clientes":
      return { coluna: "id", id: o.cliente };
    case "veiculos":
      return { coluna: "id", id: o.veiculo };
    case "ordens":
      return { coluna: "id", id: o.ordem };
    case "orcamentos":
      return { coluna: "id", id: o.orcamento };
    case "orcamento_itens":
      return { coluna: "id", id: o.item };
    case "orcamento_respostas":
      return { coluna: "id", id: o.resposta };
    case "pre_cadastros":
      return { coluna: "id", id: o.preCadastro };
  }
}

// "Não fez nada": recusado pelo banco (sem permissão) ou 0 linhas afetadas
// (o RLS esconde a linha). Pedir as linhas de volta (.select()) é o que
// mostra quantas o update/delete pegou.
export function semEfeito(r: { error: PostgrestError | null; data: unknown[] | null }) {
  if (r.error) expect(r.error.code).toBe("42501");
  else expect(r.data).toEqual([]);
}

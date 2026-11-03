import "server-only";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type AvisoDeKm, kmMenorQueUltima, textoKmMenor, ultimaKm, type Tanque } from "@/lib/km";
import type { DadosItem, EstadoOrcamento } from "@/lib/orcamento";
import { STATUS_ABERTOS, estaAberta, type StatusOrdem } from "@/lib/status-ordem";

// Leituras de OS, veículos e clientes para as telas do painel. O RLS só
// devolve dados da oficina do usuário logado, então não precisa filtrar.
// Toda leitura começa por getUsuario(): exige login e marca a página como
// "só na hora do pedido" (sem isso o Next tenta pré-montar e falha).

export type OrdemResumo = {
  id: string;
  numero: number;
  status: StatusOrdem;
  problema: string;
  created_at: string;
  km: number | null;
};

export type OrdemAtiva = Pick<OrdemResumo, "id" | "numero" | "status"> & {
  veiculos: { placa: string; modelo: string };
  clientes: { nome: string };
  orcamentos: { estado: EstadoOrcamento; orcamento_itens: [{ count: number }] };
};

export type Carro = {
  id: string;
  placa: string;
  modelo: string;
  dono: { nome: string; telefone: string };
  // Mais recente primeiro.
  historico: OrdemResumo[];
  aberta?: OrdemResumo;
};

export type Ordem = OrdemResumo & {
  tanque: Tanque | null;
  obs_interna: string | null;
  entregue_em: string | null;
  veiculos: { placa: string; modelo: string };
  clientes: { nome: string; telefone: string };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function falhou(onde: string, error: { message: string }): never {
  throw new Error(`Erro ao ler ${onde}: ${error.message}`);
}

// OS abertas para a tela inicial, da mais antiga para a mais nova.
export async function listarOrdensAtivas(): Promise<OrdemAtiva[]> {
  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens")
    .select("id, numero, status, veiculos(placa, modelo), clientes(nome), orcamentos(estado, orcamento_itens(count))")
    .in("status", STATUS_ABERTOS)
    .order("numero");
  if (error) falhou("as OS", error);
  return data as unknown as OrdemAtiva[];
}

// Carro pela placa (já normalizada), com dono atual e histórico de OS.
// null = placa nova.
export async function buscarCarro(placa: string): Promise<Carro | null> {
  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("veiculos")
    .select("id, placa, modelo, clientes(nome, telefone)")
    .eq("placa", placa)
    .maybeSingle();
  if (error) falhou("o veículo", error);
  if (!data) return null;

  const ordens = await supabase
    .from("ordens")
    .select("id, numero, status, problema, created_at, km")
    .eq("veiculo_id", data.id)
    .order("numero", { ascending: false });
  if (ordens.error) falhou("o histórico", ordens.error);

  const historico = ordens.data as OrdemResumo[];
  return {
    id: data.id,
    placa: data.placa,
    modelo: data.modelo,
    dono: data.clientes as unknown as Carro["dono"],
    historico,
    aberta: historico.find((o) => estaAberta(o.status)),
  };
}

// Uma OS com carro e cliente daquela visita. null = não existe (ou é de
// outra oficina, que o RLS esconde).
export async function buscarOrdem(id: string): Promise<Ordem | null> {
  // id fora do formato daria erro no banco; é o mesmo que não existir.
  if (!UUID.test(id)) return null;

  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens")
    .select(
      "id, numero, status, problema, created_at, entregue_em, km, tanque, obs_interna, veiculos(placa, modelo), clientes(nome, telefone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("a OS", error);
  return data as unknown as Ordem | null;
}

// Aviso "Confere a km?" quando a km é menor que a da última OS deste carro
// (exceto = a própria OS, ao corrigir). null = sem aviso. Não bloqueia.
export async function avisoDeKm(
  placa: string,
  km: number,
  exceto?: string,
): Promise<AvisoDeKm | null> {
  const carro = await buscarCarro(placa);
  const ultima = carro ? ultimaKm(carro.historico, exceto) : null;
  if (ultima === null || !kmMenorQueUltima(km, ultima)) return null;
  return { texto: textoKmMenor(ultima), km };
}

export type ItemOrcamento = DadosItem & { id: string };

export type RespostaCliente = {
  id: string;
  resposta: "aprovado" | "recusado";
  total_centavos: number;
  motivo: string | null;
  respondido_em: string;
};

export type Orcamento = {
  id: string;
  estado: EstadoOrcamento;
  // Enviado ao cliente ao menos uma vez (fica mesmo se voltar a rascunho):
  // a partir daí a km de entrada não muda mais.
  enviado_em: string | null;
  total_centavos: number;
  // Na ordem em que foram adicionados.
  itens: ItemOrcamento[];
  // Mais recente primeiro.
  respostas: RespostaCliente[];
};

const COLUNAS_ITEM = "id, tipo, descricao, quantidade, valor_unitario_centavos";

// Orçamento de uma OS (toda OS tem um), com itens e histórico de respostas.
// null = OS não existe (ou é de outra oficina).
export async function buscarOrcamento(ordemId: string): Promise<Orcamento | null> {
  if (!UUID.test(ordemId)) return null;

  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamentos")
    .select(
      `id, estado, enviado_em, total_centavos,
       itens:orcamento_itens(${COLUNAS_ITEM}),
       respostas:orcamento_respostas(id, resposta, total_centavos, motivo, respondido_em)`,
    )
    .eq("ordem_id", ordemId)
    .order("created_at", { referencedTable: "itens" })
    .order("respondido_em", { referencedTable: "respostas", ascending: false })
    .maybeSingle();
  if (error) falhou("o orçamento", error);
  return data as unknown as Orcamento | null;
}

// Um item para a tela de editar, com o número da OS e o estado do orçamento
// (para o aviso de link enviado). null = não existe ou não é desta OS.
export async function buscarItem(
  ordemId: string,
  itemId: string,
): Promise<{ item: ItemOrcamento; estado: EstadoOrcamento; numero: number } | null> {
  if (!UUID.test(ordemId) || !UUID.test(itemId)) return null;

  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamento_itens")
    .select(`${COLUNAS_ITEM}, orcamentos!inner(estado, ordem_id, ordens(numero))`)
    .eq("id", itemId)
    .eq("orcamentos.ordem_id", ordemId)
    .maybeSingle();
  if (error) falhou("o item", error);
  if (!data) return null;

  const { orcamentos, ...item } = data as unknown as ItemOrcamento & {
    orcamentos: { estado: EstadoOrcamento; ordens: { numero: number } };
  };
  return { item, estado: orcamentos.estado, numero: orcamentos.ordens.numero };
}

export type PreCadastro = {
  id: string;
  nome: string;
  telefone: string;
  placa: string;
  modelo: string;
  problema: string;
  situacao: "pendente" | "confirmado" | "descartado";
  ordem_id: string | null;
  created_at: string;
};

const COLUNAS_PRE = "id, nome, telefone, placa, modelo, problema, situacao, ordem_id, created_at";

// Pré-cadastros esperando a oficina, do mais antigo para o mais novo.
export async function listarPreCadastrosPendentes(): Promise<PreCadastro[]> {
  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pre_cadastros")
    .select(COLUNAS_PRE)
    .eq("situacao", "pendente")
    .order("created_at");
  if (error) falhou("os pré-cadastros", error);
  return data as PreCadastro[];
}

// Um pré-cadastro (qualquer situação). null = não existe ou é de outra oficina.
export async function buscarPreCadastro(id: string): Promise<PreCadastro | null> {
  if (!UUID.test(id)) return null;

  await getUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase.from("pre_cadastros").select(COLUNAS_PRE).eq("id", id).maybeSingle();
  if (error) falhou("o pré-cadastro", error);
  return data as PreCadastro | null;
}

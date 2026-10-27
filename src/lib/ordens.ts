import "server-only";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
};

export type OrdemAtiva = Pick<OrdemResumo, "id" | "numero" | "status"> & {
  veiculos: { placa: string; modelo: string };
  clientes: { nome: string };
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
  km: number | null;
  obs_interna: string | null;
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
    .select("id, numero, status, veiculos(placa, modelo), clientes(nome)")
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
    .select("id, numero, status, problema, created_at")
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
      "id, numero, status, problema, created_at, km, obs_interna, veiculos(placa, modelo), clientes(nome, telefone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("a OS", error);
  return data as unknown as Ordem | null;
}

-- Ticket 03: clientes, veículos e ordens de serviço (OS).
-- Tudo separado por oficina: oficina_id vem de public.minha_oficina() e o RLS
-- só libera a oficina do usuário logado. Os formatos de placa e telefone são
-- os mesmos de src/lib/formatos.ts: se mudar aqui, mude lá. Os limites de
-- tamanho entram na validação dos formulários (ticket 04).

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina()
    references public.oficinas (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100 and nome = btrim(nome)),
  -- Só dígitos: DDD + número (10 fixo, 11 celular).
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  created_at timestamptz not null default now(),
  -- Alvo das FKs compostas abaixo: garante que veículo e OS só apontam para
  -- cliente da mesma oficina.
  unique (oficina_id, id)
);

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina()
    references public.oficinas (id) on delete cascade,
  -- Maiúscula sem hífen: antiga ABC1234 ou Mercosul ABC1D23.
  placa text not null check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  modelo text not null check (char_length(modelo) between 1 and 60 and modelo = btrim(modelo)),
  -- Dono atual. Trocar de dono não muda as OS antigas (ordens.cliente_id).
  cliente_id uuid not null,
  created_at timestamptz not null default now(),
  -- Também serve de índice para a busca por placa.
  unique (oficina_id, placa),
  unique (oficina_id, id),
  foreign key (oficina_id, cliente_id) references public.clientes (oficina_id, id)
);

create table public.ordens (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina()
    references public.oficinas (id) on delete cascade,
  -- Preenchido pelo trigger numerar_ordem (o valor enviado é ignorado).
  numero integer not null,
  veiculo_id uuid not null,
  -- Cliente daquela visita: o histórico não muda se o carro trocar de dono.
  cliente_id uuid not null,
  problema text not null check (char_length(problema) between 1 and 1000 and problema = btrim(problema)),
  km integer check (km >= 0),
  -- Opcional: sem observação é null (o app troca "" por null).
  obs_interna text check (char_length(obs_interna) between 1 and 1000 and obs_interna = btrim(obs_interna)),
  status text not null default 'aguardando'
    check (status in ('aguardando', 'em_servico', 'pronto', 'entregue', 'cancelada')),
  origem text not null default 'balcao' check (origem in ('balcao', 'link')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Gravado ao entrar em "entregue" (ticket 05). Entregue não volta atrás,
  -- então as duas coisas andam sempre juntas.
  entregue_em timestamptz,
  check ((status = 'entregue') = (entregue_em is not null)),
  unique (oficina_id, numero),
  foreign key (oficina_id, veiculo_id) references public.veiculos (oficina_id, id),
  foreign key (oficina_id, cliente_id) references public.clientes (oficina_id, id)
);

-- Uma OS aberta por carro.
create unique index ordens_uma_aberta_por_veiculo
  on public.ordens (veiculo_id) where status not in ('entregue', 'cancelada');

-- veiculos (oficina_id, placa) já tem índice pelo unique acima.
create index ordens_oficina_status_idx on public.ordens (oficina_id, status);
create index ordens_veiculo_idx on public.ordens (veiculo_id);
create index ordens_cliente_idx on public.ordens (oficina_id, cliente_id);
create index veiculos_cliente_idx on public.veiculos (oficina_id, cliente_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Número da OS: pega o próximo da oficina e incrementa. O "for update" trava a
-- linha da oficina até o fim da transação, então duas OS ao mesmo tempo nunca
-- recebem o mesmo número; se o insert falhar depois, o incremento é desfeito.
-- security definer porque o usuário não pode mexer em proximo_numero_os.
create function public.numerar_ordem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proximo integer;
begin
  select o.proximo_numero_os into proximo
  from public.oficinas o
  where o.id = new.oficina_id
  for update;

  if proximo is null then
    raise exception 'Oficina não encontrada.' using errcode = '23503';
  end if;

  update public.oficinas set proximo_numero_os = proximo + 1 where id = new.oficina_id;
  new.numero := proximo;
  return new;
end;
$$;

create trigger numerar_ordem
  before insert on public.ordens
  for each row execute function public.numerar_ordem();

create function public.atualizar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger atualizar_updated_at
  before update on public.ordens
  for each row execute function public.atualizar_updated_at();

-- Funções de trigger não são para chamar pela API.
revoke execute on function public.numerar_ordem() from public, anon, authenticated;
revoke execute on function public.atualizar_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------------

-- Tira tudo o que o Supabase dá por padrão e devolve só o necessário.
-- Permissão por coluna: o usuário só envia o que é dele preencher; id,
-- oficina_id, numero, status, origem e datas vêm de default ou de trigger.
-- Status muda só pela função do ticket 05; origem "link" só pela do 09.
-- Sem delete: OS se cancela, não se apaga.
revoke all on public.clientes from anon, authenticated;
revoke all on public.veiculos from anon, authenticated;
revoke all on public.ordens from anon, authenticated;

grant select on public.clientes to authenticated;
grant insert (nome, telefone) on public.clientes to authenticated;
grant update (nome, telefone) on public.clientes to authenticated;

grant select on public.veiculos to authenticated;
grant insert (placa, modelo, cliente_id) on public.veiculos to authenticated;
-- Placa é a identidade do carro: não muda (placa errada = cadastrar outro).
grant update (modelo, cliente_id) on public.veiculos to authenticated;

grant select on public.ordens to authenticated;
grant insert (veiculo_id, cliente_id, problema, km, obs_interna) on public.ordens to authenticated;
grant update (problema, km, obs_interna) on public.ordens to authenticated;

alter table public.clientes enable row level security;
alter table public.veiculos enable row level security;
alter table public.ordens enable row level security;

create policy "oficina lê os próprios clientes"
  on public.clientes for select to authenticated
  using (oficina_id = (select public.minha_oficina()));
create policy "oficina cadastra cliente"
  on public.clientes for insert to authenticated
  with check (oficina_id = (select public.minha_oficina()));
create policy "oficina atualiza os próprios clientes"
  on public.clientes for update to authenticated
  using (oficina_id = (select public.minha_oficina()))
  with check (oficina_id = (select public.minha_oficina()));

create policy "oficina lê os próprios veículos"
  on public.veiculos for select to authenticated
  using (oficina_id = (select public.minha_oficina()));
create policy "oficina cadastra veículo"
  on public.veiculos for insert to authenticated
  with check (oficina_id = (select public.minha_oficina()));
create policy "oficina atualiza os próprios veículos"
  on public.veiculos for update to authenticated
  using (oficina_id = (select public.minha_oficina()))
  with check (oficina_id = (select public.minha_oficina()));

create policy "oficina lê as próprias OS"
  on public.ordens for select to authenticated
  using (oficina_id = (select public.minha_oficina()));
create policy "oficina abre OS"
  on public.ordens for insert to authenticated
  with check (oficina_id = (select public.minha_oficina()));
create policy "oficina atualiza as próprias OS"
  on public.ordens for update to authenticated
  using (oficina_id = (select public.minha_oficina()))
  with check (oficina_id = (select public.minha_oficina()));

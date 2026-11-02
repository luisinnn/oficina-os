-- Ticket 06: orçamento da OS (itens e total).
--
-- - Toda OS tem exatamente um orçamento, criado junto com ela (trigger abaixo).
--   Ele nasce em "rascunho" e só muda de estado por função: enviar (ticket 07)
--   e responder (ticket 08). O estado do orçamento não muda o status da OS.
-- - Total = soma de quantidade × valor dos itens, calculado na hora pela
--   função total_centavos (nunca gravado). Na API: select "total_centavos".
-- - Mexer em item de orçamento já enviado/respondido volta ele para rascunho e
--   anula o link (token). O histórico em orcamento_respostas fica.
-- Os limites são os mesmos de src/lib/orcamento.ts: se mudar aqui, mude lá.

-- Alvo da FK composta de orcamentos: orçamento só aponta para OS da mesma oficina.
alter table public.ordens add constraint ordens_oficina_id_id_key unique (oficina_id, id);

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  ordem_id uuid not null,
  estado text not null default 'rascunho'
    check (estado in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  -- sha256 do token do link (ticket 07). O token em si nunca é gravado.
  token_hash bytea unique,
  token_expira_em timestamptz,
  enviado_em timestamptz,
  respondido_em timestamptz,
  motivo_recusa text
    check (char_length(motivo_recusa) between 1 and 500 and motivo_recusa = btrim(motivo_recusa)),
  created_at timestamptz not null default now(),
  -- Rascunho não tem link; enviado e respondido têm.
  check ((token_hash is null) = (token_expira_em is null)),
  check ((estado = 'rascunho') = (token_hash is null)),
  check ((estado in ('aprovado', 'recusado')) = (respondido_em is not null)),
  check (motivo_recusa is null or estado = 'recusado'),
  unique (oficina_id, id),
  -- 1 orçamento por OS. Nas mesmas colunas da FK para a API ver a relação
  -- como 1 para 1 (ordens -> orcamentos vem como objeto, não lista).
  unique (oficina_id, ordem_id),
  foreign key (oficina_id, ordem_id) references public.ordens (oficina_id, id) on delete cascade
);

create table public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina()
    references public.oficinas (id) on delete cascade,
  orcamento_id uuid not null,
  tipo text not null check (tipo in ('peca', 'mao_de_obra')),
  descricao text not null check (char_length(descricao) between 1 and 200 and descricao = btrim(descricao)),
  quantidade integer not null check (quantidade between 1 and 999),
  valor_unitario_centavos integer not null check (valor_unitario_centavos between 0 and 10000000),
  created_at timestamptz not null default now(),
  foreign key (oficina_id, orcamento_id) references public.orcamentos (oficina_id, id) on delete cascade
);

create index orcamento_itens_orcamento_idx on public.orcamento_itens (orcamento_id);

-- Histórico das respostas do cliente: ninguém edita nem apaga pela API.
-- Gravado só pela função de resposta (ticket 08). Guarda o total e a cópia
-- dos itens do momento, porque editar o orçamento depois muda os dois.
create table public.orcamento_respostas (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  orcamento_id uuid not null,
  resposta text not null check (resposta in ('aprovado', 'recusado')),
  total_centavos bigint not null check (total_centavos >= 0),
  itens jsonb not null check (jsonb_typeof(itens) = 'array'),
  motivo text check (char_length(motivo) between 1 and 500 and motivo = btrim(motivo)),
  respondido_em timestamptz not null default now(),
  foreign key (oficina_id, orcamento_id) references public.orcamentos (oficina_id, id) on delete cascade
);

create index orcamento_respostas_orcamento_idx on public.orcamento_respostas (orcamento_id);

-- OS que já existiam ganham o orçamento delas.
insert into public.orcamentos (oficina_id, ordem_id)
select o.oficina_id, o.id from public.ordens o;

-- ---------------------------------------------------------------------------
-- Total
-- ---------------------------------------------------------------------------

-- Campo calculado: o PostgREST mostra como coluna de orcamentos. Roda com as
-- permissões do usuário (RLS dos itens vale). bigint: 999 × R$ 100.000,00
-- já passa do limite de integer.
create function public.total_centavos(orcamento public.orcamentos)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(i.quantidade::bigint * i.valor_unitario_centavos), 0)::bigint
  from public.orcamento_itens i
  where i.orcamento_id = orcamento.id;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Orçamento junto com a OS. security definer: o usuário não tem insert em
-- orcamentos.
create function public.criar_orcamento_da_ordem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.orcamentos (oficina_id, ordem_id) values (new.oficina_id, new.id);
  return null;
end;
$$;

create trigger criar_orcamento
  after insert on public.ordens
  for each row execute function public.criar_orcamento_da_ordem();

-- Item novo, editado ou removido em orçamento já enviado/respondido: volta
-- para rascunho e apaga o token, então o link antigo morre. enviado_em fica
-- (mostra que já foi enviado uma vez). Salvar sem mudar nada não conta.
-- security definer: o usuário não tem update em orcamentos. É seguro porque
-- o RLS já conferiu que o item é da oficina dele e o item não muda de
-- orçamento (sem grant em orcamento_id). Se um dia liberar essa coluna,
-- reveja esta função.
create function public.orcamento_volta_para_rascunho()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return null;
  end if;

  -- No delete, new é null; no insert, old é null.
  update public.orcamentos
  set estado = 'rascunho',
      token_hash = null,
      token_expira_em = null,
      respondido_em = null,
      motivo_recusa = null
  where id in (new.orcamento_id, old.orcamento_id)
    and estado <> 'rascunho';
  return null;
end;
$$;

create trigger orcamento_volta_para_rascunho
  after insert or update or delete on public.orcamento_itens
  for each row execute function public.orcamento_volta_para_rascunho();

-- Funções de trigger não são para chamar pela API.
revoke execute on function public.criar_orcamento_da_ordem() from public, anon, authenticated;
revoke execute on function public.orcamento_volta_para_rascunho() from public, anon, authenticated;
revoke execute on function public.total_centavos(public.orcamentos) from public, anon;
grant execute on function public.total_centavos(public.orcamentos) to authenticated;

-- ---------------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------------

-- Tira tudo o que o Supabase dá por padrão e devolve só o necessário.
-- orcamentos: só leitura; todas as colunas mudam por função ou trigger.
-- orcamento_itens: o usuário cria, edita e apaga; item não muda de orçamento.
-- orcamento_respostas: só leitura.
revoke all on public.orcamentos from anon, authenticated;
revoke all on public.orcamento_itens from anon, authenticated;
revoke all on public.orcamento_respostas from anon, authenticated;

grant select on public.orcamentos to authenticated;

grant select, delete on public.orcamento_itens to authenticated;
grant insert (orcamento_id, tipo, descricao, quantidade, valor_unitario_centavos)
  on public.orcamento_itens to authenticated;
grant update (tipo, descricao, quantidade, valor_unitario_centavos)
  on public.orcamento_itens to authenticated;

grant select on public.orcamento_respostas to authenticated;

alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;
alter table public.orcamento_respostas enable row level security;

create policy "oficina lê os próprios orçamentos"
  on public.orcamentos for select to authenticated
  using (oficina_id = (select public.minha_oficina()));

create policy "oficina lê os próprios itens"
  on public.orcamento_itens for select to authenticated
  using (oficina_id = (select public.minha_oficina()));
create policy "oficina adiciona item"
  on public.orcamento_itens for insert to authenticated
  with check (oficina_id = (select public.minha_oficina()));
create policy "oficina edita os próprios itens"
  on public.orcamento_itens for update to authenticated
  using (oficina_id = (select public.minha_oficina()))
  with check (oficina_id = (select public.minha_oficina()));
create policy "oficina remove os próprios itens"
  on public.orcamento_itens for delete to authenticated
  using (oficina_id = (select public.minha_oficina()));

create policy "oficina lê as próprias respostas"
  on public.orcamento_respostas for select to authenticated
  using (oficina_id = (select public.minha_oficina()));

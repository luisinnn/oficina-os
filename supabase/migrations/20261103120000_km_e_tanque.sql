-- Ticket 15: km de entrada obrigatória e nível do tanque.
--
-- A km de entrada é a prova da garantia das peças (garantia por km): o
-- cliente não pode alegar que rodou pouco. Por isso:
-- - toda OS nova tem km (OS antigas sem km ficam como estão: sem NOT NULL);
-- - a km não muda depois que o orçamento foi enviado ao cliente uma vez
--   (enviado_em fica mesmo se o orçamento voltar para rascunho);
-- - a página de aprovação mostra a km, e a resposta do cliente guarda uma cópia.
-- Tanque: opcional, 5 opções, editável enquanto a OS estiver aberta.
-- OS fechada: nem km nem tanque mudam (a entrada daquela visita fica como está).
-- O teto da km (CHECK ordens_km_max) é o KM_MAX de src/lib/km.ts.
-- As opções estão também em src/lib/km.ts: se mudar aqui, mude lá.
--
-- Erros: OS005 = sem km; OS006 = km travada (orçamento já enviado);
-- OS007 = OS fechada (km e tanque não mudam).

-- ---------------------------------------------------------------------------
-- Colunas
-- ---------------------------------------------------------------------------

alter table public.ordens
  add column tanque text constraint ordens_tanque_opcoes
    check (tanque in ('reserva', '1/4', '1/2', '3/4', 'cheio'));

-- insert: criar_ordem é security invoker (grava com as permissões do usuário).
grant insert (tanque) on public.ordens to authenticated;
grant update (tanque) on public.ordens to authenticated;

-- Cópia da km no momento da resposta (null nas respostas de antes deste ticket).
alter table public.orcamento_respostas add column km integer;

-- ---------------------------------------------------------------------------
-- Regras de km e tanque (vale para as funções e para o acesso direto à tabela)
-- ---------------------------------------------------------------------------

create function public.conferir_km_tanque()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.km is null then
      raise exception 'Informe a km de entrada.' using errcode = 'OS005';
    end if;
    return new;
  end if;

  -- Salvar sem mudar nada não conta.
  if (new.km, new.tanque) is not distinct from (old.km, old.tanque) then
    return new;
  end if;

  if old.status in ('entregue', 'cancelada') then
    raise exception 'OS fechada: a entrada não muda mais.' using errcode = 'OS007';
  end if;

  if new.km is distinct from old.km then
    if new.km is null then
      raise exception 'Informe a km de entrada.' using errcode = 'OS005';
    end if;
    -- O RLS de orcamentos vale aqui (security invoker): é o da mesma OS.
    if exists (
      select 1 from public.orcamentos o
      where o.ordem_id = new.id and o.enviado_em is not null
    ) then
      raise exception 'A km não muda depois que o orçamento foi enviado.' using errcode = 'OS006';
    end if;
  end if;

  return new;
end;
$$;

create trigger conferir_km_tanque
  before insert or update of km, tanque on public.ordens
  for each row execute function public.conferir_km_tanque();

revoke execute on function public.conferir_km_tanque() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- criar_ordem: ganha o tanque. A km obrigatória é conferida pelo trigger.
-- Mesmo corpo da migração *_criar_ordem.sql, só a assinatura e o insert mudam.
-- ---------------------------------------------------------------------------

drop function public.criar_ordem(text, text, text, text, text, integer, text, boolean);

create function public.criar_ordem(
  placa text,
  modelo text,
  nome text,
  telefone text,
  problema text,
  km integer default null,
  obs_interna text default null,
  trocar_dono boolean default null,
  tanque text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  carro public.veiculos%rowtype;
  dono public.clientes%rowtype;
  cliente uuid;
  ordem_id uuid;
begin
  if public.minha_oficina() is null then
    raise exception 'Precisa ter uma oficina.' using errcode = '42501';
  end if;

  -- Antes de mexer em cliente e veículo (o trigger também confere).
  if criar_ordem.km is null then
    raise exception 'Informe a km de entrada.' using errcode = 'OS005';
  end if;

  select v.* into carro from public.veiculos v where v.placa = criar_ordem.placa;

  if carro.id is not null then
    if exists (
      select 1 from public.ordens o
      where o.veiculo_id = carro.id and o.status not in ('entregue', 'cancelada')
    ) then
      raise exception 'Este carro já tem uma OS aberta.' using errcode = 'OS001';
    end if;

    select c.* into dono from public.clientes c where c.id = carro.cliente_id;

    if dono.telefone = criar_ordem.telefone and dono.nome = criar_ordem.nome then
      cliente := dono.id;
    elsif criar_ordem.trocar_dono is null then
      raise exception 'O carro está no nome de outro cliente: confirme a troca de dono.'
        using errcode = 'OS002';
    elsif not criar_ordem.trocar_dono then
      cliente := dono.id;
    end if;
  end if;

  if cliente is null then
    select c.id into cliente
    from public.clientes c
    where c.telefone = criar_ordem.telefone
    order by c.created_at, c.id
    limit 1;

    if cliente is null then
      insert into public.clientes (nome, telefone)
      values (criar_ordem.nome, criar_ordem.telefone)
      returning id into cliente;
    elsif criar_ordem.trocar_dono then
      update public.clientes c set nome = criar_ordem.nome
      where c.id = cliente and c.nome <> criar_ordem.nome;
    end if;
  end if;

  if carro.id is null then
    insert into public.veiculos (placa, modelo, cliente_id)
    values (criar_ordem.placa, criar_ordem.modelo, cliente)
    returning * into carro;
  else
    update public.veiculos v set modelo = criar_ordem.modelo, cliente_id = cliente
    where v.id = carro.id;
  end if;

  insert into public.ordens (veiculo_id, cliente_id, problema, km, tanque, obs_interna)
  values (carro.id, cliente, criar_ordem.problema, criar_ordem.km, criar_ordem.tanque, criar_ordem.obs_interna)
  returning id into ordem_id;

  return ordem_id;
end;
$$;

revoke execute on function public.criar_ordem(text, text, text, text, text, integer, text, boolean, text)
  from public, anon;
grant execute on function public.criar_ordem(text, text, text, text, text, integer, text, boolean, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- confirmar_pre_cadastro: o mecânico anota km (obrigatória) e tanque ao
-- confirmar, com o carro na oficina. Mesmo corpo da migração *_pre_cadastro.sql.
-- ---------------------------------------------------------------------------

drop function public.confirmar_pre_cadastro(uuid, boolean);

create function public.confirmar_pre_cadastro(
  id uuid,
  trocar_dono boolean default null,
  km integer default null,
  tanque text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  oficina uuid := public.minha_oficina();
  pre public.pre_cadastros%rowtype;
  carro public.veiculos%rowtype;
  dono public.clientes%rowtype;
  cliente uuid;
  nova_ordem uuid;
begin
  if oficina is null then
    raise exception 'Precisa ter uma oficina.' using errcode = '42501';
  end if;

  if confirmar_pre_cadastro.km is null then
    raise exception 'Informe a km de entrada.' using errcode = 'OS005';
  end if;

  select p.* into pre
  from public.pre_cadastros p
  where p.id = confirmar_pre_cadastro.id and p.oficina_id = oficina and p.situacao = 'pendente'
  for update;

  if pre.id is null then
    raise exception 'Pré-cadastro não encontrado.' using errcode = 'P0002';
  end if;

  select v.* into carro from public.veiculos v where v.oficina_id = oficina and v.placa = pre.placa;

  if carro.id is not null then
    if exists (
      select 1 from public.ordens o
      where o.veiculo_id = carro.id and o.status not in ('entregue', 'cancelada')
    ) then
      raise exception 'Este carro já tem uma OS aberta.' using errcode = 'OS001';
    end if;

    select c.* into dono from public.clientes c where c.id = carro.cliente_id;

    if dono.telefone = pre.telefone and dono.nome = pre.nome then
      cliente := dono.id;
    elsif confirmar_pre_cadastro.trocar_dono is null then
      raise exception 'O carro está no nome de outro cliente: confirme a troca de dono.'
        using errcode = 'OS002';
    elsif not confirmar_pre_cadastro.trocar_dono then
      cliente := dono.id;
    end if;
  end if;

  if cliente is null then
    select c.id into cliente
    from public.clientes c
    where c.oficina_id = oficina and c.telefone = pre.telefone
    order by c.created_at, c.id
    limit 1;

    if cliente is null then
      insert into public.clientes (oficina_id, nome, telefone)
      values (oficina, pre.nome, pre.telefone)
      returning clientes.id into cliente;
    elsif confirmar_pre_cadastro.trocar_dono then
      update public.clientes c set nome = pre.nome
      where c.id = cliente and c.nome <> pre.nome;
    end if;
  end if;

  if carro.id is null then
    insert into public.veiculos (oficina_id, placa, modelo, cliente_id)
    values (oficina, pre.placa, pre.modelo, cliente)
    returning * into carro;
  elsif carro.cliente_id <> cliente then
    update public.veiculos v set cliente_id = cliente where v.id = carro.id;
  end if;

  insert into public.ordens (oficina_id, veiculo_id, cliente_id, problema, origem, km, tanque)
  values (oficina, carro.id, cliente, pre.problema, 'link', confirmar_pre_cadastro.km, confirmar_pre_cadastro.tanque)
  returning ordens.id into nova_ordem;

  update public.pre_cadastros p
  set situacao = 'confirmado', ordem_id = nova_ordem
  where p.id = pre.id;

  return nova_ordem;
end;
$$;

revoke execute on function public.confirmar_pre_cadastro(uuid, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.confirmar_pre_cadastro(uuid, boolean, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Aprovação: a página mostra a km, e a resposta guarda uma cópia.
-- Mesmo corpo da migração *_aprovacao_publica.sql, com a km a mais.
-- ---------------------------------------------------------------------------

create or replace function public.ver_orcamento(token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'oficina', f.nome,
    'numero', os.numero,
    'placa', v.placa,
    'modelo', v.modelo,
    'km', os.km,
    'itens', public.itens_do_orcamento(o.id),
    'total_centavos', public.total_centavos(o),
    'estado', o.estado,
    'expirado', o.token_expira_em <= now()
  )
  from public.orcamentos o
  join public.ordens os on os.id = o.ordem_id
  join public.veiculos v on v.id = os.veiculo_id
  join public.oficinas f on f.id = o.oficina_id
  where o.token_hash = extensions.digest(ver_orcamento.token, 'sha256')
    and (o.estado <> 'enviado' or o.token_expira_em > now());
$$;

create or replace function public.responder_orcamento(token text, aprovar boolean, motivo text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  motivo_limpo text := case when aprovar then null else nullif(btrim(motivo), '') end;
  resposta text := case when aprovar then 'aprovado' else 'recusado' end;
  orcamento public.orcamentos;
begin
  if aprovar is null then
    raise exception 'Informe se aprova ou recusa.' using errcode = '22004';
  end if;
  if char_length(motivo_limpo) > 500 then
    raise exception 'O motivo pode ter no máximo 500 caracteres.' using errcode = '22001';
  end if;

  update public.orcamentos o
  set estado = resposta,
      respondido_em = now(),
      motivo_recusa = motivo_limpo
  where o.token_hash = extensions.digest(responder_orcamento.token, 'sha256')
    and o.estado = 'enviado'
    and o.token_expira_em > now()
  returning o.* into orcamento;

  if orcamento.id is null then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.orcamento_respostas
    (oficina_id, orcamento_id, resposta, total_centavos, itens, km, motivo, respondido_em)
  values (
    orcamento.oficina_id,
    orcamento.id,
    resposta,
    public.total_centavos(orcamento),
    public.itens_do_orcamento(orcamento.id),
    (select os.km from public.ordens os where os.id = orcamento.ordem_id),
    motivo_limpo,
    orcamento.respondido_em
  );

  return resposta;
end;
$$;

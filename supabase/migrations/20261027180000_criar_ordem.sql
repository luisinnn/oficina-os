-- Ticket 04: abrir OS no balcão numa transação só (cliente + veículo + OS).
--
-- Regras do dono do carro:
-- - Telefone identifica o cliente: o mesmo telefone na oficina é a mesma
--   pessoa. Cadastro existente nunca é renomeado sem confirmação.
-- - Placa nova: cliente do telefone digitado (reaproveita, mantendo o nome
--   cadastrado, ou cria).
-- - Placa existente com o mesmo nome e telefone do dono: segue com o dono.
-- - Placa existente com outro nome ou telefone: o app precisa perguntar
--   "Trocar dono?". Sem resposta (trocar_dono null) recusa com o código OS002.
--   Não (false): OS no dono atual, sem mexer no cadastro dele.
--   Sim (true): carro passa para o cliente daquele telefone (novo ou
--   existente), que fica com o nome digitado. Mesmo telefone do dono = só
--   corrige o nome dele.
-- - O modelo digitado sempre atualiza o carro (é correção do cadastro).
-- - Carro com OS aberta: recusa com o código OS001, antes de mudar qualquer coisa.
--
-- security invoker (o padrão): roda com as permissões e o RLS do usuário,
-- então só enxerga e grava na oficina dele. Os CHECKs das tabelas validam os
-- formatos; o número da OS vem do trigger numerar_ordem.

create function public.criar_ordem(
  placa text,
  modelo text,
  nome text,
  telefone text,
  problema text,
  km integer default null,
  obs_interna text default null,
  trocar_dono boolean default null
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

  -- O RLS já limita à oficina do usuário: placa de outra oficina não aparece.
  select v.* into carro from public.veiculos v where v.placa = criar_ordem.placa;

  if carro.id is not null then
    -- "Aberta" = mesma regra do índice ordens_uma_aberta_por_veiculo.
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
    -- Placa nova ou troca de dono confirmada: cliente do telefone digitado.
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
      -- A pessoa confirmou "Trocar dono para <nome digitado>".
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

  insert into public.ordens (veiculo_id, cliente_id, problema, km, obs_interna)
  values (carro.id, cliente, criar_ordem.problema, criar_ordem.km, criar_ordem.obs_interna)
  returning id into ordem_id;

  return ordem_id;
end;
$$;

revoke execute on function public.criar_ordem(text, text, text, text, text, integer, text, boolean)
  from public, anon;
grant execute on function public.criar_ordem(text, text, text, text, text, integer, text, boolean)
  to authenticated;

-- Teto do km: o mesmo KM_MAX de src/lib/validacao-ordem.ts.
alter table public.ordens add constraint ordens_km_max check (km <= 9999999);

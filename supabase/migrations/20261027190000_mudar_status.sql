-- Ticket 05: mudar o status da OS, só por esta função.
--
-- Fluxo: aguardando → em_servico → pronto → entregue.
-- - Avança ou volta um passo (entregue não volta).
-- - Cancela de qualquer status aberto; cancelada não volta.
-- - Ao entrar em entregue grava entregue_em.
-- A mesma tabela está em src/lib/status-ordem.ts: se mudar aqui, mude lá.
--
-- O usuário não tem update em status nem em entregue_em (só em problema, km e
-- obs_interna: permissão por coluna da migração *_clientes_veiculos_ordens.sql).
-- Por isso a função é security definer e confere sozinha se a OS é da
-- oficina do usuário.
--
-- Erros: 42501 = sem oficina; P0002 = OS não existe (ou é de outra oficina);
-- OS003 = transição não permitida.

create function public.mudar_status(ordem_id uuid, novo_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  oficina uuid := public.minha_oficina();
  atual text;
begin
  if oficina is null then
    raise exception 'Precisa ter uma oficina.' using errcode = '42501';
  end if;

  -- "for update": dois toques ao mesmo tempo esperam um pelo outro, e o
  -- segundo já vê o status novo.
  select o.status into atual
  from public.ordens o
  where o.id = mudar_status.ordem_id and o.oficina_id = oficina
  for update;

  if atual is null then
    raise exception 'OS não encontrada.' using errcode = 'P0002';
  end if;

  if not (
    (novo_status = 'cancelada' and atual in ('aguardando', 'em_servico', 'pronto'))
    or (atual, novo_status) in (
      ('aguardando', 'em_servico'),
      ('em_servico', 'pronto'),
      ('pronto', 'entregue'),
      ('em_servico', 'aguardando'),
      ('pronto', 'em_servico')
    )
  ) then
    raise exception 'Não pode mudar de % para %.', atual, novo_status using errcode = 'OS003';
  end if;

  update public.ordens
  set status = novo_status,
      entregue_em = case when novo_status = 'entregue' then now() end
  where id = mudar_status.ordem_id;
end;
$$;

revoke execute on function public.mudar_status(uuid, text) from public, anon;
grant execute on function public.mudar_status(uuid, text) to authenticated;

-- Ticket 14: histórico das OS fechadas.
--
-- - ordens.cancelada_em: gravada pela mudar_status ao cancelar, como a
--   entregue_em. Sem grant de insert/update para authenticated (as permissões
--   de ordens são por coluna, então coluna nova já nasce protegida).
-- - View historico_ordens: OS entregues e canceladas (STATUS_FECHADOS em
--   src/lib/status-ordem.ts: se mudar aqui, mude lá), com a data em que
--   fecharam e o valor que o cliente aprovou. security_invoker = true: quem
--   lê passa pelo RLS das tabelas de baixo (só a própria oficina).
--
-- Valor = total da última resposta do cliente, se ela foi aprovação. É o que
-- o cliente aceitou: mexer no orçamento depois volta ele para rascunho, mas
-- não muda a resposta. Sem resposta, ou última resposta recusando: null.

alter table public.ordens add column cancelada_em timestamptz;

-- OS canceladas antes desta migração: a última mudança delas foi o cancelamento
-- (OS fechada não muda mais), então updated_at é a data mais próxima.
update public.ordens set cancelada_em = updated_at where status = 'cancelada';

alter table public.ordens
  add constraint ordens_cancelada_em_check check ((status = 'cancelada') = (cancelada_em is not null));

-- Mesma função do ticket 05 (migração *_mudar_status.sql), agora gravando
-- cancelada_em. Regras e erros iguais.
create or replace function public.mudar_status(ordem_id uuid, novo_status text)
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
      entregue_em = case when novo_status = 'entregue' then now() end,
      cancelada_em = case when novo_status = 'cancelada' then now() end
  where id = mudar_status.ordem_id;
end;
$$;

revoke execute on function public.mudar_status(uuid, text) from public, anon;
grant execute on function public.mudar_status(uuid, text) to authenticated;

create view public.historico_ordens
with (security_invoker = true)
as
select
  o.id,
  o.numero,
  o.status,
  coalesce(o.entregue_em, o.cancelada_em) as fechada_em,
  o.km,
  v.placa,
  v.modelo,
  c.nome as cliente,
  case when ultima.resposta = 'aprovado' then ultima.total_centavos end as valor_centavos
from public.ordens o
join public.veiculos v on v.id = o.veiculo_id
join public.clientes c on c.id = o.cliente_id
left join public.orcamentos orc on orc.ordem_id = o.id
left join lateral (
  select r.resposta, r.total_centavos
  from public.orcamento_respostas r
  where r.orcamento_id = orc.id
  order by r.respondido_em desc
  limit 1
) ultima on true
where o.status in ('entregue', 'cancelada');

revoke all on public.historico_ordens from public, anon, authenticated;
grant select on public.historico_ordens to authenticated;

-- A tela pede um mês por vez (ou as 50 mais recentes na busca).
create index ordens_fechada_em_idx
  on public.ordens (oficina_id, (coalesce(entregue_em, cancelada_em)) desc)
  where status in ('entregue', 'cancelada');

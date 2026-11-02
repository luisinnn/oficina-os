-- Ticket 07: enviar o orçamento (gera o link de aprovação).
--
-- - Gera um token aleatório de 32 bytes em base64url (43 caracteres) e grava
--   só o sha256 dele em orcamentos.token_hash. O token volta uma única vez,
--   para o app montar o link; não dá para recuperar depois.
-- - Reenviar gera outro token e o anterior para de funcionar (o hash dele
--   some). Se o cliente já tinha respondido, a resposta sai de orcamentos
--   (os CHECKs exigem isso no estado "enviado"); o histórico em
--   orcamento_respostas fica.
-- - Link vale 30 dias.
--
-- security definer: o usuário não tem update em orcamentos. A função confere
-- sozinha se a OS é da oficina do usuário.
--
-- Erros: 42501 = sem oficina; P0002 = OS não existe (ou é de outra oficina);
-- OS004 = orçamento sem itens.

create function public.enviar_orcamento(ordem_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  oficina uuid := public.minha_oficina();
  orcamento uuid;
  token text;
begin
  if oficina is null then
    raise exception 'Precisa ter uma oficina.' using errcode = '42501';
  end if;

  -- "for update": dois toques ao mesmo tempo esperam um pelo outro, e só o
  -- último token vale. Mexer em item ao mesmo tempo também espera.
  select o.id into orcamento
  from public.orcamentos o
  where o.ordem_id = enviar_orcamento.ordem_id and o.oficina_id = oficina
  for update;

  if orcamento is null then
    raise exception 'OS não encontrada.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.orcamento_itens i where i.orcamento_id = orcamento) then
    raise exception 'Orçamento sem itens.' using errcode = 'OS004';
  end if;

  -- base64 de 32 bytes = 44 caracteres com um "=" no final; o translate troca
  -- + e / por - e _ e tira o "=" (base64url, seguro dentro de URL).
  token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  update public.orcamentos
  set estado = 'enviado',
      token_hash = extensions.digest(token, 'sha256'),
      token_expira_em = now() + interval '30 days',
      enviado_em = now(),
      respondido_em = null,
      motivo_recusa = null
  where id = orcamento;

  return token;
end;
$$;

revoke execute on function public.enviar_orcamento(uuid) from public, anon;
grant execute on function public.enviar_orcamento(uuid) to authenticated;

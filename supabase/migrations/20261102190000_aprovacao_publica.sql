-- Ticket 08: página pública de aprovação (/aprovar/<token>).
--
-- O cliente não tem login: as duas funções abaixo são a única porta do
-- anônimo para o orçamento. Anônimo continua sem permissão em tabela.
-- - ver_orcamento(token): o que a página mostra, e nada além disso.
-- - responder_orcamento(token, aprovar, motivo): aprova ou recusa uma vez.
--
-- O token chega em texto e é comparado pelo sha256 (orcamentos.token_hash,
-- ticket 07). Token errado, anulado (edição ou reenvio volta token_hash para
-- null ou troca o hash), vencido ou já respondido dão a mesma resposta.
--
-- security definer: o anônimo não lê nem grava em orcamentos. As funções
-- filtram sozinhas pelo hash do token.
-- Limite do motivo igual a src/lib/aprovacao.ts: se mudar aqui, mude lá.

-- Itens no formato da página e do histórico, na ordem em que foram adicionados.
-- Interna: não é liberada para ninguém pela API.
create function public.itens_do_orcamento(orcamento uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tipo', i.tipo,
        'descricao', i.descricao,
        'quantidade', i.quantidade,
        'valor_unitario_centavos', i.valor_unitario_centavos
      )
      order by i.created_at, i.id
    ),
    '[]'::jsonb
  )
  from public.orcamento_itens i
  where i.orcamento_id = orcamento;
$$;

-- null = "não encontrado": token errado, anulado ou vencido sem resposta (os
-- três dão o mesmo resultado). Já respondido continua aparecendo depois do
-- prazo, para o cliente ver a resposta dada; aí vem com expirado = true.
-- Sem nome/telefone do cliente, ids ou observação interna.
create function public.ver_orcamento(token text)
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

-- Devolve o estado novo ('aprovado' ou 'recusado'). Falha com P0002
-- "Orçamento não encontrado." em qualquer outro caso.
--
-- Um único update com o estado na condição: dois toques ao mesmo tempo
-- disputam a mesma linha, o segundo espera o primeiro terminar, vê que já
-- não está "enviado" e não muda nada. Nada de ler, conferir e depois gravar.
-- O histórico (orcamento_respostas) entra na mesma transação.
create function public.responder_orcamento(token text, aprovar boolean, motivo text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Vazio vira null (os CHECKs não aceitam texto vazio). Aprovação não tem motivo.
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
    (oficina_id, orcamento_id, resposta, total_centavos, itens, motivo, respondido_em)
  values (
    orcamento.oficina_id,
    orcamento.id,
    resposta,
    public.total_centavos(orcamento),
    public.itens_do_orcamento(orcamento.id),
    motivo_limpo,
    orcamento.respondido_em
  );

  return resposta;
end;
$$;

-- Só o anônimo (a página pública) chama as duas. O usuário logado vê e muda
-- o orçamento pelo painel.
revoke execute on function public.itens_do_orcamento(uuid) from public, anon, authenticated;
revoke execute on function public.ver_orcamento(text) from public, anon, authenticated;
revoke execute on function public.responder_orcamento(text, boolean, text) from public, anon, authenticated;
grant execute on function public.ver_orcamento(text) to anon;
grant execute on function public.responder_orcamento(text, boolean, text) to anon;

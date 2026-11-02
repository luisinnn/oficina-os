-- Ticket 09: pré-cadastro público (/p/<codigo>) e confirmação no painel.
--
-- O cliente manda nome, telefone, placa, modelo e problema pelo link fixo da
-- oficina. Isso fica em pre_cadastros, separado de clientes/veiculos/ordens
-- de propósito: o que vem de fora só encosta no cadastro quando alguém da
-- oficina confirma.
--
-- Funções:
-- - nome_oficina_publico(codigo)        anon: só o nome, para o título da página;
-- - enviar_pre_cadastro(...)            anon: grava um pendente (com antispam);
-- - confirmar_pre_cadastro(id, trocar)  authenticated: vira OS "aguardando", origem "link";
-- - descartar_pre_cadastro(id)          authenticated;
-- - trocar_codigo_publico()             authenticated: link novo, o antigo morre na hora.
--
-- Formatos e limites iguais aos de clientes/veiculos/ordens e de
-- src/lib/formatos.ts e src/lib/validacao-ordem.ts: se mudar aqui, mude lá.

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table public.pre_cadastros (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100 and nome = btrim(nome)),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  placa text not null check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  modelo text not null check (char_length(modelo) between 1 and 60 and modelo = btrim(modelo)),
  problema text not null check (char_length(problema) between 1 and 1000 and problema = btrim(problema)),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'confirmado', 'descartado')),
  -- OS criada na confirmação. Confirmado sempre tem OS, e só ele tem.
  ordem_id uuid references public.ordens (id),
  created_at timestamptz not null default now(),
  check ((situacao = 'confirmado') = (ordem_id is not null))
);

-- Antispam: 1 pendente por placa em cada oficina (a função confere antes e
-- este índice segura dois envios ao mesmo tempo).
create unique index pre_cadastros_um_pendente_por_placa
  on public.pre_cadastros (oficina_id, placa) where situacao = 'pendente';
-- Contagem da última hora (antispam) e lista do painel.
create index pre_cadastros_oficina_created_idx on public.pre_cadastros (oficina_id, created_at);

-- ---------------------------------------------------------------------------
-- Funções públicas (anônimo)
-- ---------------------------------------------------------------------------

-- Nome da oficina do link, ou null se o código não existe (inclusive o
-- antigo, depois de "Gerar novo link").
create function public.nome_oficina_publico(codigo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.nome from public.oficinas o where o.codigo_publico = nome_oficina_publico.codigo;
$$;

-- Tira espaço, tab e quebra de linha das pontas, como o trim do JavaScript
-- (que também tira espaços Unicode raros; o app limpa antes, então não diverge).
-- Interna: não é liberada para ninguém pela API.
create function public.aparar(texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(texto, '^\s+|\s+$', '', 'g');
$$;

-- Grava o pré-cadastro e devolve só 'ok'. Erros:
-- - P0002 "Link inválido.": código que não existe;
-- - 22023 "Dados inválidos.": algum campo fora do formato (o app valida antes
--   e mostra o erro no campo; aqui é a garantia);
-- - PC001: 20 pré-cadastros na última hora nesta oficina;
-- - PC002: esta placa já tem um pré-cadastro pendente nesta oficina.
--
-- security definer: o anônimo não tem permissão na tabela.
create function public.enviar_pre_cadastro(
  codigo text,
  nome text,
  telefone text,
  placa text,
  modelo text,
  problema text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  oficina uuid;
  -- Mesma limpeza de src/lib/formatos.ts.
  nome_limpo text := public.aparar(nome);
  modelo_limpo text := public.aparar(modelo);
  problema_limpo text := public.aparar(problema);
  placa_limpa text := upper(regexp_replace(placa, '[[:space:]-]', '', 'g'));
  telefone_limpo text := regexp_replace(telefone, '[[:space:]().+-]', '', 'g');
begin
  -- "for update" trava a oficina até o fim da transação: dois envios ao mesmo
  -- tempo contam um depois do outro, e o limite por hora não estoura.
  select o.id into oficina
  from public.oficinas o
  where o.codigo_publico = enviar_pre_cadastro.codigo
  for update;

  if oficina is null then
    raise exception 'Link inválido.' using errcode = 'P0002';
  end if;

  -- 55 do Brasil junto (número copiado do WhatsApp), só se sobrar dígito demais.
  if char_length(telefone_limpo) > 11 and telefone_limpo like '55%' then
    telefone_limpo := substr(telefone_limpo, 3);
  end if;

  if coalesce(char_length(nome_limpo) between 1 and 100, false) is false
    or coalesce(telefone_limpo ~ '^[0-9]{10,11}$', false) is false
    or coalesce(placa_limpa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$', false) is false
    or coalesce(char_length(modelo_limpo) between 1 and 60, false) is false
    or coalesce(char_length(problema_limpo) between 1 and 1000, false) is false
  then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;

  -- Limitação aceita na v1: 20 envios falsos numa hora bloqueiam os clientes
  -- de verdade até a hora passar. Saída: "Gerar novo link" nas Configurações.
  if (
    select count(*) from public.pre_cadastros p
    where p.oficina_id = oficina and p.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Muitos pré-cadastros agora. Tente de novo mais tarde.' using errcode = 'PC001';
  end if;

  if exists (
    select 1 from public.pre_cadastros p
    where p.oficina_id = oficina and p.placa = placa_limpa and p.situacao = 'pendente'
  ) then
    raise exception 'Esta placa já tem um pré-cadastro esperando a oficina.' using errcode = 'PC002';
  end if;

  insert into public.pre_cadastros (oficina_id, nome, telefone, placa, modelo, problema)
  values (oficina, nome_limpo, telefone_limpo, placa_limpa, modelo_limpo, problema_limpo);

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções do painel (logado)
-- ---------------------------------------------------------------------------

-- Transforma o pré-cadastro em OS "aguardando" com origem "link" e devolve o
-- id da OS. Mesmas regras de dono do criar_ordem (ticket 04), com uma
-- diferença: o que veio de fora nunca muda o cadastro sem confirmação.
-- - Placa nova: cliente do telefone (reaproveita sem renomear, ou cria) e
--   veículo novo.
-- - Placa existente, mesmo nome e telefone do dono: OS no dono.
-- - Placa existente, outro dono: sem resposta (trocar_dono null) recusa com
--   OS002. Não (false): OS no dono atual. Sim (true): carro passa para o
--   cliente do telefone, que fica com o nome do pré-cadastro.
-- - Sem trocar dono, clientes e veiculos não mudam (nem o modelo).
-- - Carro com OS aberta: OS001, antes de mudar qualquer coisa.
-- - Não pendente ou de outra oficina: P0002.
--
-- security definer porque origem e situação não são liberadas para o
-- usuário. Por isso filtra sozinha pela oficina do usuário logado.
create function public.confirmar_pre_cadastro(id uuid, trocar_dono boolean default null)
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

  -- "for update": dois toques em Confirmar não criam duas OS.
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
    -- Placa nova ou troca de dono confirmada: cliente do telefone.
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
      -- A pessoa confirmou "Trocar dono para <nome do pré-cadastro>".
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

  insert into public.ordens (oficina_id, veiculo_id, cliente_id, problema, origem)
  values (oficina, carro.id, cliente, pre.problema, 'link')
  returning ordens.id into nova_ordem;

  update public.pre_cadastros p
  set situacao = 'confirmado', ordem_id = nova_ordem
  where p.id = pre.id;

  return nova_ordem;
end;
$$;

-- P0002 se não estiver pendente ou for de outra oficina.
create function public.descartar_pre_cadastro(id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pre_cadastros p
  set situacao = 'descartado'
  where p.id = descartar_pre_cadastro.id
    and p.oficina_id = public.minha_oficina()
    and p.situacao = 'pendente';

  if not found then
    raise exception 'Pré-cadastro não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

-- Código novo (mesmo default do ticket 02: 9 bytes aleatórios em base64url)
-- e devolve ele. O antigo deixa de achar a oficina na hora.
-- security definer: o usuário não pode mudar codigo_publico direto.
create function public.trocar_codigo_publico()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo text;
begin
  update public.oficinas o
  set codigo_publico = default
  where o.id = public.minha_oficina()
  returning o.codigo_publico into novo;

  if novo is null then
    raise exception 'Precisa ter uma oficina.' using errcode = '42501';
  end if;
  return novo;
end;
$$;

-- O Supabase libera execute para todo mundo em função nova: tira e devolve só
-- o que é de propósito. As públicas só para anon (a página usa um cliente
-- sem login, como o /aprovar).
revoke execute on function public.nome_oficina_publico(text) from public, anon, authenticated;
revoke execute on function public.aparar(text) from public, anon, authenticated;
revoke execute on function public.enviar_pre_cadastro(text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.confirmar_pre_cadastro(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.descartar_pre_cadastro(uuid) from public, anon, authenticated;
revoke execute on function public.trocar_codigo_publico() from public, anon, authenticated;

grant execute on function public.nome_oficina_publico(text) to anon;
grant execute on function public.enviar_pre_cadastro(text, text, text, text, text, text) to anon;
grant execute on function public.confirmar_pre_cadastro(uuid, boolean) to authenticated;
grant execute on function public.descartar_pre_cadastro(uuid) to authenticated;
grant execute on function public.trocar_codigo_publico() to authenticated;

-- ---------------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------------

-- Tudo pelas funções: o usuário logado só lê os da própria oficina.
revoke all on public.pre_cadastros from anon, authenticated;
grant select on public.pre_cadastros to authenticated;

alter table public.pre_cadastros enable row level security;

create policy "oficina lê os próprios pré-cadastros"
  on public.pre_cadastros for select to authenticated
  using (oficina_id = (select public.minha_oficina()));

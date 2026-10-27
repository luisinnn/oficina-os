-- Ticket 02: oficinas e membros.
-- Toda conta pertence a uma oficina; o RLS das tabelas futuras se apoia em
-- public.minha_oficina().

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.oficinas (
  id uuid primary key default gen_random_uuid(),
  -- Mesmos limites de src/lib/validacao-oficina.ts.
  nome text not null check (char_length(nome) between 1 and 100 and nome = btrim(nome)),
  -- Só dígitos: DDD + número (10 fixo, 11 celular).
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  -- Código do link de pré-cadastro (/p/<codigo>). 9 bytes aleatórios em
  -- base64url = 12 caracteres, impossível de adivinhar. Para gerar um novo
  -- (ticket 09): update ... set codigo_publico = default.
  codigo_publico text not null unique
    default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_')
    check (char_length(codigo_publico) >= 10),
  proximo_numero_os integer not null default 1 check (proximo_numero_os >= 1),
  created_at timestamptz not null default now()
);

create table public.oficina_membros (
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  -- Chave primária = 1 oficina por usuário na v1.
  user_id uuid primary key references auth.users (id) on delete cascade,
  papel text not null default 'dono' check (papel = 'dono'),
  created_at timestamptz not null default now()
);

create index oficina_membros_oficina_id_idx on public.oficina_membros (oficina_id);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Oficina do usuário logado (ou null). security definer: lê oficina_membros
-- sem depender do RLS dela, e pode ser usada dentro das políticas.
create function public.minha_oficina()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.oficina_id from public.oficina_membros m where m.user_id = (select auth.uid());
$$;

-- Cria a oficina e coloca o usuário logado como dono, tudo na mesma transação.
-- É o único jeito de criar oficina (não há insert direto).
create function public.criar_oficina(nome text, telefone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
  nova uuid;
begin
  if usuario is null then
    raise exception 'Precisa estar logado.' using errcode = '42501';
  end if;

  if exists (select 1 from public.oficina_membros m where m.user_id = usuario) then
    raise exception 'Este usuário já tem uma oficina.';
  end if;

  -- Os CHECKs da tabela validam nome e telefone.
  insert into public.oficinas (nome, telefone)
  values (criar_oficina.nome, criar_oficina.telefone)
  returning id into nova;

  insert into public.oficina_membros (oficina_id, user_id, papel)
  values (nova, usuario, 'dono');

  return nova;
end;
$$;

-- O Supabase libera execute para todo mundo (inclusive anon) em função nova.
revoke execute on function public.minha_oficina() from public, anon;
revoke execute on function public.criar_oficina(text, text) from public, anon;
grant execute on function public.minha_oficina() to authenticated;
grant execute on function public.criar_oficina(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------------

-- O Supabase dá todas as permissões em tabela nova para anon e authenticated.
-- Tira tudo e devolve só o necessário. Permissão por coluna: o usuário só
-- consegue atualizar nome e telefone (a policy filtra linhas, não colunas).
revoke all on public.oficinas from anon, authenticated;
revoke all on public.oficina_membros from anon, authenticated;
grant select on public.oficinas to authenticated;
grant update (nome, telefone) on public.oficinas to authenticated;
grant select on public.oficina_membros to authenticated;

alter table public.oficinas enable row level security;
alter table public.oficina_membros enable row level security;

create policy "membro lê a própria oficina"
  on public.oficinas for select to authenticated
  using (id = (select public.minha_oficina()));

create policy "membro atualiza a própria oficina"
  on public.oficinas for update to authenticated
  using (id = (select public.minha_oficina()))
  with check (id = (select public.minha_oficina()));

create policy "usuário lê a própria linha de membro"
  on public.oficina_membros for select to authenticated
  using (user_id = (select auth.uid()));

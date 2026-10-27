-- =====================================================================
-- Cadastro de Clientes - schema do banco (Supabase / PostgreSQL)
-- Rode este arquivo inteiro no Supabase: Dashboard > SQL Editor > New query.
-- Pode rodar de novo sem quebrar nada (usa IF NOT EXISTS / DROP IF EXISTS).
-- =====================================================================

-- 1) Tabela de clientes
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 1 and 200),
  telefone    text,
  email       text,
  observacoes text,
  -- Dono do registro. O default preenche sozinho com o id do usuário logado,
  -- então o app nem precisa enviar esse campo no INSERT.
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Índice para acelerar a consulta mais comum: "clientes do usuário X".
create index if not exists clientes_user_id_idx on public.clientes (user_id);

-- Limites de tamanho dos campos opcionais. Impede que alguém logado grave
-- textos enormes chamando a API direto (sem passar pelo app).
-- Os mesmos números estão em src/lib/validacao-cliente.ts.
-- "drop ... if exists" + "add" = pode rodar de novo numa tabela que já existe.
alter table public.clientes drop constraint if exists clientes_telefone_tamanho;
alter table public.clientes add constraint clientes_telefone_tamanho
  check (char_length(telefone) <= 30);

alter table public.clientes drop constraint if exists clientes_email_tamanho;
alter table public.clientes add constraint clientes_email_tamanho
  check (char_length(email) <= 254);

alter table public.clientes drop constraint if exists clientes_observacoes_tamanho;
alter table public.clientes add constraint clientes_observacoes_tamanho
  check (char_length(observacoes) <= 2000);

-- 2) Liga o RLS (Row Level Security).
-- Com RLS ligado e SEM políticas, ninguém lê nada. As políticas abaixo
-- abrem acesso só às linhas cujo user_id é o do usuário logado.
alter table public.clientes enable row level security;

-- 3) Políticas: uma por operação.
-- "to authenticated" = vale só para quem está logado (anônimos ficam de fora).
-- USING      = filtro de quais linhas existentes o usuário enxerga/altera.
-- WITH CHECK = validação dos dados novos (impede gravar com user_id de outro).
-- "(select auth.uid())" em vez de "auth.uid()" é recomendação do Supabase:
-- o valor é calculado uma vez por consulta, não uma vez por linha.

drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own" on public.clientes
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own" on public.clientes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own" on public.clientes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own" on public.clientes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

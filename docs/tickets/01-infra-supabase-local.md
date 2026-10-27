# 01 — Infra: Supabase local e limpeza do template

**Rótulos:** infra · **Depende de:** —

## Objetivo

Deixar o projeto pronto para desenvolver contra um Supabase rodando no Docker,
com migrações versionadas, e remover o que é específico do template de clientes.

## Escopo

- Instalar a Supabase CLI como dependência de desenvolvimento (`npm i -D supabase`). **Pedir OK antes.**
- `npx supabase init` → cria `supabase/config.toml`.
- Pasta `supabase/migrations/` com arquivos numerados pela CLI. O `supabase/schema.sql` do template sai.
- Scripts no `package.json`:
  - `db:start` / `db:stop` → sobe e derruba o Supabase local.
  - `db:reset` → recria o banco local do zero rodando todas as migrações.
  - `test:db` → testes de integração que precisam do banco local (separados do `npm test`, que continua rápido e sem banco).
- `package.json`: `name` vira `oficina-os`.
- `.env.example` documenta as variáveis para rodar local (URL `http://127.0.0.1:54321` e a chave publishable que o `supabase start` mostra). Os valores vão só para o `.env.local`.
- Remover as telas e a lógica de `clientes` do template (`src/app/clientes/`, `src/lib/clientes.ts`, `src/lib/validacao-cliente*`). Manter login, cadastro, `auth/callback`, `proxy.ts` e `lib/supabase`.
- Rota provisória `/painel` (página vazia "Em construção") e redirecionamentos (`/`, pós-login, proxy) apontando para ela.
- CI: novo job `banco` que roda `supabase start` + `npm run test:db` (o Docker do GitHub Actions dá conta). O job atual continua igual.
- README reescrito para o oficina-os: o que é, como rodar local (Docker + `db:start` + `dev`), comandos.

## Critérios de aceite

- [ ] `npm run db:start` sobe o banco; o Studio local abre em `http://127.0.0.1:54323`.
- [ ] `npm run db:reset` roda sem erro (mesmo com zero migrações).
- [ ] `npm run dev`: cadastro → e-mail aparece na caixa falsa local (Mailpit) → login → cai em `/painel`.
- [ ] Nenhuma referência a "clientes do template" sobrando (`grep -ri clientes src` vazio, exceto o que for do domínio novo).
- [ ] `lint`, `typecheck`, `test`, `build` passam; job `banco` do CI verde com um teste "o banco responde".

## Fora do escopo

Tabelas do domínio (tickets 02 e 03).

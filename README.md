# oficina-os

Sistema de ordens de serviço (OS) para oficina mecânica de beira de estrada, pensado para usar no celular.

O que a v1 vai ter:

- abrir uma OS em menos de 1 minuto (placa, modelo, cliente, telefone, problema);
- acompanhar o status de cada carro;
- montar o orçamento e mandar pelo WhatsApp para o cliente aprovar por um link, sem login;
- receber pré-cadastro de clientes por um link fixo da oficina.

O planejamento está em [`docs/tickets/`](docs/tickets/README.md).

**Stack:** Next.js 16 (App Router, TypeScript) + Supabase (Auth + Postgres com RLS) + Tailwind CSS 4.

## Pré-requisitos

- Node.js 20.9 ou mais novo (`node -v`)
- Docker rodando (`docker info`). O Supabase local roda em contêineres.

## Como rodar local

Em desenvolvimento, o app usa **só o Supabase local** (no Docker), nunca o banco de produção.

```bash
npm install          # instala tudo, inclusive a Supabase CLI
npm run db:start     # sobe o Supabase local (a 1ª vez baixa as imagens, demora)
npx supabase status  # mostra a URL e as chaves locais
```

Crie o `.env.local` a partir do modelo e cole a chave **Publishable** que o `supabase status` mostrou:

```bash
cp .env.example .env.local
```

(No PowerShell: `Copy-Item .env.example .env.local`)

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e crie uma conta. O e-mail de confirmação não sai de verdade: ele cai no **Mailpit** (caixa de e-mail falsa local), em [http://127.0.0.1:54324](http://127.0.0.1:54324). Clique no link e você entra no `/painel`.

Endereços locais:

| O quê | Endereço |
| --- | --- |
| App | http://localhost:3000 |
| API do Supabase | http://127.0.0.1:54321 |
| Studio (painel do banco) | http://127.0.0.1:54323 |
| Mailpit (e-mails) | http://127.0.0.1:54324 |

> ⚠️ Nunca use a chave **secret** / **service_role** no app: ela ignora o RLS. O `.env.local` está no `.gitignore` e não vai para o Git.

## Banco de dados e migrações

O banco é definido por arquivos SQL em [`supabase/migrations/`](supabase/migrations), aplicados em ordem. Para criar uma migração nova:

```bash
npx supabase migration new nome_da_mudanca   # cria o arquivo vazio com data/hora no nome
npm run db:reset                             # recria o banco local do zero com todas as migrações
```

A configuração do Supabase local (auth, portas, senha mínima, confirmação de e-mail) fica em [`supabase/config.toml`](supabase/config.toml).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (recarrega ao salvar) |
| `npm run build` | Gera a versão de produção |
| `npm start` | Roda a versão de produção (depois do build) |
| `npm run lint` | Procura problemas no código (ESLint) |
| `npm run typecheck` | Checa os tipos do TypeScript |
| `npm test` | Testes rápidos, sem banco (Vitest, arquivos `src/**/*.test.ts`) |
| `npm run test:watch` | Mesmo que o anterior, repetindo a cada arquivo salvo |
| `npm run test:db` | Testes de integração contra o Supabase local (`tests/**/*.test.ts`). Criam contas de teste e confirmam o e-mail pelo Mailpit |
| `npm run db:start` | Sobe o Supabase local |
| `npm run db:stop` | Derruba o Supabase local (os dados ficam guardados) |
| `npm run db:reset` | Apaga o banco local e recria rodando todas as migrações |

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda a cada push na `main` e em todo pull request, com dois jobs:

- **verificar:** lint → tipos → testes → build.
- **banco:** sobe o Supabase local no runner do GitHub, aplica as migrações e roda `npm run test:db`.

## Estrutura do projeto

```
docs/tickets/                 Planejamento da v1 (um arquivo por ticket)
supabase/config.toml          Configuração do Supabase local
supabase/migrations/          Migrações SQL do banco (versionadas)
tests/                        Testes de integração com o banco (npm run test:db)
vitest.config.mts             Testes rápidos (npm test)
vitest.db.config.mts          Testes de banco: lê URL e chave do "supabase status"
src/proxy.ts                  Roda antes de cada página: renova a sessão e barra quem não está logado
src/lib/supabase/server.ts    Cria o cliente Supabase no servidor (lê/grava a sessão nos cookies)
src/lib/auth.ts               getUsuario(): quem está logado? (ou redireciona para /login)
src/lib/oficina.ts            getOficina(): oficina do usuário (ou redireciona para /onboarding)
src/lib/validacao-oficina.ts  Validação de nome e WhatsApp da oficina (com testes ao lado)
src/components/               Componentes usados em mais de uma tela
next.config.ts                "/" → redireciona para /painel
src/app/login/                Tela de login/cadastro + ações entrar, cadastrar, sair
src/app/auth/callback/        Recebe o link de confirmação do e-mail e cria a sessão
src/app/onboarding/           Primeira tela após o cadastro: nome e WhatsApp da oficina
src/app/painel/               Área logada da oficina (configurações em painel/configuracoes)
```

## Observações sobre o Next.js 16

- O antigo `middleware.ts` agora se chama **`proxy.ts`**.
- O projeto usa **Cache Components** (`next.config.ts`): tudo o que depende do usuário logado (cookies) fica dentro de um `<Suspense>`, e o restante da página aparece na hora.
- O arquivo `AGENTS.md` foi gerado pelo Next para orientar assistentes de IA. Pode manter.

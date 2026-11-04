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
| `npm run test:navegador` | Lista manual de segurança num navegador de verdade (Playwright). Precisa do `npm run dev` rodando |
| `npm run test:producao` | A mesma lista contra a **produção**, com duas contas de teste criadas no painel do Supabase (`CONTA_A`, `CONTA_B`, `SENHA_CONTAS`). Cria dados de verdade: depois, apague as contas e as oficinas de teste (ver `vitest.producao.config.mts`) |
| `npm run db:start` | Sobe o Supabase local |
| `npm run db:stop` | Derruba o Supabase local (os dados ficam guardados) |
| `npm run db:reset` | Apaga o banco local e recria rodando todas as migrações |

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda a cada push na `main` e em todo pull request, com dois jobs:

- **verificar:** lint → tipos → testes → build.
- **banco:** sobe o Supabase local no runner do GitHub, aplica as migrações e roda `npm run test:db`.

## Deploy

**Produção:** https://superautomec.com.br

O app roda em Docker numa VPS (t3.micro com IP fixo), com o [Caddy](https://caddyserver.com) na frente para o HTTPS (certificado Let's Encrypt automático). O banco é um projeto Supabase na nuvem (região São Paulo).

Como funciona: cada push na `main` roda o CI. Se ele passar, o [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) faz o build da imagem Docker (no GitHub, porque a VPS tem pouca memória para o build do Next), publica em `ghcr.io/luisinnn/oficina-os:<commit>` e entra por SSH na VPS. A chave de deploy só consegue rodar o [`deploy/deploy.sh`](deploy/deploy.sh), que baixa o `compose.yml` e o `Caddyfile` daquele commit e sobe a imagem nova. Também dá para publicar na mão pelo botão **Run workflow** (aba Actions → Deploy).

### 1. Supabase (uma vez)

1. Criar o projeto em [supabase.com](https://supabase.com), região **South America (São Paulo)**. Guardar a senha do banco no gerenciador de senhas. Conferir em Settings → Infrastructure se o Postgres é o **17** (é o `PG_VERSAO` do backup.yml).
2. Aplicar as migrações:
   ```bash
   npx supabase login
   npx supabase link --project-ref <id do projeto>
   npx supabase db push
   ```
3. Authentication → URL Configuration: **Site URL** `https://<domínio>` e, em Redirect URLs, só `https://<domínio>/auth/callback`.
4. Authentication → Sign In / Providers → Email: **Confirm email** ligado, senha mínima **8**.
5. O e-mail padrão do Supabase só entrega para os membros do time do projeto (e poucos por hora). Por isso, as contas (a do primo e as de teste) são criadas em Authentication → Users → **Add user → Create new user**, com **Auto Confirm User** marcado. A tela de login não tem cadastro, e em Authentication → Sign In / Providers o **Allow new users to sign up** fica **desligado**: assim ninguém cria conta nem pela API. Para cadastro aberto, seria preciso religar isso, configurar um SMTP próprio e voltar o formulário de cadastro (fora da v1).
6. No plano grátis, o Supabase pausa o projeto depois de 7 dias sem uso. O uso diário da oficina evita isso. Se o projeto pausar (por exemplo, nas férias), dá para reativar no painel do Supabase.

### 2. VPS (uma vez)

1. **Security group:** liberar 80/TCP, 443/TCP e 443/UDP para todos. A porta 22 também precisa aceitar o GitHub Actions (os IPs dele mudam), então use só login por chave (`PasswordAuthentication no`).
2. **DNS:** registro `A` do domínio apontando para o IP fixo da VPS.
3. Instalar o Docker Engine com o plugin compose ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/)) e preparar o usuário e a pasta:
   ```bash
   sudo useradd -m -s /bin/bash deploy
   sudo usermod -aG docker deploy
   sudo install -d -o deploy -g deploy /opt/oficina-os
   sudo -u deploy curl -fsSL -o /opt/oficina-os/deploy.sh \
     https://raw.githubusercontent.com/luisinnn/oficina-os/main/deploy/deploy.sh
   sudo chmod 755 /opt/oficina-os/deploy.sh
   echo "DOMINIO=<domínio>" | sudo -u deploy tee /opt/oficina-os/config.env
   ```
   O `deploy.sh` da VPS **não** se atualiza sozinho. Se ele mudar no repo, repita o `curl`.
4. **Chave de deploy** (no seu PC, numa pasta fora do repo):
   ```bash
   ssh-keygen -t ed25519 -N "" -C github-deploy -f oficina-deploy
   ```
   Na VPS, em `/home/deploy/.ssh/authorized_keys` (pasta `700`, arquivo `600`, dono `deploy`), uma linha só:
   ```
   command="/opt/oficina-os/deploy.sh",restrict ssh-ed25519 AAAA... github-deploy
   ```
   Com `command=`, essa chave só roda o deploy, mesmo que vaze, e o `deploy.sh` só aceita commits que estão na `main`. O `deploy` está no grupo `docker`, então nunca dê a ele uma chave sem `command=`.
5. Impressão digital da VPS para o GitHub: `ssh-keyscan -t ed25519 <IP>`. Confira se bate com `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` (rodado na VPS).

### 3. GitHub (uma vez)

Settings → Secrets and variables → Actions:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Variable | `NEXT_PUBLIC_SUPABASE_URL` | `https://<id>.supabase.co` |
| Variable | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave **Publishable** (Settings → API Keys). Nunca a secret |
| Variable | `NEXT_PUBLIC_SITE_URL` | `https://<domínio>` (sem `/` no final) |
| Secret | `VPS_HOST` | IP fixo da VPS |
| Secret | `VPS_SSH_KEY` | conteúdo do arquivo `oficina-deploy` (a chave privada). Depois, apague o arquivo do PC |
| Secret | `VPS_KNOWN_HOSTS` | a linha do `ssh-keyscan` |
| Secret | `SUPABASE_DB_URL` e `BACKUP_PASSPHRASE` | ver [Backup](#backup) |

Enquanto faltar alguma das seis primeiras, o deploy fica pulado.

### 4. Primeiro deploy

1. Actions → Deploy → **Run workflow**.
2. Na primeira vez, a imagem pode nascer **privada** no GHCR, e aí a VPS não consegue baixar (`denied`/`unauthorized`). Nesse caso: perfil do GitHub → Packages → `oficina-os` → Package settings → **Change visibility → Public**, e rode o workflow de novo. Pode ser pública: a imagem não tem segredo, só as variáveis `NEXT_PUBLIC_*`, que já vão para o navegador.

### 5. Proteger a main (depois do primeiro deploy)

Daqui em diante, todo push na `main` vai para produção. Em Settings → Rules → Rulesets → **New branch ruleset**: alvo `main`, marcar **Require a pull request before merging** e **Require status checks to pass** com os dois jobs do CI ("Lint, tipos, testes e build" e "Banco local (Supabase) e testes de integração"), e **Block force pushes**. A partir daí, cada mudança vai num branch com pull request.

### No dia a dia

- Ver o que está no ar: `cat /opt/oficina-os/.env` (o `TAG` é o commit).
- Logs: `cd /opt/oficina-os && docker compose logs -f app`
- Voltar para uma versão anterior: `sudo -u deploy /opt/oficina-os/deploy.sh <sha completo do commit>` (a imagem de cada commit continua no GHCR).
- Testar a imagem no PC: `docker build -t oficina-os --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3005 .` e `docker run --rm -p 3005:3000 oficina-os`

## Backup

[`.github/workflows/backup.yml`](.github/workflows/backup.yml) roda toda segunda-feira (e pelo botão **Run workflow** na aba Actions). Ele faz o `pg_dump` dos dados de produção, criptografa com `gpg` e guarda como artefato por 30 dias. O repositório é público e qualquer pessoa logada baixa os artefatos: **sem a senha o arquivo não abre**.

- Segredos do GitHub (criados no ticket 12): `SUPABASE_DB_URL` (string do pooler em **modo sessão**, porta 5432) e `BACKUP_PASSPHRASE`. Sem eles o backup fica pulado. **Guarde a senha também fora do GitHub** (gerenciador de senhas): o GitHub não mostra o segredo de volta, e sem ela nenhum backup abre.
- O backup leva só os **dados** (tabelas do `public` + usuários do `auth`). A estrutura vem das migrações.
- **Lembrete mensal:** abrir a aba Actions → Backup e ver se o último backup tem menos de uma semana. O GitHub desliga workflows agendados depois de 60 dias sem atividade no repo. Se aparecer "This scheduled workflow is disabled", clicar em **Enable workflow** e rodar uma vez na mão. (Quando roda, o próprio workflow falha, e o GitHub manda e-mail, se o backup anterior tiver mais de 8 dias.)

### Como restaurar (no Supabase local)

1. Na aba Actions, abra a última execução do **Backup** e baixe o artefato `backup-AAAA-MM-DD` (vem um `.zip`). Descompacte: dentro está o `backup-AAAA-MM-DD.sql.gpg`.
2. Banco local vazio, só com a estrutura: `npm run db:start` e `npm run db:reset` (**apaga** os dados locais).
3. No **Git Bash**, na pasta do projeto (a senha é pedida sem aparecer na tela nem ficar no histórico):

   ```bash
   read -rsp "Senha do backup: " BACKUP_PASSPHRASE; echo; export BACKUP_PASSPHRASE
   MSYS_NO_PATHCONV=1 \
   DB_URL=postgresql://supabase_admin:postgres@127.0.0.1:5432/postgres \
   PSQL="docker exec -i supabase_db_oficina-os psql" \
     scripts/backup/restaurar.sh ~/Downloads/backup-AAAA-MM-DD.sql.gpg
   ```

   Se der erro (senha errada, arquivo corrompido, banco com dados), nada é gravado. Os usuários voltam com a mesma senha de login.
4. `npm run dev` e entre com um usuário da oficina para conferir.

Só para olhar o conteúdo: `gpg --decrypt backup-AAAA-MM-DD.sql.gpg > backup.sql`. Esse arquivo fica **sem criptografia**: apague depois e nunca coloque no repo.

## Estrutura do projeto

```
docs/tickets/                 Planejamento da v1 (um arquivo por ticket)
supabase/config.toml          Configuração do Supabase local
supabase/migrations/          Migrações SQL do banco (versionadas)
tests/                        Testes de integração com o banco (npm run test:db)
scripts/backup/               Gerar (pg_dump -> gpg) e restaurar (gpg -> psql) o backup
Dockerfile                    Imagem de produção (build no GitHub Actions)
deploy/                       Produção na VPS: compose.yml (app + Caddy), Caddyfile, deploy.sh
vitest.config.mts             Testes rápidos (npm test)
vitest.db.config.mts          Testes de banco: lê URL e chave do "supabase status"
src/proxy.ts                  Roda antes de cada página: renova a sessão e barra quem não está logado
src/lib/supabase/server.ts    Cria o cliente Supabase no servidor (lê/grava a sessão nos cookies)
src/lib/auth.ts               getUsuario(): quem está logado? (ou redireciona para /login)
src/lib/oficina.ts            getOficina(): oficina do usuário (ou redireciona para /onboarding)
src/lib/validacao-oficina.ts  Validação de nome e WhatsApp da oficina (com testes ao lado)
src/lib/formatos.ts           Placa e telefone: normalizar, validar e mostrar; data no fuso de SP
src/lib/validacao-ordem.ts    Validação do formulário da nova OS (com testes ao lado)
src/lib/status-ordem.ts       Status da OS: nomes na tela e transições (avançar, voltar, cancelar)
src/lib/dinheiro.ts           Reais <-> centavos: ler o valor digitado e mostrar "R$ 1.234,56"
src/lib/orcamento.ts          Orçamento: tipos de item, estados e validação do item
src/lib/ordens.ts             Leituras de OS, carro (por placa), cliente e orçamento para as telas
src/components/               Componentes usados em mais de uma tela
next.config.ts                "/" → redireciona para /painel
src/app/login/                Tela de login/cadastro + ações entrar, cadastrar, sair
src/app/auth/callback/        Recebe o link de confirmação do e-mail e cria a sessão
src/app/onboarding/           Primeira tela após o cadastro: nome e WhatsApp da oficina
src/app/painel/               Área logada: tela inicial (busca por placa + OS abertas)
src/app/painel/placa/[placa]/ Resultado da busca: dono, histórico, OS aberta ou "Placa nova"
src/app/painel/os/nova/       Nova OS (chama a função criar_ordem do banco)
src/app/painel/os/[id]/       Detalhe da OS: botões de status (função mudar_status) e orçamento
src/app/painel/os/[id]/itens/ Adicionar, editar e remover item do orçamento
src/app/painel/configuracoes/ Dados da oficina
```

## Observações sobre o Next.js 16

- O antigo `middleware.ts` agora se chama **`proxy.ts`**.
- O projeto usa **Cache Components** (`next.config.ts`): tudo o que depende do usuário logado (cookies) fica dentro de um `<Suspense>`, e o restante da página aparece na hora.
- O arquivo `AGENTS.md` foi gerado pelo Next para orientar assistentes de IA. Pode manter.

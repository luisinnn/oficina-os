# 11 — Backup semanal

**Rótulos:** infra · **Depende de:** 01 (ativado de verdade no 12)

## Objetivo

Ter cópia dos dados da oficina fora da Supabase, já que o plano grátis não tem
backup que dê para baixar.

## Escopo

- Workflow `.github/workflows/backup.yml`: toda semana (`schedule`) e manual (`workflow_dispatch`).
- Passos: `pg_dump` do banco de produção → **criptografa** com `gpg --symmetric` (senha em segredo do GitHub) → sobe como artefato com retenção de 30 dias.
- **Por que criptografar:** o repositório é público, e artefatos de repositório público podem ser baixados por qualquer pessoa logada no GitHub. Sem criptografia o dump ficaria exposto.
- **Conexão:** usar a string do pooler em **modo sessão (porta 5432)**. O modo transação (porta 6543) não serve para o `pg_dump`.
- **Versão do cliente:** o `pg_dump` precisa ser da mesma versão principal do Postgres do Supabase ou mais nova. O workflow instala o `postgresql-client-<versão>` do repositório oficial do PostgreSQL (o que vem no runner pode ser mais velho) e imprime `pg_dump --version` no log.
- **Workflow agendado desativado:** o GitHub desliga workflows com `schedule` depois de 60 dias sem atividade no repositório, e o backup para sem avisar. Duas defesas:
  - o próprio workflow, quando roda, confere a data do último backup bem-sucedido e falha (e-mail do GitHub) se passou de 8 dias;
  - lembrete mensal do Luis: abrir a aba Actions e ver se o último backup tem menos de uma semana. Se o workflow estiver desativado, clicar em "Enable workflow".
- Segredos do GitHub: `SUPABASE_DB_URL` (pooler, modo sessão, porta 5432) e `BACKUP_PASSPHRASE`. Criados no ticket 12; até lá o workflow não roda (condição `if` checando o segredo).
- README: como restaurar (baixar artefato → `gpg --decrypt` → `psql` num banco local).

## Critérios de aceite

- [ ] Rodada manual gera artefato `.sql.gpg`; abrir sem a senha não mostra nada legível.
- [ ] Restauração testada no Supabase local a partir do artefato.
- [ ] Nenhum segredo aparece no log do Actions.

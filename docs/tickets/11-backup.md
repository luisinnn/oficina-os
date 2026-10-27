# 11 — Backup semanal

**Rótulos:** infra · **Depende de:** 01 (ativado de verdade no 12)

## Objetivo

Ter cópia dos dados da oficina fora da Supabase, já que o plano grátis não tem
backup que dê para baixar.

## Escopo

- Workflow `.github/workflows/backup.yml`: toda semana (`schedule`) e manual (`workflow_dispatch`).
- Passos: `pg_dump` do banco de produção → **criptografa** com `gpg --symmetric` (senha em segredo do GitHub) → sobe como artefato com retenção de 30 dias.
- **Por que criptografar:** o repositório é público, e artefatos de repositório público podem ser baixados por qualquer pessoa logada no GitHub. Sem criptografia o dump ficaria exposto.
- Segredos do GitHub: `SUPABASE_DB_URL` (string de conexão do pooler) e `BACKUP_PASSPHRASE`. Criados no ticket 12; até lá o workflow não roda (condição `if` checando o segredo).
- README: como restaurar (baixar artefato → `gpg --decrypt` → `psql` num banco local).

## Critérios de aceite

- [ ] Rodada manual gera artefato `.sql.gpg`; abrir sem a senha não mostra nada legível.
- [ ] Restauração testada no Supabase local a partir do artefato.
- [ ] Nenhum segredo aparece no log do Actions.

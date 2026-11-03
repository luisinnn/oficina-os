#!/usr/bin/env bash
# Backup do banco (ticket 11): pg_dump dos dados -> gpg com senha -> arquivo.
#
# Uso: DB_URL=... BACKUP_PASSPHRASE=... scripts/backup/gerar.sh saida.sql.gpg
#   DB_URL             conexão com o banco (produção: pooler em modo sessão, porta 5432)
#   BACKUP_PASSPHRASE  senha da criptografia (sem ela o arquivo não abre)
#   PG_DUMP            opcional: comando do pg_dump (padrão "pg_dump")
#
# O que vai no backup: só os DADOS (a estrutura vem das migrações do repo).
# Todas as tabelas do schema public + auth.users e auth.identities (logins).
# Sessões, tokens e logs do auth ficam de fora: depois de restaurar, cada um
# entra de novo com a senha.
#
# O SQL sai do pg_dump direto para o gpg: o backup sem criptografia nunca é
# gravado em disco. A senha do gpg vai por um descritor de arquivo, nunca na
# linha de comando (que aparece em listas de processos). A DB_URL (que tem a
# senha do banco) vai como argumento do pg_dump: no runner do GitHub, que é
# descartável e só roda este job, isso não é exposição.
# Sem "set -x" aqui: ele imprimiria os segredos no log.
set -euo pipefail

saida="${1:?informe o arquivo de saída (ex.: backup.sql.gpg)}"
: "${DB_URL:?defina DB_URL}"
if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "defina BACKUP_PASSPHRASE" >&2
  exit 1
fi
read -r -a pg_dump <<< "${PG_DUMP:-pg_dump}"

# Grava num arquivo temporário e só renomeia no fim: se algo falhar no meio,
# não sobra um backup pela metade com cara de bom.
temp="${saida}.parcial"
trap 'rm -f "$temp"' EXIT

"${pg_dump[@]}" \
  --data-only \
  --no-owner \
  --no-privileges \
  --table='public.*' \
  --table=auth.users \
  --table=auth.identities \
  --dbname="$DB_URL" |
  gpg --batch --quiet --yes --no-symkey-cache --pinentry-mode loopback \
    --passphrase-fd 3 --symmetric --cipher-algo AES256 \
    --output "$temp" 3< <(printf '%s' "$BACKUP_PASSPHRASE")

mv "$temp" "$saida"
trap - EXIT
echo "backup gerado: $saida ($(wc -c < "$saida") bytes)"

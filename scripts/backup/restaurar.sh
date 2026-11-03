#!/usr/bin/env bash
# Restaura um backup do gerar.sh (ticket 11): gpg --decrypt -> psql.
#
# Uso: DB_URL=... BACKUP_PASSPHRASE=... scripts/backup/restaurar.sh backup.sql.gpg
#   DB_URL             banco de destino, conectando como SUPERUSUÁRIO
#                      (Supabase local: supabase_admin, senha postgres)
#   BACKUP_PASSPHRASE  a mesma senha usada no backup
#   PSQL               opcional: comando do psql (padrão "psql")
#
# O destino precisa ter a estrutura (migrações aplicadas) e as tabelas vazias,
# por exemplo um Supabase local logo depois do "npm run db:reset".
#
# Primeiro decifra o arquivo inteiro: o gpg só confere se o arquivo está
# íntegro no fim, então mandar direto para o psql poderia carregar metade de
# um arquivo corrompido. O SQL decifrado fica numa pasta temporária só do
# usuário e é apagado ao sair, mesmo com erro.
#
# A carga roda numa transação só: se der qualquer erro (linha repetida...),
# nada é gravado. Os triggers ficam desligados durante a carga
# (session_replication_role = replica, por isso o superusuário): sem isso o
# banco renumeraria as OS e criaria orçamentos repetidos.
set -euo pipefail

entrada="${1:?informe o arquivo do backup (.sql.gpg)}"
: "${DB_URL:?defina DB_URL}"
if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "defina BACKUP_PASSPHRASE" >&2
  exit 1
fi
read -r -a psql <<< "${PSQL:-psql}"

umask 077
pasta=$(mktemp -d)
trap 'rm -rf "$pasta"' EXIT
sql="$pasta/backup.sql"

gpg --batch --quiet --no-symkey-cache --pinentry-mode loopback \
  --passphrase-fd 3 --decrypt --output "$sql" "$entrada" 3< <(printf '%s' "$BACKUP_PASSPHRASE")

"${psql[@]}" --no-psqlrc --quiet -v ON_ERROR_STOP=1 --single-transaction \
  --command 'SET session_replication_role = replica' \
  --file - \
  --dbname="$DB_URL" < "$sql"

echo "backup restaurado: $entrada"

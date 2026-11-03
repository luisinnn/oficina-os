#!/usr/bin/env bash
# Deploy na VPS (ticket 12). Roda NA VPS, chamado pelo workflow deploy.yml por
# SSH. A chave de deploy só consegue rodar este script (command= no
# authorized_keys), e o commit chega pelo SSH_ORIGINAL_COMMAND.
#
# Uso manual (ex.: voltar para uma versão anterior):
#   /opt/oficina-os/deploy.sh <sha completo do commit>
#
# O que faz: baixa o compose.yml e o Caddyfile DESSE commit, grava o .env
# (config.env + TAG=<commit>) e sobe a imagem ghcr.io/luisinnn/oficina-os:<commit>.
#
# Arquivos na pasta (PASTA, padrão /opt/oficina-os):
#   config.env   criado à mão uma vez: DOMINIO=oficina.exemplo.com.br
#   .env         gerado aqui; com ele "docker compose ps/logs" funciona direto
set -euo pipefail

tag="${1:-${SSH_ORIGINAL_COMMAND:-}}"
# Só o SHA completo: nada de nome de branch nem texto extra vindo pelo SSH.
if ! [[ "$tag" =~ ^[0-9a-f]{40}$ ]]; then
  echo "uso: deploy.sh <sha completo do commit (40 caracteres)>" >&2
  exit 2
fi

cd "${PASTA:-/opt/oficina-os}"
if [[ ! -s config.env ]]; then
  echo "falta o config.env nesta pasta (DOMINIO=...)" >&2
  exit 1
fi

# Só commits que estão na main. Sem isso, quem tivesse a chave poderia
# apontar para um commit de um fork (o GitHub serve os dois pelo mesmo
# endereço) com um compose.yml que monta o disco da VPS.
# compare main...<commit>: "behind" = o commit é anterior à main; "identical"
# = é a própria main. O primeiro "status" da resposta é o da comparação.
repo="luisinnn/oficina-os"
status=$(curl -fsSL "https://api.github.com/repos/$repo/compare/main...$tag" |
  grep -m1 -o '"status": *"[a-z]*"' | grep -o '[a-z]*"$' | tr -d '"')
if [[ "$status" != behind && "$status" != identical ]]; then
  echo "o commit $tag não está na main ($status)" >&2
  exit 1
fi

# Baixa tudo primeiro em arquivos .novo e baixa a imagem com eles. Só troca
# se tudo deu certo: se algo falhar, o .env continua dizendo o que está no ar.
base="https://raw.githubusercontent.com/$repo/$tag/deploy"
trap 'rm -f compose.yml.novo Caddyfile.novo .env.novo' EXIT
for arquivo in compose.yml Caddyfile; do
  curl -fsSL --retry 3 -o "$arquivo.novo" "$base/$arquivo"
done
{ cat config.env; echo "TAG=$tag"; } > .env.novo
docker compose --env-file .env.novo -f compose.yml.novo pull

mv compose.yml.novo compose.yml
mv Caddyfile.novo Caddyfile
mv .env.novo .env

docker compose up -d --remove-orphans
# Apaga as imagens velhas deste app (o disco da VPS é pequeno). O filtro pela
# label do build não deixa apagar imagens de outros containers da VPS.
docker image prune -af --filter "label=org.opencontainers.image.source=https://github.com/$repo"
echo "no ar: $tag"

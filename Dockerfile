# Imagem de produção (ticket 12). Gerada no GitHub Actions (deploy.yml), não
# na VPS: o build do Next precisa de mais memória que a t3.micro tem.
#
# As NEXT_PUBLIC_* entram no build (o Next grava os valores no código). Elas
# são públicas por natureza; nunca passar aqui a chave secret/service_role.

FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Sem as três variáveis o site sobe quebrado: melhor falhar aqui.
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" && test -n "$NEXT_PUBLIC_SITE_URL" \
  || { echo "faltam as variáveis NEXT_PUBLIC_*" >&2; exit 1; }
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Só o necessário para rodar (output: "standalone" no next.config.ts).
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ═══════════════════════════════════════════════════════════
# DevOps Map Brasil — Dockerfile (Multi-Stage Build)
# Semana DevOps — LINUXtips
# ═══════════════════════════════════════════════════════════

# ─── Stage 1: Instalar dependências ────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro (cache layer)
COPY package.json package-lock.json* ./

# Instala APENAS dependências de produção
RUN npm ci --only=production && npm cache clean --force

# ─── Stage 2: Imagem final de produção ────────────────────
FROM node:20-alpine AS production

# Labels OCI padrão (boas práticas de container)
LABEL org.opencontainers.image.title="DevOps Map Brasil"
LABEL org.opencontainers.image.description="App interativa da Semana DevOps - LINUXtips"
LABEL org.opencontainers.image.authors="Jeferson Fernando <jeferson@linuxtips.io>"
LABEL org.opencontainers.image.source="https://github.com/badtuxx/semana-devops"

# Criar usuário não-root (SEGURANÇA — nunca rode como root!)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copiar dependências instaladas do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar código da aplicação
COPY server.js ./
COPY public/ ./public/

# Mudar ownership para o usuário não-root
RUN chown -R appuser:appgroup /app

# Trocar para usuário não-root
USER appuser

# Expor a porta da aplicação
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Health check nativo do Docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Comando de inicialização
CMD ["node", "server.js"]

# ─── Stage 1: deps ─────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat git
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ─── Stage 2: builder ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建时注入占位环境变量（避免 build 时因缺少 env 而失败）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV GLM_API_KEY=placeholder
ENV AGENT_API_KEY=placeholder

RUN npm run build

# ─── Stage 3: runner ───────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache curl git

WORKDIR /app

# 非 root 用户运行（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# 只复制运行时必需文件（standalone 模式）
COPY --from=builder /app/public         ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static   ./.next/static

# 数据目录（ClawCompany 的 ~/.clawcompany）
RUN mkdir -p /data/.clawcompany /data/generated && chown -R nextjs:nodejs /data

USER nextjs

# ── 环境变量占位（运行时通过 docker run -e 或 Compose 注入）───
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# LLM 配置（运行时注入）
ENV GLM_API_KEY=""
ENV GLM_MODEL="glm-4"
ENV LLM_TEMPERATURE="0.7"
ENV LLM_MAX_TOKENS="2000"

# 安全配置（运行时注入）
ENV AGENT_API_KEY=""
ENV ENCRYPTION_KEY=""
ENV ENCRYPTION_SALT=""

# Gateway 配置（运行时注入）
ENV OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
ENV OPENCLAW_GATEWAY_TOKEN=""

# 数据目录（挂载持久化 Volume）
ENV HOME="/data"
ENV PROJECT_ROOT="/data/generated"

EXPOSE 3000

# ── Healthcheck ────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

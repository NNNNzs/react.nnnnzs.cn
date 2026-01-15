# ================================
# 生产环境 Dockerfile (多阶段构建)
# 用于 GitHub Actions 自动化部署
# ================================

# ===== 阶段 1: 依赖安装 =====
FROM node:22-alpine AS deps

# 安装 libc6-compat（某些包可能需要）
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 配置 pnpm 使用宿主机 4873 端口作为镜像源
RUN pnpm config set registry http://host.docker.internal:4873

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml* ./

# 安装生产依赖
RUN pnpm install --frozen-lockfile --prod=false


# ===== 阶段 2: 构建应用 =====
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 配置 pnpm 使用宿主机 4873 端口作为镜像源
RUN pnpm config set registry http://host.docker.internal:4873

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制所有项目文件
COPY . .

# 构建参数（用于版本信息）
ARG VERSION
ARG BUILD_DATE
ARG COMMIT_SHA

# 设置构建时环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 生成 Prisma Client（输出到自定义目录 src/generated/prisma-client）
RUN pnpm prisma generate

# 构建 Next.js 应用
RUN pnpm build

# 清理开发依赖，只保留生产依赖
# 注意：Prisma Client 已生成到 src/generated，不受 prune 影响
RUN pnpm prune --prod


# ===== 阶段 3: 生产运行 =====
FROM node:22-alpine AS runner

WORKDIR /app

# 安装 CA 证书和其他必要工具（解决 HTTPS 请求问题）
RUN apk add --no-cache \
    ca-certificates \
    wget \
    curl

# 设置为生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制必要的文件
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

# 创建必要的目录结构并设置权限（在切换用户之前）
# 确保 nextjs 用户有权限写入预渲染缓存
# 注意：在 standalone 模式下，.next/server/app 可能不存在于 standalone 输出中
# 我们需要创建这个目录，让 Next.js 运行时可以写入缓存文件
RUN mkdir -p logs .next/cache .next/server/app && \
    chown -R nextjs:nodejs logs .next

# 复制启动脚本
COPY docker-entrypoint-prod.sh /app/docker-entrypoint-prod.sh
RUN chmod +x /app/docker-entrypoint-prod.sh && \
    chown nextjs:nodejs /app/docker-entrypoint-prod.sh

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 重新声明构建参数（用于 LABEL）
ARG VERSION
ARG BUILD_DATE
ARG COMMIT_SHA

# 添加版本信息标签
LABEL version="${VERSION}" \
      build_date="${BUILD_DATE}" \
      commit="${COMMIT_SHA}" \
      maintainer="nnnnzs"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# 设置启动脚本为入口点
ENTRYPOINT ["/app/docker-entrypoint-prod.sh"]

# 默认启动命令（启动脚本会处理端口配置）
CMD []

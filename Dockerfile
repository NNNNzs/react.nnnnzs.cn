# 使用 Node.js 20 LTS 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装 pnpm 和 pm2
RUN npm install -g pnpm pm2

# 复制 package.json 和 pnpm-lock.yaml（如果存在）
COPY package.json pnpm-lock.yaml* ./

# 安装依赖（基础包）
# 如果 lockfile 过期，使用 --no-frozen-lockfile 重新生成
RUN pnpm install --no-frozen-lockfile || pnpm install

# 复制项目文件（目录全映射会在运行时覆盖，这里先复制用于构建）
COPY . .

# 构建 Next.js 应用
RUN pnpm build

# 暴露端口（默认 3301，可通过环境变量修改）
EXPOSE 3301

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3301

# 创建日志目录
RUN mkdir -p logs

# 复制启动脚本
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 设置启动脚本为入口点
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# 启动命令（已在 ENTRYPOINT 中处理）
CMD []


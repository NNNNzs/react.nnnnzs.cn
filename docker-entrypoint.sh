#!/bin/sh
# Docker 容器启动脚本
# 用于在容器启动时自动构建和启动应用

set -e

echo "🚀 启动 Next.js 应用..."

# 检查是否需要重新构建
if [ ! -d ".next" ] || [ "$FORCE_REBUILD" = "true" ]; then
  echo "📦 构建 Next.js 应用..."
  pnpm build
else
  echo "✅ 使用现有构建文件"
fi

# 启动 PM2（使用 no-daemon 模式保持容器运行）
echo "🎯 启动 PM2 进程管理器..."
exec pm2-runtime start ecosystem.config.cjs


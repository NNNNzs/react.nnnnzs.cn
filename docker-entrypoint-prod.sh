#!/bin/sh
# Docker 容器生产环境启动脚本
# 用于在容器启动时启动 Next.js 应用

set -e

echo "🚀 启动 Next.js 生产环境应用..."
echo "📦 版本信息:"
echo "   - Node 版本: $(node -v)"
echo "   - PM2 版本: $(pm2 -v)"
echo "   - 环境: ${NODE_ENV:-production}"
echo "   - 端口: ${PORT:-3301}"

# 启动 PM2（使用 no-daemon 模式保持容器运行）
echo "🎯 启动 PM2 进程管理器..."
exec pm2-runtime start ecosystem.config.cjs

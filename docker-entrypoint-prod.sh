#!/bin/sh
# Docker 容器生产环境启动脚本
# 直接启动 Next.js 应用（不使用 PM2）

set -e

echo "🚀 启动 Next.js 生产环境应用..."
echo "📦 版本信息:"
echo "   - Node 版本: $(node -v)"
echo "   - 环境: ${NODE_ENV:-production}"
echo "   - 端口: ${PORT:-3301}"

# 直接启动 Next.js（不使用 PM2）
echo "🎯 启动 Next.js 服务器..."
exec node server.js

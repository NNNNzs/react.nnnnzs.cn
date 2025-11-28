#!/bin/bash
# ================================
# Docker 镜像推送脚本
# 用于将本地构建的镜像推送到远程仓库
# ================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
IMAGE_NAME="react-nnnnzs-cn"
DEFAULT_TAG="latest"
REGISTRY=""

# 解析命令行参数
TAG="${DEFAULT_TAG}"

while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--tag)
      TAG="$2"
      shift 2
      ;;
    -r|--registry)
      REGISTRY="$2"
      shift 2
      ;;
    -h|--help)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  -t, --tag TAG           镜像标签 (默认: latest)"
      echo "  -r, --registry REGISTRY  镜像仓库地址 (必需)"
      echo "  -h, --help               显示帮助信息"
      echo ""
      echo "示例:"
      echo "  $0 -r docker.io/username              # 推送 latest 标签"
      echo "  $0 -r docker.io/username -t v1.0.0    # 推送 v1.0.0 标签"
      exit 0
      ;;
    *)
      echo -e "${RED}错误: 未知参数 $1${NC}"
      exit 1
      ;;
  esac
done

# 检查是否提供了仓库地址
if [ -z "$REGISTRY" ]; then
  echo -e "${RED}错误: 必须提供镜像仓库地址 (-r/--registry)${NC}"
  echo "使用 -h 或 --help 查看帮助信息"
  exit 1
fi

# 构建镜像名称
FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"

# 显示推送信息
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Docker 镜像推送${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "镜像名称: ${GREEN}${FULL_IMAGE_NAME}${NC}"
echo -e "标签: ${GREEN}${TAG}${NC}"
echo ""

# 检查本地镜像是否存在
if ! docker images | grep -q "${IMAGE_NAME}.*${TAG}"; then
  echo -e "${YELLOW}警告: 本地镜像 ${IMAGE_NAME}:${TAG} 不存在${NC}"
  echo -e "${YELLOW}请先运行构建脚本: ./scripts/build-docker.sh -t ${TAG}${NC}"
  exit 1
fi

# 标记镜像（如果需要）
LOCAL_IMAGE="${IMAGE_NAME}:${TAG}"
if [ "$LOCAL_IMAGE" != "${FULL_IMAGE_NAME}:${TAG}" ]; then
  echo -e "${BLUE}标记镜像...${NC}"
  docker tag "${LOCAL_IMAGE}" "${FULL_IMAGE_NAME}:${TAG}"
  echo -e "${GREEN}✅ 镜像标记完成${NC}"
  echo ""
fi

# 推送镜像
echo -e "${BLUE}推送镜像到 ${REGISTRY}...${NC}"
if docker push "${FULL_IMAGE_NAME}:${TAG}"; then
  echo ""
  echo -e "${GREEN}✅ 镜像推送成功!${NC}"
  echo ""
  echo -e "镜像地址: ${GREEN}${FULL_IMAGE_NAME}:${TAG}${NC}"
  echo ""
else
  echo ""
  echo -e "${RED}❌ 镜像推送失败!${NC}"
  echo ""
  echo -e "${YELLOW}提示:${NC}"
  echo "  1. 确保已登录到镜像仓库: docker login ${REGISTRY}"
  echo "  2. 检查网络连接"
  echo "  3. 确认有推送权限"
  exit 1
fi

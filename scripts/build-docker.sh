#!/bin/bash
# ================================
# 本地 Docker 镜像构建脚本
# 用于在本地构建生产环境的 Docker 镜像
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
DEFAULT_TAG="local"
DOCKERFILE="Dockerfile"
REGISTRY=""  # 默认为空，使用本地镜像

# 获取项目版本（从 package.json）
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "latest")

# 获取 Git 信息
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 解析命令行参数
TAG="${DEFAULT_TAG}"
PUSH=false
NO_CACHE=false
PLATFORM=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--tag)
      TAG="$2"
      shift 2
      ;;
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -r|--registry)
      REGISTRY="$2"
      shift 2
      ;;
    -p|--push)
      PUSH=true
      shift
      ;;
    --no-cache)
      NO_CACHE=true
      shift
      ;;
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    -h|--help)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  -t, --tag TAG           镜像标签 (默认: local)"
      echo "  -v, --version VERSION    版本号 (默认: 从 package.json 读取)"
      echo "  -r, --registry REGISTRY  镜像仓库地址 (例如: docker.io/username)"
      echo "  -p, --push               构建后推送到仓库"
      echo "  --no-cache               不使用 Docker 缓存"
      echo "  --platform PLATFORM      目标平台 (例如: linux/amd64)"
      echo "  -h, --help               显示帮助信息"
      echo ""
      echo "示例:"
      echo "  $0                                    # 构建 local 标签"
      echo "  $0 -t local                            # 构建 local 标签"
      echo "  $0 -r docker.io/username -p            # 构建并推送到 Docker Hub"
      echo "  $0 --platform linux/amd64 # 指定平台构建"
      exit 0
      ;;
    *)
      echo -e "${RED}错误: 未知参数 $1${NC}"
      exit 1
      ;;
  esac
done

# 构建镜像名称
if [ -n "$REGISTRY" ]; then
  FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"
else
  FULL_IMAGE_NAME="${IMAGE_NAME}"
fi

# 显示构建信息
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Docker 镜像构建${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "镜像名称: ${GREEN}${FULL_IMAGE_NAME}${NC}"
echo -e "标签: ${GREEN}${TAG}${NC}"
echo -e "版本: ${GREEN}${VERSION}${NC}"
echo -e "提交: ${GREEN}${COMMIT_SHA}${NC}"
echo -e "构建时间: ${GREEN}${BUILD_DATE}${NC}"
echo -e "Dockerfile: ${GREEN}${DOCKERFILE}${NC}"
if [ "$NO_CACHE" = true ]; then
  echo -e "缓存: ${YELLOW}禁用${NC}"
fi
if [ -n "$PLATFORM" ]; then
  echo -e "平台: ${GREEN}${PLATFORM}${NC}"
fi
echo ""

# 检查 Dockerfile 是否存在
if [ ! -f "$DOCKERFILE" ]; then
  echo -e "${RED}错误: Dockerfile 不存在: ${DOCKERFILE}${NC}"
  exit 1
fi

# 构建 Docker 命令
BUILD_CMD="docker build"

# 检测操作系统，为 Linux 添加 host.docker.internal 支持
# Mac/Windows 原生支持 host.docker.internal
# Linux 需要通过 --add-host 添加
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  BUILD_CMD="$BUILD_CMD --add-host=host.docker.internal:host-gateway"
fi

# 添加构建参数
BUILD_CMD="$BUILD_CMD --build-arg VERSION=${VERSION}"
BUILD_CMD="$BUILD_CMD --build-arg BUILD_DATE=${BUILD_DATE}"
BUILD_CMD="$BUILD_CMD --build-arg COMMIT_SHA=${COMMIT_SHA}"

# 添加标签（只使用 local 标签）
BUILD_CMD="$BUILD_CMD -t ${FULL_IMAGE_NAME}:local"

# 添加平台支持（多平台构建）
if [ -n "$PLATFORM" ]; then
  BUILD_CMD="$BUILD_CMD --platform ${PLATFORM}"
  if [ "$PUSH" = true ]; then
    BUILD_CMD="$BUILD_CMD --push"
  fi
fi

# 添加无缓存选项
if [ "$NO_CACHE" = true ]; then
  BUILD_CMD="$BUILD_CMD --no-cache"
fi

# 添加 Dockerfile 和构建上下文
BUILD_CMD="$BUILD_CMD -f ${DOCKERFILE} ."

# 执行构建
echo -e "${BLUE}开始构建镜像...${NC}"
echo -e "${YELLOW}执行命令: ${BUILD_CMD}${NC}"
echo ""

if eval "$BUILD_CMD"; then
  echo ""
  echo -e "${GREEN}✅ 镜像构建成功!${NC}"
  echo ""
  echo -e "镜像列表:"
  docker images | grep "${IMAGE_NAME}" | head -5
  echo ""
  
  # 如果不是多平台构建且需要推送，则执行推送
  if [ "$PUSH" = true ] && [ -z "$PLATFORM" ]; then
    echo -e "${BLUE}推送镜像到仓库...${NC}"
    docker push "${FULL_IMAGE_NAME}:local"
    echo -e "${GREEN}✅ 镜像推送成功!${NC}"
  fi
  
  echo ""
  echo -e "${GREEN}使用以下命令运行容器:${NC}"
  echo -e "  ${YELLOW}docker run -d -p 3301:3301 --name ${IMAGE_NAME} ${FULL_IMAGE_NAME}:local${NC}"
  echo ""
else
  echo ""
  echo -e "${RED}❌ 镜像构建失败!${NC}"
  exit 1
fi

#!/bin/bash
# Docker 快速部署脚本
# 用于在服务器上快速部署和更新应用

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
COMPOSE_FILE="docker-compose.prod.yml"
IMAGE_NAME="nnnnzs/react-nnnnzs-cn"
CONTAINER_NAME="react-nnnnzs-cn-prod"

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
}

# 检查 .env 文件
check_env() {
    if [ ! -f .env ]; then
        print_error ".env 文件不存在，请先创建环境变量文件"
        exit 1
    fi
}

# 登录 Docker Hub（如果需要）
login_registry() {
    # 如果提供了 Docker Hub 用户名和密码，则登录
    if [ -n "$DOCKERHUB_USERNAME" ] && [ -n "$DOCKERHUB_TOKEN" ]; then
        print_info "登录 Docker Hub..."
        echo "$DOCKERHUB_TOKEN" | docker login --username="$DOCKERHUB_USERNAME" --password-stdin docker.io || true
    fi
}

# 带重试的 docker pull
docker_pull_with_retry() {
    local image="$1"
    local max_retries="${2:-3}"
    local retry_delay="${3:-10}"
    local attempt=1

    while [ $attempt -le $max_retries ]; do
        print_info "拉取镜像 (尝试 ${attempt}/${max_retries})..."
        if docker pull "$image"; then
            print_info "✅ 镜像拉取成功"
            return 0
        fi

        if [ $attempt -lt $max_retries ]; then
            print_warn "⚠️  拉取失败，${retry_delay}秒后重试..."
            sleep $retry_delay
            # 每次重试增加延迟（指数退避）
            retry_delay=$((retry_delay * 2))
        fi
        attempt=$((attempt + 1))
    done

    print_error "❌ 镜像拉取失败，已重试 ${max_retries} 次"
    return 1
}

# 拉取最新镜像
pull_image() {
    print_info "正在拉取最新镜像..."
    login_registry
    # 使用 docker pull 而非 docker-compose pull，确保拿到真正的 latest
    # docker-compose pull 有时因为缓存认为镜像已是最新，不会实际拉取
    docker_pull_with_retry "${IMAGE_NAME}:latest" 3 10
}

# 停止旧容器
stop_old() {
    print_info "停止旧容器..."
    docker-compose -f $COMPOSE_FILE down || true
}

# 启动新容器
start_new() {
    print_info "启动新容器..."
    # 添加 --pull always 确保即使 compose 缓存也会尝试拉取（虽然 pull_image 已经做了，双重保险）
    # 注意：旧版 docker-compose 可能不支持 --pull 参数，这里依赖 pull_image 函数
    docker-compose -f $COMPOSE_FILE up -d
}

# 刷新 CDN 缓存（根据变更范围）
purge_cdn() {
    print_info "刷新 CDN 缓存..."
    local SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local PURGE_SCRIPT="${SCRIPT_DIR}/purge-cdn.mjs"

    # 检查宿主机上是否有脚本
    if [ ! -f "$PURGE_SCRIPT" ]; then
        print_warn "⚠️  未找到 purge-cdn.mjs，跳过 CDN 刷新"
        return
    fi

    # 确保容器正在运行
    if ! docker ps | grep -q $CONTAINER_NAME; then
        print_warn "⚠️  容器未运行，跳过 CDN 刷新"
        return
    fi

    # 复制脚本到容器内的 /app 目录
    docker cp "$PURGE_SCRIPT" $CONTAINER_NAME:/app/purge-cdn.mjs

    # 安装 CDN 刷新所需的依赖（standalone 模式不包含所有依赖）
    print_info "📦 安装 CDN 刷新依赖..."
    docker exec -w /app $CONTAINER_NAME npm install tencentcloud-sdk-nodejs --no-save 2>&1 || {
        print_warn "⚠️  依赖安装失败，跳过 CDN 刷新"
        docker exec $CONTAINER_NAME rm -f /app/purge-cdn.mjs
        return
    }

    local CHANGED_FILE="/tmp/.deploy_changed_files"
    if [ -f "$CHANGED_FILE" ] && [ -s "$CHANGED_FILE" ]; then
        print_info "📋 检测到变更文件列表，按范围刷新..."
        # 复制变更文件到容器内
        docker cp "$CHANGED_FILE" $CONTAINER_NAME:/tmp/.deploy_changed_files
        # 在容器内 /app 目录下执行 CDN 刷新脚本
        docker exec -w /app $CONTAINER_NAME node purge-cdn.mjs --changed-file /tmp/.deploy_changed_files
        # 清理容器内的临时文件
        docker exec $CONTAINER_NAME rm -f /tmp/.deploy_changed_files
    else
        print_info "📋 无变更文件信息，全站刷新..."
        # 在容器内 /app 目录下执行全站刷新
        docker exec -w /app $CONTAINER_NAME node purge-cdn.mjs /
    fi

    # 清理复制的脚本和临时安装的依赖
    docker exec $CONTAINER_NAME rm -f /app/purge-cdn.mjs
    # 不删除 node_modules，因为可能还有其他依赖需要
}

# 清理旧镜像
cleanup() {
    print_info "清理未使用的镜像..."
    docker image prune -f || true
}

# 查看日志
show_logs() {
    print_info "查看容器日志（按 Ctrl+C 退出）..."
    sleep 2
    docker-compose -f $COMPOSE_FILE logs -f
}

# 检查容器状态
check_status() {
    print_info "检查容器状态..."
    sleep 5
    
    if docker ps | grep -q $CONTAINER_NAME; then
        print_info "✅ 容器运行中"
        
        # 检查健康状态
        HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "unknown")
        
        if [ "$HEALTH_STATUS" = "healthy" ]; then
            print_info "✅ 健康检查通过"
        elif [ "$HEALTH_STATUS" = "starting" ]; then
            print_warn "⏳ 健康检查启动中..."
        else
            print_warn "⚠️  健康检查状态: $HEALTH_STATUS"
        fi
        
        return 0
    else
        print_error "❌ 容器未运行"
        return 1
    fi
}

# 回滚到上一个版本
rollback() {
    print_warn "开始回滚..."
    
    # 获取上一个镜像版本
    PREVIOUS_IMAGE=$(docker images $IMAGE_NAME --format "{{.Tag}}" | grep -v "latest" | head -n 1)
    
    if [ -z "$PREVIOUS_IMAGE" ]; then
        print_error "没有找到可以回滚的版本"
        exit 1
    fi
    
    print_info "回滚到版本: $PREVIOUS_IMAGE"
    
    # 停止当前容器
    docker-compose -f $COMPOSE_FILE down
    
    # 修改镜像标签并启动
    export IMAGE_TAG=$PREVIOUS_IMAGE
    docker-compose -f $COMPOSE_FILE up -d
    
    print_info "回滚完成"
}

# 显示帮助信息
show_help() {
    cat << EOF
Docker 快速部署脚本

用法: $0 [命令]

命令:
  deploy    部署最新版本（默认）
  update    更新到最新版本（同 deploy）
  restart   重启容器
  stop      停止容器
  start     启动容器
  logs      查看日志
  status    查看状态
  rollback  回滚到上一个版本
  clean     清理旧镜像
  help      显示帮助信息

示例:
  $0 deploy          # 部署最新版本
  $0 logs            # 查看日志
  $0 rollback        # 回滚到上一个版本

环境变量:
  DOCKERHUB_USERNAME   Docker Hub 用户名（可选，用于登录拉取镜像）
  DOCKERHUB_TOKEN      Docker Hub Token（可选，用于登录拉取镜像）

注意:
  如果镜像仓库需要认证，请设置 DOCKERHUB_USERNAME 和 DOCKERHUB_TOKEN 环境变量
  或在执行部署前手动登录: docker login --username=<用户名> docker.io

EOF
}

# 主函数
main() {
    local command=${1:-deploy}
    
    case $command in
        deploy|update)
            print_info "🚀 开始部署应用..."
            check_docker
            check_env
            pull_image
            stop_old
            start_new
            check_status
            purge_cdn
            cleanup
            print_info "🎉 部署完成！"
            print_info "运行 '$0 logs' 查看日志"
            ;;
        restart)
            print_info "🔄 重启容器..."
            docker-compose -f $COMPOSE_FILE restart
            check_status
            ;;
        stop)
            print_info "⏹️  停止容器..."
            docker-compose -f $COMPOSE_FILE down
            ;;
        start)
            print_info "▶️  启动容器..."
            check_docker
            check_env
            start_new
            check_status
            ;;
        logs)
            show_logs
            ;;
        status)
            check_status
            docker-compose -f $COMPOSE_FILE ps
            ;;
        rollback)
            rollback
            check_status
            ;;
        clean|cleanup)
            cleanup
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            print_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"

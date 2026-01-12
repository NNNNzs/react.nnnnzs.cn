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
ACR_REGISTRY="crpi-qmro9b00jz9zoqqx.cn-hangzhou.personal.cr.aliyuncs.com"
IMAGE_NAME="${ACR_REGISTRY}/nnnnzs/react-nnnnzs.cn"
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

# 登录阿里云 ACR（如果需要）
login_acr() {
    # 如果提供了 ACR 用户名和密码，则登录
    if [ -n "$ACR_USERNAME" ] && [ -n "$ACR_PASSWORD" ]; then
        print_info "登录阿里云 ACR..."
        echo "$ACR_PASSWORD" | docker login --username="$ACR_USERNAME" --password-stdin "$ACR_REGISTRY" || true
    fi
}

# 拉取最新镜像
pull_image() {
    print_info "正在拉取最新镜像..."
    login_acr
    docker-compose -f $COMPOSE_FILE pull
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
  ACR_USERNAME         阿里云 ACR 用户名（可选，用于登录拉取镜像）
  ACR_PASSWORD         阿里云 ACR 密码（可选，用于登录拉取镜像）

注意:
  如果镜像仓库需要认证，请设置 ACR_USERNAME 和 ACR_PASSWORD 环境变量
  或在执行部署前手动登录: docker login --username=<用户名> $ACR_REGISTRY

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

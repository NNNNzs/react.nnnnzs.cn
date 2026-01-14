#!/bin/bash

# 🚀 性能检测工具 - Shell 脚本版本
# 使用方法: ./analyze.sh [all|code|bundle|render|quick]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${CYAN}================================================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}================================================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        exit 1
    fi
}

run_analysis() {
    local mode=$1
    local description=$2

    print_header "$description"

    if [ ! -f "performance/index.js" ]; then
        print_error "performance/index.js 文件不存在"
        exit 1
    fi

    # 检查 package.json 是否有 type: module
    if grep -q '"type": "module"' package.json 2>/dev/null; then
        node performance/index.js $mode
    else
        # 如果不是 ESM，使用旧的 CommonJS 方式
        node performance/index.js $mode
    fi
}

case "$1" in
    "code")
        run_analysis "code" "🔍 代码质量分析"
        ;;
    "bundle")
        run_analysis "bundle" "📦 包大小分析"
        ;;
    "render")
        run_analysis "render" "⚡ 渲染性能分析"
        ;;
    "quick")
        run_analysis "quick" "⚡ 快速性能检测"
        ;;
    "all"|"")
        run_analysis "all" "🚀 完整性能分析套件"
        ;;
    "help"|"-h"|"--help")
        echo "用法: $0 [模式]"
        echo ""
        echo "可用模式:"
        echo "  all      - 运行所有性能检测 (默认)"
        echo "  code     - 代码质量分析"
        echo "  bundle   - 包大小分析"
        echo "  render   - 渲染性能分析"
        echo "  quick    - 快速检测"
        echo "  help     - 显示此帮助信息"
        echo ""
        echo "或者使用 npm 命令:"
        echo "  npm run analyze        # 完整分析"
        echo "  npm run analyze:quick  # 快速检测"
        ;;
    *)
        print_error "未知模式: $1"
        echo "使用 '$0 help' 查看可用选项"
        exit 1
        ;;
esac

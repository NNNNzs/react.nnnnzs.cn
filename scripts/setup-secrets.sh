#!/bin/bash
# GitHub Secrets 配置助手脚本
# 帮助快速配置 GitHub Actions 所需的 Secrets

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

clear

cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🐳 Docker 自动化部署配置助手                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF

echo ""
print_info "本脚本将引导你完成 GitHub Actions 自动化部署的配置"
echo ""

# 步骤 1: 获取 GitHub 仓库信息
print_step "步骤 1/4: 获取 GitHub 仓库信息"
echo ""

# 尝试从 git remote 获取仓库信息
REPO_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")

if [ -n "$REPO_URL" ]; then
    # 提取仓库所有者和名称
    if [[ $REPO_URL =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
        REPO_OWNER="${BASH_REMATCH[1]}"
        REPO_NAME="${BASH_REMATCH[2]}"
        print_info "检测到仓库: $REPO_OWNER/$REPO_NAME"
    fi
else
    print_warn "无法自动检测 GitHub 仓库"
fi

echo ""
read -p "请输入你的 GitHub 用户名或组织名 [$REPO_OWNER]: " INPUT_OWNER
REPO_OWNER=${INPUT_OWNER:-$REPO_OWNER}

read -p "请输入你的 GitHub 仓库名 [$REPO_NAME]: " INPUT_NAME
REPO_NAME=${INPUT_NAME:-$REPO_NAME}

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
    print_error "仓库信息不完整"
    exit 1
fi

print_info "将为仓库 $REPO_OWNER/$REPO_NAME 配置 Secrets"
echo ""

# 步骤 2: 获取 DockerHub 信息
print_step "步骤 2/4: 配置 DockerHub 信息"
echo ""
print_info "你需要一个 DockerHub 账号来存储 Docker 镜像"
print_info "访问 https://hub.docker.com/ 注册或登录"
echo ""

read -p "请输入你的 DockerHub 用户名: " DOCKERHUB_USERNAME

if [ -z "$DOCKERHUB_USERNAME" ]; then
    print_error "DockerHub 用户名不能为空"
    exit 1
fi

echo ""
print_info "接下来需要创建 DockerHub Access Token"
print_warn "注意: 不要使用密码，而是使用 Access Token！"
echo ""
print_info "创建步骤:"
echo "  1. 访问 https://hub.docker.com/settings/security"
echo "  2. 点击 'New Access Token'"
echo "  3. 输入描述（如 'GitHub Actions'）"
echo "  4. 选择权限（推荐: Read & Write）"
echo "  5. 点击 'Generate'"
echo "  6. 复制生成的 Token"
echo ""
read -p "按回车键继续..." 

echo ""
read -sp "请粘贴你的 DockerHub Access Token: " DOCKERHUB_TOKEN
echo ""

if [ -z "$DOCKERHUB_TOKEN" ]; then
    print_error "DockerHub Token 不能为空"
    exit 1
fi

# 步骤 3: 验证 Token
print_step "步骤 3/4: 验证 DockerHub Token"
echo ""

# 尝试登录 DockerHub 验证 Token
if command -v docker &> /dev/null; then
    print_info "正在验证 Token..."
    if echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin > /dev/null 2>&1; then
        print_info "✅ Token 验证成功"
        docker logout > /dev/null 2>&1
    else
        print_warn "⚠️  Token 验证失败，请确认 Token 是否正确"
        read -p "是否继续配置？(y/n): " CONTINUE
        if [ "$CONTINUE" != "y" ]; then
            exit 1
        fi
    fi
else
    print_warn "Docker 未安装，跳过 Token 验证"
fi

echo ""

# 步骤 4: 设置 GitHub Secrets
print_step "步骤 4/4: 配置 GitHub Secrets"
echo ""

print_info "需要在 GitHub 仓库中设置以下 Secrets:"
echo ""
echo "  1. DOCKERHUB_USERNAME: $DOCKERHUB_USERNAME"
echo "  2. DOCKERHUB_TOKEN: [已隐藏]"
echo ""

# 检查是否安装了 gh CLI
if command -v gh &> /dev/null; then
    print_info "检测到 GitHub CLI (gh)，可以自动设置 Secrets"
    echo ""
    read -p "是否使用 gh CLI 自动设置 Secrets？(y/n): " USE_GH
    
    if [ "$USE_GH" = "y" ]; then
        print_info "正在设置 GitHub Secrets..."
        
        # 检查是否已登录
        if ! gh auth status &> /dev/null; then
            print_warn "需要先登录 GitHub"
            gh auth login
        fi
        
        # 设置 Secrets
        echo "$DOCKERHUB_USERNAME" | gh secret set DOCKERHUB_USERNAME -R "$REPO_OWNER/$REPO_NAME"
        echo "$DOCKERHUB_TOKEN" | gh secret set DOCKERHUB_TOKEN -R "$REPO_OWNER/$REPO_NAME"
        
        print_info "✅ GitHub Secrets 设置完成"
    else
        print_info "请手动设置 GitHub Secrets"
    fi
else
    print_warn "未检测到 GitHub CLI (gh)，需要手动设置 Secrets"
fi

echo ""
print_info "手动设置步骤:"
echo "  1. 访问: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
echo "  2. 点击 'New repository secret'"
echo "  3. 添加以下 Secrets:"
echo ""
echo "     名称: DOCKERHUB_USERNAME"
echo "     值:   $DOCKERHUB_USERNAME"
echo ""
echo "     名称: DOCKERHUB_TOKEN"
echo "     值:   [你的 DockerHub Token]"
echo ""

# 步骤 5: 生成配置摘要
echo ""
print_step "配置摘要"
echo ""

cat << EOF
╔═══════════════════════════════════════════════════════════╗
║                   配置完成                                ║
╚═══════════════════════════════════════════════════════════╝

GitHub 仓库: $REPO_OWNER/$REPO_NAME
DockerHub 用户名: $DOCKERHUB_USERNAME
镜像名称: $DOCKERHUB_USERNAME/react-nnnnzs-cn

下一步操作:
  1. 确保 GitHub Secrets 已正确设置
  2. 推送代码到 release 分支触发构建:
     
     git checkout -b release
     git push origin release
     
  3. 查看 GitHub Actions 构建状态:
     https://github.com/$REPO_OWNER/$REPO_NAME/actions
     
  4. 构建完成后，在服务器上部署:
     
     # 编辑 docker-compose.prod.yml，替换镜像名称
     # 或设置环境变量
     export DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME
     
     # 运行部署脚本
     ./scripts/deploy.sh deploy

更多信息请查看: docs/DOCKER_DEPLOYMENT.md

EOF

print_info "🎉 配置完成！祝部署顺利！"

# 🚀 Docker 自动化部署快速开始

本指南将帮助你在 5 分钟内完成 Docker 自动化部署配置。

## 📋 前置条件

- ✅ GitHub 账号和仓库
- ✅ DockerHub 账号（免费注册：https://hub.docker.com/）
- ⚠️ 如果你还没有 DockerHub 账号，请先注册

## 🎯 快速配置（3 步完成）

### 方式 1: 使用自动化配置脚本（推荐）

```bash
# 运行配置脚本
./scripts/setup-secrets.sh
```

脚本会引导你完成所有配置，包括：
- ✅ 自动检测 GitHub 仓库信息
- ✅ 配置 DockerHub 凭证
- ✅ 验证 Token 有效性
- ✅ 自动设置 GitHub Secrets（需要 gh CLI）

### 方式 2: 手动配置

#### 步骤 1: 创建 DockerHub Access Token

1. 访问 [DockerHub Security Settings](https://hub.docker.com/settings/security)
2. 点击 **"New Access Token"**
3. 输入描述（如 "GitHub Actions"）
4. 选择权限：**Read & Write**
5. 点击 **"Generate"**
6. **复制** 生成的 Token（只显示一次！）

#### 步骤 2: 配置 GitHub Secrets

1. 打开你的 GitHub 仓库
2. 进入 **Settings** > **Secrets and variables** > **Actions**
3. 点击 **"New repository secret"**
4. 添加两个 Secrets：

| Secret 名称 | 值 | 说明 |
|------------|---|------|
| `DOCKERHUB_USERNAME` | 你的 DockerHub 用户名 | 例如：`yourname` |
| `DOCKERHUB_TOKEN` | 步骤 1 生成的 Token | 从 DockerHub 复制 |

#### 步骤 3: 推送到 release 分支

```bash
# 创建并切换到 release 分支
git checkout -b release

# 推送到远程仓库
git push origin release
```

## ✅ 验证部署

### 1. 查看 GitHub Actions

1. 打开你的 GitHub 仓库
2. 点击 **"Actions"** 标签
3. 查看 **"Docker Release"** 工作流
4. 等待构建完成（约 5-10 分钟）

### 2. 检查 DockerHub

1. 访问 `https://hub.docker.com/r/your-username/react-nnnnzs-cn`
2. 查看是否有新的镜像标签

## 🎉 部署到服务器

### 快速部署

```bash
# 1. 下载项目文件到服务器
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 2. 创建 .env 文件（复制 .env.example 并修改）
cp .env.example .env
nano .env

# 3. 修改 docker-compose.prod.yml
# 替换 IMAGE_NAME 为你的 DockerHub 用户名
nano docker-compose.prod.yml

# 4. 运行部署脚本
./scripts/deploy.sh deploy

# 5. 查看日志
./scripts/deploy.sh logs
```

### 使用环境变量（推荐）

```bash
# 设置环境变量
export DOCKERHUB_USERNAME=your-dockerhub-username

# 运行部署
./scripts/deploy.sh deploy
```

## 📚 常用命令

```bash
# 部署/更新应用
./scripts/deploy.sh deploy

# 查看日志
./scripts/deploy.sh logs

# 重启应用
./scripts/deploy.sh restart

# 停止应用
./scripts/deploy.sh stop

# 查看状态
./scripts/deploy.sh status

# 回滚到上一个版本
./scripts/deploy.sh rollback

# 清理旧镜像
./scripts/deploy.sh clean
```

## 🔄 日常工作流

### 更新代码并自动部署

```bash
# 1. 在本地开发和测试
git checkout main
# ... 进行开发 ...
git commit -am "feat: 添加新功能"

# 2. 合并到 release 分支
git checkout release
git merge main

# 3. 推送触发自动构建
git push origin release

# 4. 等待 GitHub Actions 构建完成
# 5. 在服务器上更新
ssh your-server
cd /path/to/project
./scripts/deploy.sh deploy
```

### 使用版本标签

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 推送到 release 分支
git push origin release

# 在服务器上使用特定版本
docker pull your-username/react-nnnnzs-cn:v1.0.0
```

## 🐛 常见问题

### Q1: 构建失败，提示无法登录 DockerHub

**A:** 检查 GitHub Secrets 是否正确设置：
- 用户名没有多余空格
- Token 是 Access Token，不是密码
- Token 有 Read & Write 权限

### Q2: 推送成功，但没有触发构建

**A:** 检查：
- 是否推送到了 `release` 分支
- `.github/workflows/docker-release.yml` 文件是否存在
- GitHub Actions 是否启用（仓库 Settings > Actions）

### Q3: 构建成功，但服务器拉取镜像失败

**A:** 检查：
- DockerHub 仓库是否为公开（或者服务器是否登录 DockerHub）
- 镜像名称是否正确（`username/repo-name:tag`）

### Q4: 容器启动失败

**A:** 检查：
```bash
# 查看容器日志
docker logs react-nnnnzs-cn-prod

# 检查 .env 文件是否存在且配置正确
cat .env

# 检查端口是否被占用
netstat -tuln | grep 3301
```

## 🔐 安全建议

1. **永远不要提交 `.env` 文件到 Git**
2. **定期更新 DockerHub Access Token**
3. **使用非 root 用户运行容器**（已配置）
4. **定期更新依赖和基础镜像**
5. **在生产环境使用 HTTPS**

## 📖 更多信息

- 详细文档：[docs/DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)
- 项目规则：[../.cursorrules](../.cursorrules)
- API 文档：[ROUTES.md](../ROUTES.md)

## 🆘 获取帮助

如遇问题：
1. 查看 [详细部署文档](./DOCKER_DEPLOYMENT.md)
2. 查看 GitHub Actions 构建日志
3. 查看 Docker 容器日志
4. 提交 Issue 到项目仓库

---

**祝你部署顺利！** 🎉

如有任何问题，随时查看文档或寻求帮助。

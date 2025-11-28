# 🛠️ 部署脚本说明

本目录包含用于 Docker 自动化部署的辅助脚本。

## 📝 脚本清单

### 1. setup-secrets.sh - GitHub Secrets 配置助手

**用途**: 引导用户完成 GitHub Actions 所需的 Secrets 配置

**功能**:
- ✅ 自动检测 GitHub 仓库信息
- ✅ 验证 DockerHub Token
- ✅ 支持使用 gh CLI 自动设置 Secrets
- ✅ 提供手动配置指南
- ✅ 生成配置摘要

**使用方法**:

```bash
# 运行配置助手
./scripts/setup-secrets.sh
```

**前置条件**:
- Git 仓库已配置 remote origin
- 已注册 DockerHub 账号
- 已创建 DockerHub Access Token
- （可选）已安装 GitHub CLI (gh)

**交互流程**:
1. 检测或输入 GitHub 仓库信息
2. 输入 DockerHub 用户名
3. 输入 DockerHub Access Token
4. 验证 Token（如果安装了 Docker）
5. 设置 GitHub Secrets（手动或自动）

---

### 2. deploy.sh - 快速部署脚本

**用途**: 在服务器上快速部署和管理 Docker 容器

**功能**:
- ✅ 一键部署最新版本
- ✅ 更新应用到最新版本
- ✅ 重启、停止、启动容器
- ✅ 查看日志和状态
- ✅ 回滚到上一个版本
- ✅ 清理旧镜像

**使用方法**:

```bash
# 部署最新版本
./scripts/deploy.sh deploy

# 更新到最新版本（同 deploy）
./scripts/deploy.sh update

# 重启容器
./scripts/deploy.sh restart

# 停止容器
./scripts/deploy.sh stop

# 启动容器
./scripts/deploy.sh start

# 查看日志（实时）
./scripts/deploy.sh logs

# 查看状态
./scripts/deploy.sh status

# 回滚到上一个版本
./scripts/deploy.sh rollback

# 清理旧镜像
./scripts/deploy.sh clean

# 显示帮助信息
./scripts/deploy.sh help
```

**环境变量**:

```bash
# 设置 DockerHub 用户名（覆盖默认值）
export DOCKERHUB_USERNAME=your-dockerhub-username

# 然后运行部署
./scripts/deploy.sh deploy
```

**前置条件**:
- 已安装 Docker 和 Docker Compose
- 项目根目录存在 `.env` 文件
- 项目根目录存在 `docker-compose.prod.yml` 文件
- DockerHub 镜像已构建并推送

**部署流程**:
1. 拉取最新镜像
2. 停止旧容器
3. 启动新容器
4. 检查容器状态和健康
5. 清理未使用的镜像

---

## 🚀 快速开始

### 首次部署

```bash
# 步骤 1: 配置 GitHub Secrets（只需一次）
./scripts/setup-secrets.sh

# 步骤 2: 推送到 release 分支触发自动构建
git checkout -b release
git push origin release

# 步骤 3: 等待 GitHub Actions 构建完成（约 5-10 分钟）
# 访问: https://github.com/your-username/your-repo/actions

# 步骤 4: 在服务器上部署
# 1. 克隆或拉取代码
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 2. 配置环境变量
cp .env.example .env
nano .env  # 修改数据库等配置

# 3. 设置 DockerHub 用户名
export DOCKERHUB_USERNAME=your-dockerhub-username

# 4. 运行部署
./scripts/deploy.sh deploy

# 5. 查看日志
./scripts/deploy.sh logs
```

### 日常更新

```bash
# 在本地开发
git commit -am "feat: 新功能"

# 推送到 release 分支
git checkout release
git merge main
git push origin release

# 等待自动构建完成后，在服务器上更新
ssh your-server
cd /path/to/project
./scripts/deploy.sh update
```

## 🐛 故障排查

### 问题 1: 脚本无执行权限

**症状**: `Permission denied` 错误

**解决方案**:

```bash
# 添加执行权限
chmod +x scripts/*.sh

# 或单独添加
chmod +x scripts/setup-secrets.sh
chmod +x scripts/deploy.sh
```

### 问题 2: Docker 未安装

**症状**: `Docker 未安装，请先安装 Docker`

**解决方案**:

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# CentOS/RHEL
sudo yum install -y docker
sudo systemctl start docker

# macOS
brew install docker
```

### 问题 3: .env 文件不存在

**症状**: `.env 文件不存在，请先创建环境变量文件`

**解决方案**:

```bash
# 复制示例文件
cp .env.example .env

# 编辑配置
nano .env
```

### 问题 4: 容器启动失败

**症状**: 容器未运行或健康检查失败

**解决方案**:

```bash
# 查看详细日志
docker logs react-nnnnzs-cn-prod

# 检查容器状态
docker ps -a

# 检查环境变量
docker inspect react-nnnnzs-cn-prod

# 尝试重新部署
./scripts/deploy.sh deploy
```

### 问题 5: 无法拉取镜像

**症状**: `Error response from daemon: pull access denied`

**解决方案**:

```bash
# 确认镜像名称正确
# 格式: username/repository:tag

# 如果是私有仓库，需要登录
docker login

# 重新拉取
docker pull your-username/react-nnnnzs-cn:latest
```

## 📋 配置检查清单

### 开发环境配置

- [ ] Git 仓库已初始化
- [ ] GitHub 远程仓库已配置
- [ ] DockerHub 账号已注册
- [ ] DockerHub Access Token 已创建
- [ ] GitHub Secrets 已配置

### 服务器环境配置

- [ ] Docker 已安装
- [ ] Docker Compose 已安装
- [ ] 项目代码已克隆
- [ ] .env 文件已配置
- [ ] 脚本有执行权限
- [ ] 端口 3301 未被占用

### 数据库和服务

- [ ] MySQL 已安装并运行
- [ ] Redis 已安装并运行
- [ ] 数据库表已创建
- [ ] 数据库用户有适当权限

## 🔧 自定义配置

### 修改镜像仓库

编辑 `scripts/deploy.sh`:

```bash
# 修改镜像名称
IMAGE_NAME="your-registry/your-repo/react-nnnnzs-cn"
```

### 修改容器名称

编辑 `scripts/deploy.sh`:

```bash
# 修改容器名称
CONTAINER_NAME="your-container-name"
```

### 修改 Compose 文件

编辑 `scripts/deploy.sh`:

```bash
# 修改 compose 文件路径
COMPOSE_FILE="docker-compose.custom.yml"
```

## 📚 相关文档

- [Docker 部署完整指南](../docs/DOCKER_DEPLOYMENT.md)
- [快速开始指南](../docs/QUICK_START.md)
- [文件清单](../docs/FILES_CREATED.md)
- [主 README](../README.md)

## 💡 最佳实践

1. **安全性**
   - 不要提交 `.env` 文件到 Git
   - 定期更新 DockerHub Token
   - 使用强密码和 JWT Secret

2. **版本管理**
   - 使用语义化版本标签
   - 保留多个版本以便回滚
   - 记录每次部署的版本号

3. **监控和日志**
   - 定期查看应用日志
   - 监控容器健康状态
   - 设置告警通知

4. **备份**
   - 定期备份数据库
   - 保留重要的日志文件
   - 备份配置文件

5. **测试**
   - 先在测试环境验证
   - 使用 PR 检查构建
   - 部署后进行冒烟测试

## 🆘 获取帮助

如遇到问题：

1. 查看脚本的 `help` 输出
2. 查看详细文档
3. 检查日志文件
4. 提交 Issue

---

**最后更新**: 2024年11月28日

# 快速部署配置指南

## 1. 配置 GitHub Secrets

在 GitHub 仓库中，进入 **Settings > Secrets and variables > Actions**，添加以下 Secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `DEPLOY_HOST` | 服务器地址 | `192.168.1.100` 或 `example.com` |
| `DEPLOY_USER` | SSH 用户名 | `root` 或 `deploy` |
| `DEPLOY_SSH_KEY` | SSH 私钥（完整内容） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_DIR` | 部署目录 | `/opt/react-nnnnzs-cn` |
| `DEPLOY_SCRIPT` | 部署脚本路径或命令 | `./deploy.sh` 或 `/opt/react-nnnnzs-cn/deploy.sh` |
| `DEPLOY_NOTIFY_URL` | 部署通知地址 | `https://api.nnnnzs.cn/Api/msg` |
| `DEPLOY_PORT` | SSH 端口（可选） | `22`（默认值） |

## 2. 生成 SSH 密钥对

```bash
# 生成新的 SSH 密钥对（如果还没有）
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-server

# 复制私钥内容（用于 GitHub Secrets 的 DEPLOY_SSH_KEY）
cat ~/.ssh/github_actions_deploy
```

## 3. 准备服务器部署脚本

将 `scripts/deploy.sh` 上传到服务器的部署目录，或根据你的需求创建自定义脚本。

确保脚本有执行权限：
```bash
chmod +x /opt/react-nnnnzs-cn/deploy.sh
```

## 4. 测试部署

推送到 `release` 或 `main` 分支，GitHub Actions 会自动：
1. 构建 Docker 镜像
2. 推送到 DockerHub
3. SSH 连接到服务器
4. 执行部署脚本

## 5. 查看部署日志

在 GitHub Actions 页面查看部署日志，确认部署是否成功。

## 常见问题

### Q: 如何自定义部署脚本？
A: 修改 `scripts/deploy.sh` 或创建新的脚本，然后在 GitHub Secrets 中设置 `DEPLOY_SCRIPT` 指向你的脚本。

### Q: 可以执行多个命令吗？
A: 可以，在 `DEPLOY_SCRIPT` 中使用分号分隔多个命令，例如：`./deploy.sh && docker-compose up -d`

### Q: 如何传递额外的环境变量？
A: 在 workflow 文件的 SSH action 中添加 `export` 命令，或修改部署脚本。

### Q: 部署失败怎么办？
A: 查看 GitHub Actions 日志，检查：
- SSH 连接是否成功
- 部署目录是否存在
- 脚本是否有执行权限
- Docker 是否正常运行

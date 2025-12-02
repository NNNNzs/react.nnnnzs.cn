# 部署配置说明

## GitHub Secrets 配置

为了使用自动部署功能，你需要在 GitHub 仓库的 Settings > Secrets and variables > Actions 中配置以下 Secrets：

### 必需的 Secrets

1. **DEPLOY_HOST**
   - 描述: 服务器 IP 地址或域名
   - 示例: `192.168.1.100` 或 `example.com`

2. **DEPLOY_USER**
   - 描述: SSH 登录用户名
   - 示例: `root` 或 `deploy`

3. **DEPLOY_SSH_KEY**
   - 描述: SSH 私钥内容（完整的私钥，包括 `-----BEGIN ... KEY-----` 和 `-----END ... KEY-----`）
   - 获取方式:
     ```bash
     # 如果还没有 SSH 密钥，先生成一个
     ssh-keygen -t ed25519 -C "github-actions"
     
     # 将公钥添加到服务器
     ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-server
     
     # 复制私钥内容（用于 GitHub Secrets）
     cat ~/.ssh/id_ed25519
     ```

4. **DEPLOY_DIR**
   - 描述: 服务器上的部署目录路径
   - 示例: `/opt/react-nnnnzs-cn` 或 `/home/deploy/app`

5. **DEPLOY_SCRIPT**
   - 描述: 要执行的部署脚本路径（相对于 DEPLOY_DIR 或绝对路径）
   - 示例: `./deploy.sh` 或 `/opt/react-nnnnzs-cn/scripts/deploy.sh`

6. **DEPLOY_NOTIFY_URL**
   - 描述: 部署完成后的通知地址（POST 请求）
   - 示例: `https://api.nnnnzs.cn/Api/msg`
   - 通知格式: JSON，包含 `title`、`content` 和 `url` 字段
   - 成功通知: `{"title":"自动部署","content":"react.nnnnzs.cn部署完成","url":"https://react.nnnnzs.cn"}`
   - 失败通知: `{"title":"自动部署","content":"react.nnnnzs.cn部署失败","url":"https://react.nnnnzs.cn"}`

### 可选的 Secrets

7. **DEPLOY_PORT** (可选)
   - 描述: SSH 端口号
   - 默认值: `22`
   - 示例: `2222`

## 部署脚本编写指南

部署脚本会在服务器上执行，可以访问以下环境变量：

- `VERSION`: 版本号（如 `v2024.01.15.14`）
- `SHORT_SHA`: Git commit 短 SHA
- `IMAGE_NAME`: Docker 镜像名称
- `BUILD_DATE`: 构建时间（ISO 8601 格式）

### 示例部署脚本

参考 `scripts/deploy.sh` 文件，这是一个完整的部署脚本示例，包含：

1. 拉取最新的 Docker 镜像
2. 停止并删除旧容器
3. 启动新容器
4. 检查容器状态
5. 清理未使用的镜像

### 自定义部署脚本

你可以根据实际需求修改部署脚本，例如：

- 使用 Docker Compose
- 执行数据库迁移
- 重启相关服务
- 发送通知
- 健康检查

## 部署流程

1. 推送到 `release` 或 `main` 分支
2. GitHub Actions 自动触发构建
3. 构建并推送 Docker 镜像到 DockerHub
4. 构建成功后，自动 SSH 连接到服务器
5. 切换到指定目录
6. 执行部署脚本
7. 脚本执行完成后，发送通知到 `DEPLOY_NOTIFY_URL`（成功或失败都会通知）

## 故障排查

### SSH 连接失败

- 检查 `DEPLOY_HOST` 是否正确
- 检查 `DEPLOY_USER` 是否有权限
- 验证 `DEPLOY_SSH_KEY` 是否正确
- 确认服务器防火墙允许 SSH 连接

### 部署脚本执行失败

- 检查 `DEPLOY_DIR` 路径是否存在
- 确认 `DEPLOY_SCRIPT` 路径正确
- 确保脚本有执行权限：`chmod +x deploy.sh`
- 查看 GitHub Actions 日志获取详细错误信息

### 容器启动失败

- 检查 Docker 是否正常运行
- 查看容器日志：`docker logs react-nnnnzs-cn`
- 确认端口是否被占用
- 检查环境变量配置

## 安全建议

1. **使用专用部署用户**: 不要使用 root 用户，创建一个专用的部署用户
2. **限制 SSH 密钥权限**: 使用最小权限原则
3. **定期轮换密钥**: 定期更新 SSH 密钥
4. **使用 SSH 密钥密码**: 为 SSH 密钥设置密码（虽然 GitHub Secrets 会加密存储）
5. **限制服务器访问**: 使用防火墙限制 SSH 访问来源

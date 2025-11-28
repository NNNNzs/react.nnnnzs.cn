# 变更日志

本文档记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增

#### Docker 自动化部署
- ✨ 添加 GitHub Actions 工作流
  - `docker-release.yml` - 自动构建和发布 Docker 镜像
  - `docker-pr-check.yml` - PR 构建测试
- ✨ 添加生产环境 Docker 配置
  - `Dockerfile.prod` - 多阶段构建，优化镜像体积
  - `docker-compose.prod.yml` - 生产环境编排配置
  - `docker-entrypoint-prod.sh` - 生产环境启动脚本
- ✨ 添加部署脚本
  - `scripts/deploy.sh` - 一键部署脚本（部署、更新、重启、回滚等）
  - `scripts/setup-secrets.sh` - GitHub Secrets 配置助手
- ✨ 添加健康检查 API
  - `src/app/api/health/route.ts` - 服务健康状态检查端点
- ✨ 添加完整文档
  - `docs/DOCKER_DEPLOYMENT.md` - Docker 部署完整指南
  - `docs/QUICK_START.md` - 5 分钟快速开始指南
  - `docs/FILES_CREATED.md` - 文件清单和说明
  - `scripts/README.md` - 脚本使用说明
  - `CHANGELOG_DOCKER.md` - Docker 功能详细变更日志
  - `DOCKER_SETUP_SUMMARY.md` - Docker 配置完成总结
- ✨ 添加 GitHub PR 模板
  - `.github/PULL_REQUEST_TEMPLATE.md` - 规范化 PR 格式

#### 项目配置
- ✨ 添加 `.cursorrules` - Cursor IDE 项目规则配置

### 更新

- 📝 更新 `README.md` - 添加 Docker 部署章节和使用说明
- 🔧 更新 `docker-entrypoint.sh` - 优化开发环境启动脚本

### 删除

- 🗑️ 删除 `.curorrules` - 修复文件名拼写错误（已替换为 `.cursorrules`）

---

## 变更统计

### 本次变更（2024-11-28）

- **新增文件**: 15 个
- **更新文件**: 2 个
- **删除文件**: 1 个
- **主要功能**: Docker 自动化部署系统

### 文件清单

#### 新增文件
- `.cursorrules`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/docker-pr-check.yml`
- `.github/workflows/docker-release.yml`
- `CHANGELOG_DOCKER.md`
- `DOCKER_SETUP_SUMMARY.md`
- `Dockerfile.prod`
- `docker-compose.prod.yml`
- `docker-entrypoint-prod.sh`
- `docs/.gitkeep`
- `docs/DOCKER_DEPLOYMENT.md`
- `docs/FILES_CREATED.md`
- `docs/QUICK_START.md`
- `scripts/README.md`
- `scripts/deploy.sh`
- `scripts/setup-secrets.sh`
- `src/app/api/health/route.ts`

#### 更新文件
- `README.md`
- `docker-entrypoint.sh`

#### 删除文件
- `.curorrules`

---

## 版本历史

### [1.0.0] - 2024-11-28

#### 新增
- Docker 自动化部署支持
- GitHub Actions CI/CD 工作流
- 生产环境 Docker 配置
- 部署脚本和工具
- 健康检查 API
- 完整部署文档

#### 更新
- 项目文档和 README
- 开发环境启动脚本

---

**注意**: 详细的 Docker 功能变更日志请查看 [CHANGELOG_DOCKER.md](./CHANGELOG_DOCKER.md)

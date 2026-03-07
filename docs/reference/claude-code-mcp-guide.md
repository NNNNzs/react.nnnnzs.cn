# Claude Code MCP 配置指南

本指南介绍如何将博客的 MCP (Model Context Protocol) 服务配置到 Claude Code CLI 中。

---

## 🎯 功能概述

通过 MCP 连接，Claude Code 可以：
- ✅ 读取博客文章列表
- ✅ 搜索文章内容
- ✅ 创建新文章
- ✅ 更新现有文章
- ✅ 管理文章标签和分类
- ✅ 管理文章合集
- ✅ 上传图片到图床

---

## 📋 前置要求

1. **已安装 Claude Code CLI**
   ```bash
   # 检查是否已安装
   claude --version
   ```

2. **博客服务已部署**
   - 开发环境: `http://localhost:3000`
   - 生产环境: `https://www.nnnnzs.cn`

3. **有效的用户账号**
   - 需要登录博客系统
   - 需要生成长期 Token

---

## 🚀 快速开始

### 方式 A：OAuth 2.0 Bearer Token（推荐）

这是最简单的方式，使用长期 Token 直接连接。

#### 步骤 1：登录博客

```bash
# 方式 1: 通过 API 登录（获取临时 Token）
TOKEN=$(curl -s -X POST https://www.nnnnzs.cn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"your-account","password":"your-password"}' | jq -r '.token')

# 方式 2: 通过 Web UI 登录
# 访问: https://www.nnnnzs.cn/c/user/info
```

#### 步骤 2：生成长期 Token

1. 访问用户信息页面: `https://www.nnnnzs.cn/c/user/info`
2. 找到"长期 Token 管理"区域
3. 点击"生成长期 Token"按钮
4. 选择有效期：
   - **永久** (推荐) - 不会过期
   - **自定义天数** - 7/30/90/180/365 天
5. 输入描述（如 "Claude Code MCP"）
6. 复制生成的 Token（格式：`LTK_xxxxx`）

#### 步骤 3：配置 Claude Code

```bash
# 添加 MCP 服务器
claude mcp add MyBlog https://www.nnnnzs.cn/api/mcp --transport http  --scope user --header "Authorization: Bearer LTK_你的Token"

# 验证配置
claude mcp list

# 测试连接
# 在 Claude Code 中输入: "请列出最近的文章"
```

### 方式 B：OAuth 2.0 授权码流程（标准）

这是标准的 OAuth 2.0 流程，Claude Code 会自动处理授权。

```bash
# Claude Code 会自动发现 OAuth 端点
# 并弹出授权页面（如果需要）

# 配置命令（与方式 A 相同）
claude mcp add MyBlog --transport http --scope user https://www.nnnnzs.cn/api/mcp
claude mcp add MyBlog --transport http --scope user http://localhost:3000/api/mcp

```

---

## 🔧 详细配置说明

### MCP 服务器端点

```
MCP URL: https://www.nnnnzs.cn/api/mcp
方法: POST (JSON-RPC 2.0)
认证: Bearer Token 或 OAuth 2.0
```

### OAuth 2.0 端点

```
授权端点: https://www.nnnnzs.cn/authorize
Token 端点: https://www.nnnnzs.cn/token
撤销端点: https://www.nnnnzs.cn/revoke
验证端点: https://www.nnnnzs.cn/introspect
注册端点: https://www.nnnnzs.cn/register
```

### 支持的授权类型

- ✅ `client_credentials` - 客户端凭证（使用现有 Token）
- ✅ `authorization_code` - 授权码流程（使用 PKCE）
- ✅ `refresh_token` - 刷新令牌（暂未实现）

---

## 📝 使用示例

### 在 Claude Code 中使用 MCP

#### 示例 1：列出文章

```
请列出最近发布的 10 篇文章
```

#### 示例 2：搜索文章

```
搜索包含 "Next.js" 关键词的文章
```

#### 示例 3：创建文章

```
创建一篇新文章：
- 标题：Next.js 16 新特性详解
- 内容：Next.js 16 带来了许多激动人心的新特性...
- 分类：技术
- 标签：Next.js,React,前端
```

#### 示例 4：更新文章

```
更新文章 ID 123：
- 添加标签 "性能优化"
- 更新内容
```

#### 示例 5：管理合集

```
创建文章并添加到合集 "Next.js 系列"
```

### MCP 工具列表

```json
{
  "tools": [
    {
      "name": "list_articles",
      "description": "列出文章列表"
    },
    {
      "name": "search_articles",
      "description": "搜索文章内容"
    },
    {
      "name": "create_article",
      "description": "创建新文章"
    },
    {
      "name": "update_article",
      "description": "更新文章"
    },
    {
      "name": "upload_image",
      "description": "上传图片到图床"
    }
  ],
  "resources": [
    {
      "uri": "blog://articles",
      "description": "文章列表资源"
    },
    {
      "uri": "blog://collections",
      "description": "合集列表资源"
    }
  ]
}
```

---

## 🛠️ 故障排查

### 问题 1：连接失败 - 认证错误

**错误信息**：
```
Status: ✘ failed
Auth: ✘ not authenticated
Error: Invalid or expired token
```

**解决方案**：
1. 检查 Token 是否正确（以 `LTK_` 开头）
2. 检查 Token 是否过期
3. 重新生成长期 Token
4. 更新 Claude Code 配置

```bash
# 移除旧配置
claude mcp remove MyBlog

# 重新添加
claude mcp add MyBlog https://www.nnnnzs.cn/api/mcp \
  --header "Authorization: Bearer LTK_新Token"
```

### 问题 2：client_secret 为 null 错误

**错误信息**：
```
Error: expected string, received null
Path: ["client_secret"]
```

**解决方案**：
- 这是正常的，公共客户端使用 PKCE，不需要 client_secret
- 确保博客服务已更新到最新版本
- 使用方式 A（Bearer Token）更简单可靠

### 问题 3：无法找到 OAuth 端点

**错误信息**：
```
Failed to discover OAuth endpoints
```

**解决方案**：
1. 检查博客服务是否正常运行
2. 验证 URL 是否正确
3. 检查网络连接

```bash
# 测试 OAuth 端点
curl https://www.nnnnzs.cn/.well-known/oauth-authorization-server
```

### 问题 4：权限不足

**错误信息**：
```
Permission denied: User role does not have access
```

**解决方案**：
1. 确认用户账号有相应权限
2. 联系管理员提升权限
3. 使用管理员账号重新生成 Token

---

## 🔒 安全建议

### Token 管理

1. **妥善保管 Token**
   - 不要分享给他人
   - 不要提交到 Git 仓库
   - 定期更换

2. **设置合理有效期**
   - 开发环境：使用短期 Token（7-30 天）
   - 生产环境：使用永久 Token

3. **撤销不需要的 Token**
   - 定期检查活跃 Token
   - 撤销不再使用的 Token

### 配置安全

```bash
# 不要在公共场合展示完整 Token
claude mcp add MyBlog https://www.nnnnzs.cn/api/mcp \
  --header "Authorization: Bearer LTK_xxx"  # ✅ 好的做法

# ❌ 避免
echo "export MCP_TOKEN=LTK_xxx" >> ~/.bashrc  # 可能泄露
```

---

## 📚 相关文档

- [MCP OAuth 2.0 设计文档](../designs/mcp-oauth-design.md)
- [MCP 合集使用指南](./mcp-collections-guide.md)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

---

## 🆘 获取帮助

### 内置帮助

```bash
# 查看 Claude Code MCP 命令
claude mcp --help

# 查看配置的 MCP 服务器
claude mcp list

# 查看 MCP 服务器详情
claude mcp inspect MyBlog
```

### 联系支持

如果遇到问题：
1. 查看本文档的故障排查部分
2. 检查博客服务日志
3. 提交 Issue 到 GitHub

---

**最后更新**: 2026-03-07
**兼容性**: Claude Code CLI 1.x+
**标准**: OAuth 2.0 RFC 6749, PKCE RFC 7636, MCP SDK

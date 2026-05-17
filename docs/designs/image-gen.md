# AI 图片生成功能设计文档

## 概述

在管理后台新增「AI 图片生成」页面，调用 GPT Image 2 模型（通过 micuapi.ai 中转站），支持文生图和图文编辑。

## API 信息

- **上游端点:** `https://www.micuapi.ai/v1/chat/completions`
- **模型:** `gpt-image-2`
- **认证方式:** `Authorization: Bearer $API_KEY`
- **返回格式:** 图片 URL（OSS 托管，非 base64）

### 文生图

```json
{
  "model": "gpt-image-2",
  "messages": [{ "role": "user", "content": "描述文字" }]
}
```

### 图文编辑

```json
{
  "model": "gpt-image-2",
  "messages": [{ "role": "user", "content": [
    { "type": "text", "text": "编辑指令" },
    { "type": "image_url", "image_url": { "url": "https://..." } }
  ]}]
}
```

### 响应

content 中包含 markdown 图片链接 `![image](https://oss.filenest.top/uploads/xxx.png)`，通过正则提取。

## 系统配置

| 配置 Key | 说明 | 示例值 |
|----------|------|--------|
| `image_gen.api_key` | API 密钥 | `sk-xxx` |
| `image_gen.base_url` | 基础地址 | `https://www.micuapi.ai` |
| `image_gen.model` | 模型名 | `gpt-image-2` |

## 文件结构

```
src/services/
└── image-gen.ts                # 图片生成 service（核心逻辑）
src/app/api/image-gen/
└── route.ts                    # POST: 图片生成 API（鉴权 + 调用 service）
src/lib/
└── api-registry.ts             # MCP 工具注册（handler 引用 service）
src/app/c/image-gen/
└── page.tsx                    # 图片生成页面
src/components/ImageGen/
├── ImageGenPanel.tsx           # 参数配置面板
└── ImageResultCard.tsx         # 结果展示组件
```

## MCP 工具

已注册为 MCP 工具 `generate_image`，支持 Claude 等 AI 客户端直接调用图片生成。

- **工具名**: `generate_image`
- **权限**: `image:view`
- **输入参数**: mode、prompt、image、size、quality

## API 设计

### POST /api/image-gen

**权限:** 仅 admin，支持 LTK 长期 Token

**请求体:**
```typescript
interface ImageGenRequest {
  mode: 'generate' | 'edit';  // 模式
  prompt: string;              // 提示词（必填）
  image?: string;              // 参考图 URL（edit 模式必填）
  size?: string;               // 尺寸，如 1024x1024
  quality?: string;            // 质量：high | medium
}
```

**响应:**
```json
{
  "status": true,
  "message": "成功",
  "data": {
    "imageUrl": "https://oss.filenest.top/uploads/xxx.png",
    "elapsed": "12.3s",
    "model": "gpt-image-2"
  }
}
```

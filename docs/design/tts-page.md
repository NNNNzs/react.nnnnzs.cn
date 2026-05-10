# 语音合成 (TTS) 功能设计文档

## 概述

在博客后台新增「语音合成」页面，对接小米 MiMo TTS 语音模型，实现文字转语音功能。

## API 信息

- **API 基地址:** `https://api.xiaomimimo.com/v1/chat/completions`
- **认证方式:** Header `api-key: $MIMO_API_KEY`
- **请求格式:** OpenAI 兼容的 chat completions 格式

### 模型列表

| 模型 ID | 功能 | 备注 |
|---------|------|------|
| `mimo-v2.5-tts` | 内置高质量音色语音合成 | 支持唱歌模式 |
| `mimo-v2.5-tts-voicedesign` | 文字描述生成自定义音色 | 不支持唱歌/内置音色 |
| `mimo-v2.5-tts-voiceclone` | 从音频样本复制声音 | 不支持唱歌/内置音色 |
| `mimo-v2-tts` | V2 基础模型 | 3个内置音色 |

### 内置音色 (mimo-v2.5-tts)

| 音色名 | ID | 语言 | 性别 |
|--------|-----|------|------|
| 冰糖 | 冰糖 | 中文 | 女 |
| 茉莉 | 茉莉 | 中文 | 女 |
| 苏打 | 苏打 | 中文 | 男 |
| 白桦 | 白桦 | 中文 | 男 |
| Mia | Mia | 英文 | 女 |
| Chloe | Chloe | 英文 | 女 |
| Milo | Milo | 英文 | 男 |
| Dean | Dean | 英文 | 男 |

### 请求格式

```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    {
      "role": "user",
      "content": "风格指令（可选）"
    },
    {
      "role": "assistant",
      "content": "需要合成的文本（必填）"
    }
  ],
  "audio": {
    "format": "wav",
    "voice": "冰糖"
  }
}
```

### 响应格式

非流式：`choices[0].message.audio.data` 返回 base64 编码的音频数据。

### 风格控制

两种方式：
1. **自然语言控制**: 在 `user` message 中描述风格（如"温柔、慢速、像在讲故事"）
2. **标签控制**: 在 `assistant` message 文本中嵌入标签（如 `(开心)今天天气真好！`）

### 音频格式
- `wav` — 非流式使用
- `pcm16` — 流式使用（24kHz PCM16LE mono）

## 系统配置

在博客配置管理（TbConfig 表）中新增以下配置项：

| 配置 Key | 说明 | 示例值 |
|----------|------|--------|
| `tts.api_key` | MiMo API 密钥 | `sk-xxx` |
| `tts.base_url` | API 基地址 | `https://api.xiaomimimo.com/v1` |
| `tts.default_model` | 默认模型 | `mimo-v2.5-tts` |
| `tts.default_voice` | 默认音色 | `冰糖` |

## 文件结构

### 后端 API
```
src/app/api/tts/
├── synthesize/route.ts    # POST: 调用 MiMo TTS API 合成语音
```

### 前端页面
```
src/app/c/tts/
└── page.tsx               # 语音合成管理页面
```

## 页面布局设计

页面分为左右/上下两栏布局：

### 左侧/上方：参数配置区

```
┌─────────────────────────────────────────┐
│  🎙️ 语音合成                            │
├─────────────────────────────────────────┤
│  模型选择: [mimo-v2.5-tts ▼]            │
│  音色选择: [冰糖 ▼]                      │
│  音频格式: [wav ▼]                       │
│                                         │
│  ── 风格指令 (可选) ──                   │
│  ┌───────────────────────────────────┐  │
│  │ 输入自然语言风格描述...              │  │
│  │ 如：温柔、慢速、像在讲故事          │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── 合成文本 ──                          │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  输入需要合成的文本内容...          │  │
│  │                                   │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                        字数: 0          │
│                                         │
│  [🎵 生成语音]                          │
└─────────────────────────────────────────┘
```

### 右侧/下方：结果区

```
┌─────────────────────────────────────────┐
│  ── 生成结果 ──                          │
│                                         │
│  ▶ ━━━━━━━━━━━━━━━━━━━━━ 00:05 / 00:12 │
│                                         │
│  [⬇️ 下载音频]                          │
│                                         │
│  状态: ✅ 合成成功 | 耗时: 3.2s          │
└─────────────────────────────────────────┘
```

## API 设计

### POST /api/tts/synthesize

**请求体:**
```typescript
interface TTSSynthesizeRequest {
  text: string;           // 要合成的文本
  model?: string;         // 模型，默认 mimo-v2.5-tts
  voice?: string;         // 音色，默认 冰糖
  format?: 'wav' | 'mp3'; // 音频格式
  instruction?: string;   // 风格指令（可选）
}
```

**响应:**
```typescript
interface TTSSynthesizeResponse {
  success: boolean;
  data?: {
    audio: string;  // base64 编码的音频数据
    format: string;
    duration?: number; // 估算时长
  };
  message?: string;
}
```

**后端逻辑:**
1. 从 TbConfig 表读取 `tts.api_key` 和 `tts.base_url`
2. 构造 OpenAI 兼容请求，发送到 MiMo API
3. 返回 base64 音频数据给前端

## 技术要点

1. **配置读取**: 复用现有 `getAIConfigValue` / `configByKeys` 体系，以 `tts.` 为前缀
2. **菜单注册**: 在 `src/app/c/layout.tsx` 添加菜单项，使用 `SoundOutlined` 图标
3. **路由守卫**: 在 `adminOnlyPaths` 数组中添加 `/c/tts`
4. **预加载**: 在路由预加载列表中添加 `/c/tts`
5. **音频播放**: 前端使用 `Audio` API 播放 base64 解码后的音频
6. **音频下载**: 使用 `Blob` + `URL.createObjectURL` 实现下载
7. **UI 框架**: 继续使用 Ant Design (antd) 组件库，与现有后台风格一致

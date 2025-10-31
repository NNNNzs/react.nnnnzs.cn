# 字体配置说明

本项目使用本地系统字体，避免依赖 Google Fonts，确保在中国大陆的访问体验。

## 🎨 字体栈

### 无衬线字体（用于正文）

```css
font-family: 
  -apple-system,           /* macOS/iOS 系统默认字体 */
  BlinkMacSystemFont,      /* macOS Chrome */
  "Segoe UI",              /* Windows 11 */
  "Noto Sans",             /* Android/Linux */
  Helvetica,               /* macOS 传统字体 */
  Arial,                   /* Windows 传统字体 */
  "PingFang SC",           /* macOS 中文字体 */
  "Hiragino Sans GB",      /* macOS 旧版中文字体 */
  "Microsoft YaHei",       /* Windows 中文字体（英文名） */
  "微软雅黑",               /* Windows 中文字体（中文名） */
  sans-serif;              /* 系统默认无衬线字体 */
```

### 等宽字体（用于代码）

```css
font-family:
  ui-monospace,            /* 系统默认等宽字体 */
  SFMono-Regular,          /* macOS SF Mono */
  "SF Mono",               /* macOS SF Mono 变体 */
  Menlo,                   /* macOS 传统等宽字体 */
  Consolas,                /* Windows 等宽字体 */
  "Liberation Mono",       /* Linux 等宽字体 */
  "Courier New",           /* 通用等宽字体 */
  monospace;               /* 系统默认等宽字体 */
```

## 📝 配置文件

### 1. globals.css

在 `src/app/globals.css` 中配置全局字体：

```css
@layer base {
  html {
    font-family: 
      -apple-system, 
      BlinkMacSystemFont, 
      "Segoe UI", 
      "Noto Sans", 
      Helvetica, 
      Arial, 
      "PingFang SC", 
      "Hiragino Sans GB", 
      "Microsoft YaHei", 
      "微软雅黑", 
      sans-serif;
  }

  code, pre, kbd, samp {
    font-family: 
      ui-monospace, 
      SFMono-Regular, 
      "SF Mono", 
      Menlo, 
      Consolas, 
      "Liberation Mono", 
      "Courier New", 
      monospace;
  }
}
```

### 2. tailwind.config.ts

在 Tailwind CSS 配置中定义字体：

```typescript
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          // ... 其他字体
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          // ... 其他字体
        ],
      },
    },
  },
}
```

### 3. layout.tsx

移除了 Google Fonts 的引入：

```typescript
// ❌ 旧版本（使用 Google Fonts）
import { Geist, Geist_Mono } from "next/font/google";

// ✅ 新版本（使用系统字体）
// 无需导入字体，直接使用 CSS 配置
```

## 🎯 使用方法

### 在组件中使用

字体会自动应用到所有组件，无需额外配置：

```tsx
// 默认使用无衬线字体
<div className="text-base">普通文本</div>

// 使用等宽字体（代码）
<code className="font-mono">const hello = 'world';</code>

// 使用 Tailwind CSS 字体类
<p className="font-sans">无衬线字体</p>
<p className="font-mono">等宽字体</p>
```

### 自定义字体大小和粗细

```tsx
<h1 className="text-4xl font-bold">标题</h1>
<p className="text-base font-normal">正文</p>
<code className="text-sm font-mono">代码</code>
```

## 🌍 多平台字体显示

### macOS
- 英文：-apple-system / BlinkMacSystemFont
- 中文：PingFang SC

### Windows
- 英文：Segoe UI
- 中文：Microsoft YaHei（微软雅黑）

### Linux
- 英文：Noto Sans
- 中文：Noto Sans CJK SC

### Android/iOS
- 系统默认字体

## 💡 优势

### 1. 无需外部请求
- ✅ 不依赖 Google Fonts CDN
- ✅ 无网络延迟
- ✅ 中国大陆访问友好
- ✅ 隐私保护

### 2. 性能优化
- ✅ 零下载时间
- ✅ 无 FOUT/FOIT 问题
- ✅ 即时渲染
- ✅ 减少首屏加载时间

### 3. 原生体验
- ✅ 使用用户熟悉的系统字体
- ✅ 与操作系统一致的视觉风格
- ✅ 更好的中文显示效果

## 🔧 可选：添加自定义字体

如果需要添加自定义字体（如特殊设计字体），可以使用以下方法：

### 1. 使用本地字体文件

在 `public/fonts/` 目录下放置字体文件：

```
public/
└── fonts/
    ├── custom-font.woff2
    └── custom-font.woff
```

在 `globals.css` 中引入：

```css
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom-font.woff2') format('woff2'),
       url('/fonts/custom-font.woff') format('woff');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

在 `tailwind.config.ts` 中配置：

```typescript
fontFamily: {
  custom: ['CustomFont', ...defaultTheme.fontFamily.sans],
}
```

使用：

```tsx
<div className="font-custom">使用自定义字体</div>
```

### 2. 使用国内 CDN

如果必须使用 Web 字体，可以使用国内 CDN：

```css
/* 使用字节跳动的字体 CDN */
@import url('https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/fonts/...');

/* 或使用 CDN 托管的开源字体 */
@import url('https://cdn.jsdelivr.net/npm/@fontsource/...');
```

## 📱 移动端优化

系统字体在移动端有更好的性能和显示效果：

```css
/* 移动端特定优化 */
@media (max-width: 768px) {
  html {
    /* 移动端使用系统默认字体 */
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }
}
```

## 🎨 代码高亮字体

Markdown 代码块使用等宽字体：

```tsx
<ReactMarkdown
  components={{
    code: ({ node, inline, className, children, ...props }) => (
      <code 
        className={`${inline ? 'inline-code' : 'block-code'} font-mono`}
        {...props}
      >
        {children}
      </code>
    ),
  }}
>
  {content}
</ReactMarkdown>
```

## 🔍 字体回退机制

如果某个字体不可用，会自动回退到下一个字体：

```
用户系统有 PingFang SC → 使用 PingFang SC
用户系统没有 PingFang SC → 尝试 Hiragino Sans GB
用户系统没有 Hiragino Sans GB → 尝试 Microsoft YaHei
... 依此类推
最后回退 → sans-serif（系统默认字体）
```

## 📚 相关资源

- [System Font Stack](https://systemfontstack.com/)
- [Modern Font Stacks](https://modernfontstacks.com/)
- [Web 字体最佳实践](https://web.dev/font-best-practices/)
- [中文字体解决方案](https://github.com/zenozeng/fonts.css)


# Header 样式控制

## 概述

本项目支持在不同页面中动态控制 Header 组件的样式，包括定位方式（固定/静态）和透明度（滚动透明/始终显示）。

## 实现方案

使用 React Context API 创建了一个 `HeaderStyleContext`，允许页面通过 Hook 控制 Header 的样式。

## 使用方法

### 1. 在页面中引入 Hook

```typescript
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
```

### 2. 在组件中使用

```typescript
function MyPage() {
  const { setHeaderStyle, resetHeaderStyle } = useHeaderStyle();

  useEffect(() => {
    // 设置 Header 为静态定位，始终显示（不透明）
    setHeaderStyle({
      static: true,      // true = static, false = fixed
      alwaysVisible: true, // 是否始终显示
    });

    // 组件卸载时重置为默认值
    return () => {
      resetHeaderStyle();
    };
  }, [setHeaderStyle, resetHeaderStyle]);

  // ... 页面其他代码
}
```

## 配置选项

### `HeaderStyle` 接口

```typescript
interface HeaderStyle {
  static: boolean;      // 是否使用静态定位
                        // - true:  static (默认背景色，不随滚动变化)
                        // - false: fixed (随滚动变化透明度)
  alwaysVisible: boolean; // 是否始终显示
                        // - true:  始终不透明
                        // - false: 根据滚动计算透明度
}
```

## 默认行为

- **默认值**: `static: false, alwaysVisible: false`
- **效果**: Header 固定在顶部，随滚动变化透明度（滚动时逐渐变不透明）

## 使用场景

### 管理后台页面

管理后台通常需要清晰的导航，建议使用静态定位：

```typescript
// src/app/c/config/page.tsx
// src/app/c/user/page.tsx  
// src/app/c/post/page.tsx

useEffect(() => {
  setHeaderStyle({
    static: true,
    alwaysVisible: true,
  });
  return () => resetHeaderStyle();
}, [setHeaderStyle, resetHeaderStyle]);
```

### 前台页面

前台页面可以使用默认的滚动效果：

```typescript
// 无需特殊设置，使用默认行为即可
```

## 技术实现

### Context 结构

```typescript
interface HeaderStyleContextType {
  headerStyle: HeaderStyle;
  setHeaderStyle: (style: HeaderStyle) => void;
  resetHeaderStyle: () => void;
}
```

### Provider 位置

在 `src/app/layout.tsx` 中包裹整个应用：

```typescript
<HeaderStyleProvider>
  <AntdRegistry>
    <ConfigProvider>
      <body>
        <Header />
        {children}
      </body>
    </ConfigProvider>
  </AntdRegistry>
</HeaderStyleProvider>
```

### Header 组件适配

Header 组件根据 `headerStyle` 动态调整 className 和 style：

```typescript
<header
  className={`header top-0 z-999 ${
    headerStyle.static 
      ? 'static bg-white dark:bg-slate-700 text-slate-900 dark:text-white' 
      : 'fixed backdrop-blur-md bg-white text-slate-900 dark:bg-slate-700 dark:text-white'
  }`}
  style={
    headerStyle.static
      ? undefined
      : { opacity: headerOpacity < 0.1 ? 0 : Math.max(headerOpacity, 0.6) }
  }
>
```

## 最佳实践

1. **始终重置**: 在 `useEffect` 的 cleanup 函数中调用 `resetHeaderStyle()`
2. **依赖数组**: 确保将 `setHeaderStyle` 和 `resetHeaderStyle` 加入依赖数组
3. **尽早设置**: 在组件挂载后尽早设置 Header 样式
4. **避免冲突**: 不同页面间的 Header 样式设置不会冲突，因为会在组件卸载时自动重置

## 故障排除

### Header 样式没有生效

1. 确保 `HeaderStyleProvider` 已正确包裹在 layout 中
2. 检查是否在组件卸载时正确重置
3. 确认 Hook 调用在组件内部（不在条件语句中）

### 类型错误

确保正确导入类型：

```typescript
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
```

## 相关文件

- `src/contexts/HeaderStyleContext.tsx` - Context 定义
- `src/components/Header.tsx` - Header 组件适配
- `src/app/layout.tsx` - Provider 配置
- `src/app/c/config/page.tsx` - 使用示例
- `src/app/c/user/page.tsx` - 使用示例
- `src/app/c/post/page.tsx` - 使用示例

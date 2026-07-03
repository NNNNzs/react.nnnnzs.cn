# Ant Design v6 迁移手册

> 本手册用于项目内所有 Ant Design 组件开发和修改。新增或调整 `antd` 组件前，先阅读本文，再查看官方组件 API。

## 适用范围

- 当前项目固定使用 `antd@6.1.1`、`@ant-design/icons@^6.1.0`。
- v6 对部分 v5 API 保留兼容，但会产生 deprecated warning；这些写法应视为禁止继续新增。
- 迁移以“消除控制台 warning、兼容后续 v7 移除”为目标，避免继续按 v5 记忆写组件。

## 必查资料

- 官方迁移指南：[Ant Design v5 升级 v6](https://ant.design/docs/react/migration-v6-cn)
- 组件 API 文档：[Ant Design Components](https://ant.design/components)
- 项目扫描工具：`@ant-design/cli`

## 开发前检查流程

1. 使用或修改 `antd` 组件前，先在本文查新旧 API 对照。
2. 本文没有覆盖时，查官方迁移指南和目标组件 API。
3. 修改后运行 deprecated 扫描：

```bash
pnpm dlx @ant-design/cli --version 6.1.1 --lang zh --format markdown lint --only deprecated src
```

4. 大范围迁移前先生成迁移提示，不直接自动改：

```bash
pnpm dlx @ant-design/cli --version 6.1.1 --lang zh --format markdown migrate 5 6 --apply src
```

## 项目常见迁移对照

| 组件 | v5/兼容旧写法 | v6 推荐写法 |
| --- | --- | --- |
| `Button` | `type="primary"` | `color="primary" variant="solid"` |
| `Button` | `type="link"` | `variant="link"` |
| `Button` | `type="text"` | `variant="text"` |
| `Button` | `danger` | `color="danger"` |
| `Button` | `ghost` | `variant="outlined"` |
| `Button` | `iconPosition="end"` | `iconPlacement="end"` |
| `Space` | `direction="vertical"` | `orientation="vertical"` |
| `Space` | `split={...}` | `separator={...}` |
| `Alert` | `message="标题"` | `title="标题"` |
| `Alert` | `closable onClose={fn}` | `closable={{ onClose: fn }}` |
| `Modal` | `destroyOnClose` | `destroyOnHidden` |
| `Select` | `onDropdownVisibleChange={fn}` | `onOpenChange={fn}` |
| `Select` | `optionFilterProp="label"` | `showSearch={{ optionFilterProp: "label" }}` |
| `Select` | `filterOption={fn}` | `showSearch={{ filterOption: fn }}` |
| `Select` | `bordered={false}` | `variant="borderless"` |
| `Divider` | `type="vertical"` | `orientation="vertical"` |
| `Statistic` | `valueStyle={{ ... }}` | `styles={{ content: { ... } }}` |
| `Drawer` | `bodyStyle/headerStyle/footerStyle` | `styles.body/styles.header/styles.footer` |
| `Modal` | `bodyStyle/maskStyle` | `styles.body/styles.mask` |
| `Dropdown` | `overlayClassName/overlayStyle` | `classNames.root/styles.root` |
| `Image` | `visible/onVisibleChange` | `open/onOpenChange` |
| `Image` | `toolbarRender` | `actionsRender` |
| `Tabs` | `Tabs.TabPane` | `items` |
| `Timeline` | `Timeline.Item` | `items` |

## Form 实例连接警告

如果使用 `const [form] = Form.useForm()`，必须保证同一轮渲染里存在连接它的 `<Form form={form}>`。

常见触发场景：

- 表单放在默认关闭的 `Modal` 内。
- 表单放在非默认激活的 `Tabs` 页内。
- 页面 loading/fetching 时提前 `return`，实际表单还没有渲染。
- 表单被 `record && <Form form={form}>` 这类条件整体包住。

推荐处理：

```tsx
// Modal 内表单
<Modal open={open} forceRender destroyOnHidden>
  <Form form={form}>...</Form>
</Modal>
```

```tsx
// Tabs item 内表单
{
  key: "register",
  label: "注册",
  forceRender: true,
  children: <Form form={form}>...</Form>,
}
```

```tsx
// loading 提前 return 时连接实例，不生成额外 DOM
if (loading) {
  return (
    <div>
      <Form form={form} component={false} />
      <Spin />
    </div>
  );
}
```

## 示例

### Button

```tsx
// 不要继续使用
<Button type="primary" danger>
  删除
</Button>

// 推荐
<Button color="danger" variant="solid">
  删除
</Button>
```

### Space

```tsx
// 不要继续使用
<Space direction="vertical" split={<span>·</span>}>
  ...
</Space>

// 推荐
<Space orientation="vertical" separator={<span>·</span>}>
  ...
</Space>
```

### Alert

```tsx
// 不要继续使用
<Alert message="加载失败" closable onClose={clearError} />

// 推荐
<Alert title="加载失败" closable={{ onClose: clearError }} />
```

### Select 搜索

```tsx
// 不要继续使用
<Select showSearch optionFilterProp="label" />

// 推荐
<Select showSearch={{ optionFilterProp: "label" }} />
```

```tsx
// 不要继续使用
<Select
  filterOption={(input, option) =>
    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
  }
/>

// 推荐
<Select
  showSearch={{
    filterOption: (input, option) =>
      (option?.label ?? "").toLowerCase().includes(input.toLowerCase()),
  }}
/>
```

## 迁移后验收

- `@ant-design/cli lint --only deprecated` 必须没有 deprecated warning。
- `pnpm typecheck` 必须通过。
- 如果调整了弹窗、抽屉、下拉、图片预览等 portal 组件，需要在真实页面检查样式，因为 v6 对部分组件 DOM 结构做了优化。

## 维护规则

- 遇到新的 deprecated warning，先修代码，再把新旧 API 对照补充到本文。
- 不要只在业务页面写一次性注释；可复用经验应沉淀到本手册。
- 不要因为 v6 仍兼容旧 API 就继续新增旧写法。

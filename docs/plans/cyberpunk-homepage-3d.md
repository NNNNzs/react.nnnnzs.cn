# 赛博朋克 3D 首页改造计划

> **状态**：🔄 进行中（阶段一）
> **创建时间**：2025-05-18
> **合集**：小破站建设

---

## 一、愿景

把"小破站"首页改造成一个**赛博朋克风格的 3D 数字空间**。

核心理念：**赛博朋克废土中，一个被你不断修复、扩建的小站点**。

最终形态（远期目标）：全沉浸式 3D 世界，用户在其中探索你的博客内容——
- 合集 = 建筑群
- 文章 = 可交互的数据终端 / 全息面板
- 标签 = 功能区域
- 博客成长 = 世界扩张

**但现阶段只做第一步：3D Banner**，为后续全沉浸式打好地基。

---

## 二、博客内容 → 赛博朋克元素映射

### 合集映射（9 个合集 → 9 个建筑/区域）

| 合集 | 文章数 | 赛博朋克映射 | 场景元素 |
|------|--------|-------------|----------|
| 生活感悟 | 29 | 霓虹阳台/天台 | 雨夜阳台、霓虹灯、城市天际线、全息相框 |
| 前端开发 | 27 | 代码实验室 | 多屏工作台、代码雨投影、React/Three.js 徽标 |
| 运维实践 | 12 | 服务器机房 | 机架、闪烁指示灯、网线管道、温度显示屏 |
| 工具开发 | 12 | 工坊/制造间 | 机械臂、焊接火花、工具墙、蓝图桌 |
| 算法题解 | 11 | 数据中枢 | 晶体矩阵、二进制瀑布、逻辑电路墙 |
| 小破站建设 | 13 | 施工现场/指挥中心 | 蓝图、脚手架、全息投影规划图 |
| 旅行游记 | 9 | 交通枢纽/站台 | 全息地图、悬浮列车、旅行票据墙 |
| 大模型学习 | 6 | AI 研究所 | 全息 AI 头像、神经网络可视化、对话终端 |
| 全屋智能之路 | 5 | 物联网控制室 | 智能家居面板、传感器墙、灯光控制台 |

### 标签映射（主要标签分类）

| 标签类别 | 赛博朋克元素 |
|---------|-------------|
| 前端（Vue/React/Next.js/TypeScript） | 代码雨、全息 IDE、浏览器窗口 |
| AI/LLM/MCP/LangChain/Agent | 全息 AI 头像、神经网络节点、对话气泡 |
| 运维/Docker/NAS/DevOps | 服务器机架、网线、监控屏幕 |
| 智能家居/Home Assistant/蓝牙 | IoT 设备墙、传感器、灯光面板 |
| 生活/旅游/忧伤感怀 | 雨夜天台、霓虹街道、旅行全息照片 |
| 调试/踩坑记录 | 警报灯、故障面板、修复机器人 |
| 架构设计 | 蓝图桌、城市鸟瞰模型 |

---

## 三、技术方案

### 技术栈

- **Three.js** — 3D 渲染引擎
- **React Three Fiber (R3F)** — React 渲染器，与现有 Next.js 无缝集成
- **@react-three/drei** — 常用 3D 组件（OrbitControls、Environment、Text3D 等）
- **@react-three/postprocessing** — 后处理效果（Bloom 霓虹发光、Vignette 等）
- **@use-gesture/react** — 手势交互（可选）

### 模型来源策略

**不需要自己建模。** 优先级：

1. **免费模型库**（首选）
   - Sketchfab（sketchfab.com）— 搜 cyberpunk keyboard / monitor / neon sign 下载 GLB
   - Poly Pizza（poly.pizza）— 免费可商用
   - Poly Haven（polyhaven.com）— 免费材质/HDR

2. **AI 生成**（找不到时）
   - Meshy API — 文字/图片生成 3D 模型

3. **代码生成**（简单几何体）
   - 地板、墙壁、桌子 → Three.js 基础几何体
   - 粒子系统 → 代码实现

### 性能策略

- 3D 场景仅占首屏，不阻塞文章列表加载
- 使用 Suspense + lazy 加载 3D 组件
- 模型使用 Draco 压缩（GLTFLoader + DRACOLoader）
- 低端设备自动降级（检测 WebGL 支持后回退为静态 Banner）
- 控制多边形数：单模型 < 50k 面，总场景 < 200k 面

---

## 四、分阶段实施路线

### 🟢 阶段一：3D Cyberpunk Banner（当前目标）

**目标**：把现有全屏背景图 Banner 替换为 3D 赛博朋克场景，首屏沉浸，下方保持文章列表不变。

#### 场景描述（已确认）

一个赛博朋克风格的**完整小公寓房间**，有人住着的生活感，不只是一个工位。广角展示整个空间。

**提示词参考**（用于 AI 生成效果图）：
> Interior of a small cyberpunk apartment room at night, wide shot showing the full space with depth and multiple areas. Left side: a bed pushed against the wall with a glowing neon poster above it, a small bedside table with a holographic clock. Center: a desk area with glowing keyboard and dual monitors, but not the main focus — just one part of the room. Right side: a tall bookshelf filled with glowing data cores and old books, a small server rack humming in the corner with blinking LED indicators. Back wall: a large window from floor to ceiling, rain streaking down the glass, revealing a sprawling neon-lit cyberpunk city skyline with flying vehicles. Floor: scattered cables, a robot pet sitting idle, a coffee mug on the desk, a jacket draped over a chair, a potted plant with bioluminescent leaves. Ceiling: exposed pipes and ducts with faintly glowing neon strips. A neon Chinese sign "小破站" hangs above the window. Atmospheric fog near the floor, neon light bleeding through the window, bloom and glow on emissive surfaces. Color palette: deep navy, dark purple shadows, neon cyan #00f0ff and magenta #ff0066 accents throughout. Cozy but tech-heavy, lived-in feel, like someone actually inhabits this space. Photorealistic 3D render, Unreal Engine 5, 8K, cinematic, no people.

**房间分区与元素：**

| 区域 | 位置 | 元素 |
|------|------|------|
| 睡眠区 | 左侧 | 床、墙上发光海报、床头柜+全息时钟 |
| 工作区 | 中央偏右 | 桌子、发光键盘、双显示器 |
| 存储/服务器区 | 右侧 | 书架（发光数据核心+旧书）、服务器机架+LED 指示灯 |
| 窗户区 | 后墙 | 落地窗、雨水、赛博朋克城市天际线 |
| 生活细节 | 地面/各处 | 散落线缆、机器人宠物、咖啡杯、外套搭椅上、生物发光盆栽 |
| 天花板 | 顶部 | 暴露管道、微弱霓虹灯条 |
| 标识 | 窗户上方 | 霓虹灯牌"小破站" |

#### 需要的模型清单

| 元素 | 来源 | 优先级 |
|------|------|--------|
| 床 | Sketchfab 下载 / 代码几何体 | P0 |
| 书架 | Sketchfab 下载 | P0 |
| 服务器机架（小型） | Sketchfab / Meshy | P0 |
| 桌子 | 代码生成几何体 | P0 |
| 地板/墙壁/天花板 | 代码生成 | P0 |
| 落地窗（带城市天际线贴图） | 代码几何体 + 贴图 | P0 |
| 赛博朋克键盘 | Sketchfab 下载 | P1 |
| 显示器/屏幕 | Sketchfab 下载 | P1 |
| 霓虹灯牌"小破站" | 代码生成 + emissive | P1 |
| 咖啡杯/小物件 | Sketchfab | P2 |
| 机器人宠物 | Sketchfab / Meshy | P2 |
| 椅子 + 外套 | Sketchfab | P2 |
| 生物发光盆栽 | Sketchfab | P2 |
| 床头柜 + 全息时钟 | 代码组合 | P2 |

#### 技术任务

- [ ] 安装依赖：`three` `@react-three/fiber` `@react-three/drei` `@react-three/postprocessing`
- [ ] 创建 `CyberpunkBanner` 组件（替换现有 Banner）
- [ ] 搭建基础场景：房间几何体（地板/墙/天花）+ 相机 + 灯光
- [ ] 配置 Bloom 后处理管线
- [ ] 加载 GLB 模型（键盘、显示器、服务器）
- [ ] 实现雨滴效果（粒子系统）
- [ ] 实现鼠标视差
- [ ] 实现滚动过渡（3D → 文章列表）
- [ ] 性能优化 + 低端设备降级方案
- [ ] 移动端适配（触摸交互）

---

### 🔵 阶段二：书架与合集入口（下一步）

**目标**：在 3D 场景中加入书架，书架上的"书"对应博客合集，点击可跳转。

- 书架模型（Sketchfab / 代码组合）
- 每个合集 = 书架上一排发光的书/数据模块
- hover 显示合集名称 + 文章数
- 点击跳转到合集页

---

### 🟣 阶段三：文章列表 3D 化

**目标**：文章列表融入 3D 世界。

- 文章 = 墙上的全息面板 / 数据终端
- 最近文章显示在主屏幕上
- hover → 面板展开，显示标题/摘要
- 点击 → 进入文章页

---

### 🔴 阶段四：全沉浸式 + 世界成长（远期）

**目标**：整个首页变成可自由探索的 3D 空间。

- 多个房间/区域对应不同合集
- 标签 = 区域标识灯
- 博客数据驱动场景变化（新文章 → 新建筑亮灯）
- 天气系统（雨/晴）、昼夜循环
- 背景音乐
- 用户在空间中"漫步"浏览博客

---

## 五、场景设计参考

### 视觉参考

- 赛博朋克雨夜室内
- 霓虹灯 + Bloom 后处理
- 赛博朋克 3D 桌面（Awwwards 上的 cyberpunk interactive 3D desk）
- 赛博朋克工作站

### 色调

- 主色：深蓝 / 暗紫（背景）
- 强调色：霓虹蓝（#00f0ff）、霓虹粉（#ff0066）、霓虹绿（#00ff88）
- 暗部：纯黑 / 深灰（墙壁、地板）

---

## 六、风险与注意事项

1. **性能**：3D 场景可能影响首屏加载速度 → 使用 Suspense + 降级方案
2. **SEO**：3D Canvas 内容不可被搜索引擎索引 → 保持 HTML 文字标题层
3. **移动端**：手机 GPU 性能有限 → 简化模型/粒子数，或使用静态截图
4. **可维护性**：模型文件需要版本管理 → 放在 public/models/ 目录
5. **渐进增强**：每个阶段独立可用，不依赖下一阶段完成

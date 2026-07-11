# 赛博朋克博客 Blender 建模路线

> 状态：进行中
> 更新时间：2026-07-11
> 关联计划：`cyberpunk-homepage-3d.md`

## 背景

现有赛博朋克 3D 设计稿更接近电影级概念渲染，不适合直接作为 Three.js 建模依据。Meshy、混元等图生 3D 工具可以快速生成整体外形，但对多视图对应关系、部件拆分、节点命名和交互层级的理解不稳定。

本路线改为使用 Blender 做确定性的模块化建模，Three.js 负责场景组合、材质切换和交互。

## 目标

- 使用低面数、带小倒角的模块化家具，而不是追求写实高模。
- 每件家具导出为可交互的 GLB/glTF。
- 组件、材质、灯带和碰撞体保持清晰的节点层级。
- 保留赛博朋克氛围，但把主要视觉重量交给灯光、材质、构图和少量后处理。
- 让移动端仍然可以回退到低性能渲染档位。

## 资产生产流程

```text
设计稿 / 场景布局
        ↓
确定家具尺寸、部件和交互目标
        ↓
Blender 建模与命名
        ↓
材质、灯带、碰撞体和原点检查
        ↓
导出 GLB
        ↓
Three.js 加载、组合和交互
        ↓
桌面端 / 移动端性能验证
```

## 建模约束

- 优先使用 Box、Plane、Cylinder、简单 Bevel 和重复模块。
- 家具不要合并成一个不可区分的 Mesh。
- 每个可交互部件使用独立节点，例如 `cushion_left`、`server_door`、`book_unit`。
- 每件家具使用一个根节点，根节点原点位于物体底部中心。
- 每件家具提供独立的简化碰撞体，命名为 `collider_<asset>`。
- 灯带使用独立 emissive 网格，不把实际灯光逻辑烘焙进模型。
- 不把摄像机、灯光和页面 UI 导出到家具 GLB 中。
- 默认使用米制和 1:1 尺寸。

## 第一批资产

### 1. 沙发

作为第一件验证资产，沙发需要拆分为：

```text
sofa_root
├── sofa_base
├── backrest
├── cushion_left
├── cushion_right
├── armrest_left
├── armrest_right
├── feet
├── accent_strip_cyan
├── accent_strip_magenta
└── collider_sofa
```

参考图：`docs/plans/images/cyberpunk-homepage-layout/sofa-multiview-single-object-v2.png`

### 2. 文章终端

- 外壳、屏幕、底座和发光边框分离。
- 屏幕内容继续使用 Three.js 的 `CanvasTexture`，不烘焙文章文字。
- 点击终端时由 HTML 层打开真实文章列表。

### 3. 工作区与服务器机架

- 桌面、显示器、键盘、机架、抽屉和 LED 分开。
- 提交、部署、文章数据继续由现有数据接口驱动。
- 服务器机架优先做抽屉拉出和状态灯交互。

## 视觉策略

- 几何体：低面数、结构清晰、统一小倒角。
- 材质：深色哑光金属、低饱和织物、少量半反射面。
- 灯光：每个区域一个主要光源，避免所有家具底部都挂霓虹灯带。
- 后处理：夜间少量 Bloom 和 Vignette，白天默认关闭或降到很低。
- 内容：文章标题、摘要和导航始终保留在 HTML 层，保证可读性和 SEO。

## 本轮全景建模计划

### 输出物

- Blender 主场景：`assets/blender/cyberpunk-homepage-room.blend`
- 程序化建模脚本：`scripts/blender/create_cyberpunk_homepage_room.py`
- 昼夜预览渲染脚本：`scripts/blender/render_cyberpunk_homepage_previews.py`
- 日间预览：`docs/plans/images/cyberpunk-homepage-layout/blender-room-preview-v1.png`
- 夜间预览：`docs/plans/images/cyberpunk-homepage-layout/blender-room-preview-night-v1.png`
- 本轮先完成可整体检查的模块化房间，后续再按家具根节点分别导出 GLB。

### 坐标、尺寸与镜头

- 房间尺寸沿用当前 Three.js 基准：宽 `7.2m`、深 `7.3m`、高 `4.85m`。
- Blender 使用 `+X = 东`、`+Y = 北`、`+Z = 上`；导出 glTF 后对应 Three.js 的 `+X = 东`、`-Z = 北`、`+Y = 上`。
- 西南侧保持开放，主镜头从西南室内角落看向东北，避免墙体遮挡全景。
- 本轮模型为当前页面空间关系的 Blender 版本，不照抄参考图底部的色块图例。

### Collection 拆解

| Collection | 内容 | 交互与导出边界 |
|---|---|---|
| `ARCHITECTURE` | 地板、地砖、北墙、东墙、墙板、踢脚线、顶梁 | 房间共享硬装，不进入单件家具 GLB |
| `WORKSTATION` | 工作桌、三联屏、键盘、鼠标、电竞椅、服务器机架 | 显示器屏幕、服务器抽屉和 LED 独立 |
| `BOOKSHELF_ZONE` | 书柜、书本、档案盒、顶部植物 | 每组书本保持独立，可映射合集入口 |
| `LIVING_ZONE` | 沙发、地毯、茶几、文章终端、杯子 | 坐垫、终端屏幕和 collider 独立 |
| `SLEEP_ZONE` | 床、床垫、被子、枕头、床头柜、衣柜、墙面装饰 | 柜门、被褥、灯具和 collider 独立 |
| `LIGHT_FIXTURES` | 青色灯槽、粉色墙灯、床头暖灯、屏幕与 LED 发光网格 | 只负责可见灯具和 emissive 网格 |
| `SCENE_LIGHTS` | 区域主光、轮廓光、床头暖光、终端局部光 | 不进入家具 GLB，由 Three.js 重新配置 |
| `COLLIDERS` | 沙发、终端、桌、服务器、书柜、床、衣柜简化碰撞体 | 默认隐藏渲染，保留清晰命名 |

### 家具与部件拆解

#### 1. 西北工作技术区

- `desk_root`：桌面、两侧抽屉柜、横向支撑、金属脚和走线槽。
- `monitor_group_root`：三块显示器分别包含边框、屏幕、立柱和底座，中屏略高，两侧屏轻微内收。
- `keyboard_root`：键盘主体和分区键帽；鼠标保持独立节点。
- `chair_root`：五星脚、脚轮、气杆、坐垫、靠背、头枕和左右扶手。
- `server_rack_root`：机柜外壳、前框、八组独立服务器抽屉、散热缝、青/粉/绿状态 LED。
- 小物：桌面咖啡杯、短线缆；不增加抢占焦点的大型装饰屏。

#### 2. 东北内容书柜区

- `bookshelf_root`：左右立柱、顶板、底板、五层隔板和背板。
- `book_unit_*`：多组不同宽度与高度的书、档案盒和横放书堆，保持独立节点。
- `plant_root`：花盆、土壤、低面数叶片，作为生活感点缀。
- 层板下仅保留两段青色工作灯，避免整柜泛光。

#### 3. 中央客厅与文章入口

- `sofa_root`：底座、左右扶手、靠背、两个独立坐垫、短脚；使用小倒角和织物材质，不做发光底座。
- `rug_root`：低矮织物平面和窄边框，负责划分客厅范围。
- `coffee_table_root`：桌面、四脚、下层置物板和一本薄册。
- `article_terminal_root`：楔形底座、斜置屏幕、屏幕边框、底部绿色状态条；屏幕只用占位材质，真实文章继续由 Three.js `CanvasTexture` 驱动。

#### 4. 东侧睡眠生活区

- `bed_root`：床架、床头板、床垫、被子和两个枕头；被子与枕头采用圆角体，避免纯方块堆叠。
- `nightstand_root`：柜体、抽屉、把手和顶部暖光灯。
- `wardrobe_root`：柜体、顶檐、左右柜门、把手和顶部青色状态灯；柜门保持独立节点。
- `wall_art_root`：深色画框和低亮度青/粉色几何画面。

### 硬装与地板拆解

- 地板：深蓝黑底层 + `0.8m` 左右的大块模块地砖；通过少量凹槽和交错缝线形成工业感，不依赖高分辨率贴图。
- 墙体：北墙与东墙采用深色哑光面板，增加竖向分缝、踢脚线和上沿结构梁。
- 顶部：只保留两道粗结构梁和少量灯槽，不复制当前场景中过密的装饰管线。
- 西南侧保持开放，既服务 Blender 全景验收，也符合首页默认相机进入动线。

### 材质拆解

| 材质 | 用途 | 关键参数方向 |
|---|---|---|
| `M_Floor_DarkMetal` | 地板基底与地砖 | 深蓝黑、中高 roughness、轻微 metallic |
| `M_Wall_Matte` | 墙板与顶面 | 接近黑色、哑光、弱反射 |
| `M_GraphiteMetal` | 桌架、机柜、终端、家具结构 | 石墨灰、细小倒角、高 roughness |
| `M_DarkWood` | 桌面、床头柜、床头板 | 低饱和深棕、半哑光 |
| `M_Fabric_Charcoal` | 沙发和椅子 | 炭灰、低 metallic、高 roughness |
| `M_Bedding_Navy` | 被子与床品 | 深海军蓝、柔和高 roughness |
| `M_Screen_Dark` | 显示器和终端屏幕底色 | 深蓝黑、轻微反射 |
| `M_Emit_Cyan` / `Magenta` / `Green` / `Warm` | 灯槽、屏幕图形、LED、床头灯 | 独立 emissive 网格，控制数量与强度 |
| `M_Book_*` | 书本和档案盒 | 青、紫、蓝、灰的低饱和组合 |

### 灯具与光源拆解

- 工作区主灯：书桌/显示器上方青色 Area Light，覆盖工作台但不照亮全屋。
- 内容墙辅灯：书柜层板下两段青色发光灯槽，使用一盏低强度 Area Light 补足层次。
- 东墙轮廓灯：一条粉色墙灯和对应弱 Area Light，用于分离衣柜与墙面。
- 床头暖灯：床头柜灯具使用暖色 emissive，配一盏小范围 Point Light。
- 文章终端焦点：绿色状态条只配小范围局部光，屏幕本身保持青色信息面，不与三联屏争亮度。
- 全局光：低强度冷色环境光 + 一盏从西南上方进入的柔和 Area Light，保证暗部仍可读。
- 纪律：不在沙发、床、地毯和桌子底部重复铺灯带；发光网格和真实光源分 Collection 管理。

### 分阶段执行与验收

1. **结构阶段**：建立房间、地板和 Collection，确认米制、坐标、镜头与构图。
2. **大件阶段**：完成工作区、书柜、客厅、睡眠区的主要轮廓和节点层级。
3. **细节阶段**：补显示器、服务器抽屉、书本、柜门、坐垫、床品、杯子和植物。
4. **材质阶段**：统一石墨金属、深木、织物、床品、屏幕和四类 emissive 材质。
5. **灯光阶段**：按区域建立主光/辅光，先保证文章终端焦点，再平衡工作区和床区。
6. **验证阶段**：检查命名、尺寸、Collection、材质、modifier、碰撞体、相机遮挡与低成本渲染。
7. **保存阶段**：保存 `.blend` 与预览图；GLB 拆分导出在下一轮逐资产执行。

### 本轮进展（2026-07-11）

- [x] 已生成 `cyberpunk-homepage-room.blend`，共 `320` 个对象、`25` 个材质和 `8` 个 Collection。
- [x] 已建立 `17` 个资产根节点、`8` 个独立 collider 和 `6` 盏实际光源。
- [x] 已使用 EEVEE 完成 `1280 × 720` 昼夜双预览，并根据预览校正线性色值、曝光和区域灯光；`blender-room-preview-v1.png` 在 Git 中没有可恢复历史，因此由脚本重新渲染为日间图，夜间图使用独立文件保留。
- [x] 已检查对象尺寸、材质槽、自动编号命名、房间边界与 collider 渲染可见性；未发现异常项。
- [x] 已导出完整房间 GLB，并由 `LoadedSceneBanner` 在首页加载；材质节点已修复为可正确导出的单一 Principled BSDF 图。
- [x] 完整 GLB 已保留显示器、文章终端、书本、服务器抽屉与 LED 等独立节点名。
- [x] 完整 GLB 已从“仅几何显示”推进到具备 P0 数据内容和场景导航。
- [x] 已恢复三联屏 commit/deploy/post 数据纹理、文章终端轮播与跳转、五区热点、镜头飞行、自由探索和返回全景。
- [x] 已恢复书架合集 hover/click/详情/跳转，以及服务器抽屉动画、部署详情和 LED 状态/呼吸效果。
- [x] 已恢复夜间雨滴、滚动淡出和场景错误边界；按需求删除 WebGL 静态降级，首页始终加载完整 GLB。
- [x] 已复用旧版默认/五区相机、日间灯光与 HUD，并以轻量 Three.js 环境层补回北窗城市和房间围护。
- [x] 已绕开 Blender 倒角 box 的 UV 图集裁切：在三联屏和文章终端正面生成完整 `0–1` UV 的运行时平面，动态文字比例与裁切恢复正常。
- [x] 已提高夜间环境/区域补光并收敛 Bloom/Vignette；Canvas 保持高 DPR，后处理使用 `8×` multisampling，不做降质抗锯齿优化。
- [x] GLB 开发调参工具按需求取消；不迁移 Leva、TransformControls 和 FPS 面板。
- [ ] 后续只在确有独立加载或性能收益时评估按家具根节点分别导出 GLB；拆分不是恢复交互的前置条件。

### Three.js 交互绑定契约（2026-07-11）

完整场景 GLB 可以继续交互，关键是不能只渲染根 `<primitive>`，需要按稳定节点名建立绑定层。

| 功能 | GLB 节点 | Three.js 责任 |
|---|---|---|
| 左/中/右显示器内容 | `monitor_left_screen`、`monitor_center_screen`、`monitor_right_screen` | 在节点正面创建完整 UV 运行时平面，分别显示 commit、deploy、post 数据 |
| 文章终端 | `article_terminal_screen` | 运行时平面显示最近文章 CanvasTexture，保留自动轮播与点击跳转 |
| 合集书本 | `book_unit_*` | 将前 24 个节点映射到 `collections`，实现 hover 抽出、click 卡片和合集跳转 |
| 服务器抽屉 | `server_drawer_*` | 映射部署记录，实现 hover/click 位移动画与详情面板 |
| 服务器状态灯 | `server_led_*` | 根据 deploying/success/failure 更新颜色、发光和呼吸动画 |
| 衣柜门 | `wardrobe_door_*` | 保留独立旋转轴，后续可选开合交互 |
| 区域热点 | 各 `*_root` 空节点 | 计算世界包围盒中心，生成热点位置与相机 target，避免手写坐标再次漂移 |

交互实现应维护一份节点注册表，并在模型加载后校验必需节点；缺少必需节点时在开发环境明确报警，不允许静默丢失功能。

## 验收清单

- [x] Blender 资产能单独打开并检查节点层级。
- [x] GLB 中没有意外合并的家具部件。
- [x] 根节点原点、尺寸和朝向符合场景坐标约定。
- [ ] 当前完整 GLB 未导出 Blender collider；交互先使用可见节点射线检测，后续按需单独导出简化 collider。
- [x] 可交互部件能独立高亮、移动或展开。
- [x] 屏幕文字不是烘焙在模型贴图中的死内容。
- [ ] 桌面端和移动端均保持可接受帧率，且不降低 DPR/MSAA、不使用静态模型替换。
- [x] 新模型不会破坏现有昼夜主题和文章入口。

# AI Provider 配置管理重构

> 状态:🔄 进行中（代码已落地，待数据迁移与全场景手动验收）
> 关联设计:[AI Provider 配置管理](../designs/ai/ai-config-profiles.md)

## 1. 背景与动机

当前 AI 配置存在两层问题:

1. **数据层**:`tbConfig` 表用 3 个扁平 JSON key(`ai.profile_groups` / `ai.active_profiles` / `ai.fallback_profiles`)存放所有场景配置。每个场景(chat/ai_text/description/embedding/image_gen/tts/create_agent)各自存一份完整的 `api_key + model + base_url + temperature ...`。
2. **复用性差**:没有 provider 抽象。同一个供应商(base_url + api_key)在 chat / ai_text / description / create_agent 四个场景下要各填一遍;改一次 api_key 要改 N 处;模型名靠手填字符串,填错只能在运行时报错。

重构目标:引入 **provider(供应商)** 概念,base_url + api_key 只维护一次;场景绑定(provider + 模型 + 温度等);每场景激活一个绑定。形态对标 ccswitch。

## 2. 关键决策(已确认)

| 决策点 | 选择 |
|---|---|
| Provider 模型清单 | provider 存 `models[]`,后台支持「一键拉取」(走 OpenAI 兼容 `/models`);拉取失败则手填。**不考虑 anthropic 等非 OpenAI 兼容接口的拉取** |
| 协议(protocol) | **暂不引入**。默认全走 OpenAI 兼容协议,后端工厂层保持现状不重写 |
| 旧数据迁移 | 迁移到新表,**直接弃用旧 3 个 JSON key**。写一次性迁移脚本,不保留兼容回退层 |
| UI 归属 | 并入 `/c/config`,三个 Tab:**单项配置 | Provider | 场景绑定**。从 `ai-lab` 移除配置入口 |

## 3. 数据模型

新增三张表,放在 `prisma/schema/ai.prisma`。

### 3.1 `TbAiProvider`(供应商)

```
model TbAiProvider {
  id          Int       @id @default(autoincrement())
  name        String    @db.VarChar(100)   // 显示名,如 "DeepSeek 官方"
  base_url    String    @db.VarChar(500)
  api_key     String    @db.VarChar(500)   // 明文存储(与现状一致),见 §8 安全说明
  models      Json?                          // string[] 可用模型清单
  status      Int       @default(1)         // 1 启用 0 停用
  remark      String?   @db.Text
  created_at  DateTime  @default(now())
  updated_at  DateTime  @default(now())

  bindings    TbAiScenarioBinding[]

  @@map("tb_ai_provider")
}
```

### 3.2 `TbAiScenarioBinding`(场景绑定)

```
model TbAiScenarioBinding {
  id           Int       @id @default(autoincrement())
  scenario     String    @db.VarChar(50)   // chat / ai_text / description / embedding / image_gen / tts / create_agent
  provider_id  Int
  model        String    @db.VarChar(200)  // 从 provider.models 选,或手填
  // 场景专属参数,可空
	  temperature  Float?
  max_tokens   Int?
  dimensions   Int?                          // embedding 专用
  api_mode     String?   @db.VarChar(50)    // image_gen 专用
  voice        String?   @db.VarChar(100)   // tts 专用
  is_active    Boolean   @default(false)    // 每场景仅 1 条 active
  name         String?   @db.VarChar(100)   // 绑定显示名,如 "DeepSeek-Chat 主用"
  remark       String?   @db.Text
  created_at   DateTime  @default(now())
  updated_at   DateTime  @default(now())

	  provider     TbAiProvider @relation(fields: [provider_id], references: [id], onDelete: Cascade)

  @@unique([scenario, is_active]) // DB 层尽量保证每场景一个 active;实际用应用层 + 该约束兜底
  @@index([scenario])
  @@index([provider_id])
  @@map("tb_ai_scenario_binding")
}
```

	> ⚠️ `@@unique([scenario, is_active])` 对 `is_active=false` 的多条记录会产生冲突(MySQL NULL/重复 bool 行为)。**实际方案**:去掉该 unique,改用应用层在「激活」操作时事务内先把同场景其它记录置 false、再置目标 true。schema 里只保留 `@@index([scenario])`。

### 3.3 `TbAiScenario`(自定义场景)

内置场景在 `src/lib/ai-scenarios.ts` 中硬编码;后台新增的自定义场景写入 `tb_ai_scenario`。

```
model TbAiScenario {
  id             Int      @id @default(autoincrement())
  key            String   @unique @db.VarChar(50)
  label          String   @db.VarChar(100)
  description    String?  @db.Text
  optionalFields Json?
  is_builtin     Boolean  @default(false)
  status         Int      @default(1)
  created_at     DateTime @default(now())
  updated_at     DateTime @default(now())

  @@index([status], name: "idx_ai_scenario_status")
  @@map("tb_ai_scenario")
}
```

## 4. 迁移脚本

一次性 Node 脚本 `scripts/db/migrate-ai-config-to-provider.ts`,逻辑:

1. 读 `tbConfig` 的 `ai.profile_groups` JSON。
2. 按 scenario 遍历,对每条 profile:
   - 以 `base_url` 为去重键写入 `tb_ai_provider`,同 base_url 复用已有 provider。
   - 把 `model` 加入该 provider 的 `models[]`(去重)。
3. 每个 scenario 的**激活 profile** → 写一条 `tb_ai_scenarioBinding`,`is_active=true`,关联上一步的 provider,带 temperature/max_tokens 等场景参数。
4. 非激活 profile → 写 `is_active=false` 的绑定(保留为「候选」,对应旧 fallback 概念)。
5. 迁移完成后**删除** `tbConfig` 中 3 个旧 key。

执行方式(手动):
```bash
pnpm tsx scripts/db/migrate-ai-config-to-provider.ts
```

幂等设计:脚本先按 `base_url` 判存,可重复执行。

## 5. 消费端适配

### 5.1 保持 `getAIConfig(scenario)` 签名不变

`src/lib/ai-config.ts` 的 `getAIConfig` / `getAIConfigCandidates` **签名保持不变**,内部实现改为查新表:

- `getAIConfig(scenario)`:查 `tb_ai_scenario_binding` where `scenario + is_active=true`,join provider 拿 base_url/api_key,拼成 `AIConfig` 返回。
- `getAIConfigCandidates(scenario)`:返回该场景所有绑定(active 优先),供降级重试。

消费端 6 个调用点**无需改动**:
- `src/lib/ai.ts`
- `src/services/image-gen.ts`
- `src/services/tts.ts`
- `src/services/embedding/embedding.ts`
- `src/services/ai-lab-run.ts`
- (其它经 `getAIConfig` 间接调用)

### 5.2 删除旧 service

`src/services/ai-config-profiles.ts` 整文件删除;`buildLegacyAIProfiles` 一并移除(本次会话已对其做容错,但随重构整体删掉)。`src/lib/ai-config-profiles.ts` 中的类型/常量(`AIConfigScenario`、`AI_SCENARIO_META`、字段标签)保留并迁移到新模块,UI 复用。

### 5.3 缓存

`getAIConfig` 对新表查询结果做 5 分钟内存缓存,key 仍按 scenario。Provider 更新/删除、Binding 新建/更新/删除、Binding 激活后都需要 `clearAIConfigCache()`。

## 6. 后端 API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/config/ai/providers` | 列出所有 provider(含 models) |
| POST | `/api/config/ai/providers` | 新建 provider |
| PUT | `/api/config/ai/providers/[id]` | 更新 provider |
| DELETE | `/api/config/ai/providers/[id]` | 删除 provider(级联删除 binding) |
| POST | `/api/config/ai/providers/[id]/fetch-models` | 调 `base_url + /models` 拉取模型列表,回填 `models[]`;失败返回错误由前端手填 |
| GET | `/api/config/ai/bindings` | 列出所有场景绑定(按 scenario 分组) |
| PUT | `/api/config/ai/bindings` | 批量 upsert 绑定 |
| POST | `/api/config/ai/bindings/[id]/activate` | 激活某绑定(事务内重置同场景其它 active)+ 清缓存 |
| DELETE | `/api/config/ai/bindings/[id]` | 删除绑定 + 清缓存 |
| GET | `/api/config/ai/scenarios` | 列出内置 + 自定义场景 |
| POST | `/api/config/ai/scenarios` | 创建自定义场景 |

权限复用现有 `CONFIG_VIEW` / `CONFIG_EDIT`(见 `src/constants/permissions`),并在 API registry 注册 descriptor。

`fetch-models` 实现要点:
- 用 provider 的 base_url + api_key,`fetch(\`${baseUrl}/models\`)`。
- 仅支持 OpenAI 兼容协议;超时 10s;失败返回错误,前端降级为手填输入框。

## 7. 前端 UI

`/c/config/page.tsx` 改为 **Tabs** 容器:

```
单项配置 | Provider | 场景绑定
```

### Tab 1:单项配置
现有 `src/app/c/config/page.tsx` 的单项配置(key-value)列表,原样迁入。

### Tab 2:Provider 管理
- 列表:Name / Base URL / 模型数 / 状态 / 操作(编辑、拉取模型、删除)。
- 表单:Name、Base URL、API Key、models(标签式可增删,带「一键拉取」按钮)、备注。
- 拉取按钮:调 `fetch-models`,成功回填 models;失败提示并允许手填。

### Tab 3:场景绑定
- 按 7 个 scenario 分组(每组用 `AI_SCENARIO_META` 的 label/description 做标题)。
- 每组内:绑定列表 + 「新建绑定」。
- 绑定表单:选 provider(下拉) → 模型(从该 provider.models 下拉或手填) → 场景参数(temperature/max_tokens/dimensions/api_mode/voice,按 `optionalFields` 动态显示) → 名称。
- 每条绑定有「激活」单选操作;激活态高亮。

### 移除
- 删除 `src/app/c/ai-lab/config/` 及侧边栏入口。
- 删除 `src/app/c/config/AIProfilePanel.tsx`。

## 8. 风险与说明

- **api_key 明文存储**:与现状一致(`tbConfig.value` 也是明文)。本计划不引入加密,后续可单独做加密列。若你希望本次就加密,需追加方案(对称加密 + 密钥管理),工作量 +1。
- **无 protocol 字段**:Claude 官方协议、非 OpenAI 兼容供应商本期调不通。当前所有场景实际都用 OpenAI 兼容协议(DeepSeek/Qwen/智谱等),风险可控。后续若要接 Claude 官方,再补 protocol + 工厂层。
- **激活约束靠应用层**:并发激活可能短时出现两条 active,事务 + 先重置后激活可规避;不做 DB unique。
- **Provider 删除会级联删除绑定**:删除前端需要明确提示绑定数量,避免误删 active binding。
- **迁移不可逆**:旧 key 删除后无法回退。建议迁移脚本先 dry-run 打印将导入的 provider/binding 数量,确认后再执行真删除。

## 9. 实施顺序

1. schema 新增三表 → `pnpm prisma:push`(开发)→ 生成 client。
2. 写 service 层(`src/services/ai-provider.ts` / `ai-scenario-binding.ts`)。
3. 改 `src/lib/ai-config.ts` 的 `getAIConfig` 走新表。
4. 7 个 API 路由 + descriptor 注册。
5. 前端三 Tab UI。
6. 迁移脚本 + 执行。
7. 删除旧 service / 旧 UI / 旧 key。
8. `pnpm typecheck && pnpm lint`,手动验证 7 个消费场景。

## 10. 验收

- [ ] 7 个场景通过新 UI 配置后,`/chat`、文章描述生成、编辑器 AI、向量化、图片生成、TTS、创作 Agent 各跑一次,确认走通。
- [ ] provider 改 api_key 一处,所有引用该 provider 的场景立即生效(验证复用)。
- [ ] 「一键拉取」对 DeepSeek/Qwen 等 OpenAI 兼容供应商成功;对无 `/models` 的供应商优雅降级手填。
- [ ] 激活切换后 5 分钟内缓存生效(或立即清缓存)。
- [ ] 旧 3 个 JSON key 已删除,`tbConfig` 中无残留 AI 配置。

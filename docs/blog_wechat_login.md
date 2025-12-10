# Next.js 项目集成微信小程序扫码登录完整实现

## 背景

在开发博客系统时，为了提升用户体验，我决定集成微信小程序扫码登录功能。这样用户无需记住密码，只需用微信扫码即可快速登录。更重要的是，对于未注册的用户，扫码后会自动创建账号，大大降低了注册门槛。

## 功能特性

本次实现包含以下核心功能：

1. **扫码登录**：未注册用户扫码后自动注册账号
2. **快速登录**：已注册用户扫码即可登录，无需密码
3. **账号绑定**：已登录用户可绑定微信，方便后续快速登录
4. **解绑功能**：支持解绑已绑定的微信账号

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **数据库**: MySQL + Prisma ORM
- **缓存**: Redis (ioredis)
- **UI**: Ant Design 6.0
- **微信 API**: 微信小程序开放接口

## 实现架构

### 核心流程

```
前端页面 → 获取Token → 生成小程序码 → 显示二维码
    ↓
用户扫码 → 小程序授权 → 确认授权 → 自动注册/登录
    ↓
获取登录信息 → 设置Token → 登录成功
```

### 数据存储

- **Redis**: 存储临时扫码数据（token、状态、用户信息），1小时自动过期
- **MySQL**: 存储用户信息和微信 openid 绑定关系

## 实现细节

### 1. 数据库设计

在用户表中添加 `wx_open_id` 字段用于存储微信 openid：

```prisma
model TbUser {
  // ... 其他字段
  wx_open_id      String?   @db.VarChar(255) // 微信小程序 openID
  // ...
}
```

### 2. 微信工具类

创建 `Wechat` 工具类封装微信 API 调用：

```typescript
export class Wechat {
  // 获取 access_token
  async getAccessToken(): Promise<AccessTokenResponse>
  
  // code2session 获取 openid
  async code2Session(code: string): Promise<Code2SessionResponse>
  
  // 生成小程序码
  async getUnlimitedQRCode(
    scene: string,
    page?: string,
    envVersion?: 'release' | 'trial' | 'develop'
  ): Promise<Buffer>
}
```

### 3. API 路由设计

实现了 8 个核心 API 接口：

- `GET /api/wechat/getToken` - 生成扫码 token
- `GET /api/wechat/getImg` - 获取小程序码图片
- `GET /api/wechat/info` - 获取用户信息
- `GET /api/wechat/status` - 获取扫码状态
- `PUT /api/wechat/status` - 更新扫码状态
- `POST /api/wechat/confirm` - 确认授权（自动注册/登录）
- `POST /api/wechat/bind` - 绑定微信
- `DELETE /api/wechat/bind` - 解绑微信

### 4. 自动注册逻辑

在 `confirm` 接口中实现了智能的用户处理逻辑：

```typescript
// 查找是否已有该 openid 的用户
let user = await prisma.tbUser.findFirst({
  where: { wx_open_id: openid },
});

// 如果没有找到用户，创建新用户（自动注册）
if (!user) {
  const account = `wx_${uuidv4().substring(0, 8)}`;
  user = await prisma.tbUser.create({
    data: {
      account,
      password: uuidv4(), // 随机密码
      nickname: nickName || '微信用户',
      avatar: avatarUrl || '',
      wx_open_id: openid,
      role: UserRole.USER,
      status: 1,
      registered_time: new Date(),
    },
  });
}
```

### 5. 前端组件

#### WechatQRLogin 组件

扫码登录组件，包含：
- 二维码显示
- 状态轮询（每2秒检查一次）
- 自动刷新功能

#### WechatBindCard 组件

微信绑定卡片，用于个人中心：
- 显示绑定状态
- 绑定/解绑操作
- 扫码绑定弹窗

## 关键技术点

### 1. Token 生成

微信小程序场景值限制为 32 位，因此使用 UUID v4 并去掉连字符：

```typescript
function createToken(): string {
  return uuidv4().replace(/-/g, '').toUpperCase();
}
```

### 2. 状态轮询

前端每 2 秒轮询一次状态接口，检测扫码和授权状态：

```typescript
timerRef.current = setInterval(() => {
  getStatus(newToken);
}, 2000);
```

状态值：
- `-1`: 未扫码
- `0`: 已扫码未授权
- `1`: 已授权

### 3. 小程序码生成

使用微信 `getwxacodeunlimit` 接口生成小程序码，需要注意：

- 成功时返回图片 Buffer
- 失败时返回 JSON 错误信息
- 需要根据 `content-type` 判断成功或失败

### 4. 安全性保障

- Token 有效期：1 小时自动过期
- 唯一性校验：同一个 openid 只能绑定一个账号
- 用户授权：必须在小程序中主动授权
- HTTPS：生产环境必须使用 HTTPS

## 配置步骤

### 1. 环境变量

```bash
# 微信小程序配置
WX_APP_ID=你的小程序AppID
WX_APP_SECRET=你的小程序AppSecret

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 2. 数据库迁移

```bash
pnpm prisma db push
```

### 3. 微信小程序配置

- 在微信小程序管理后台配置服务器域名白名单
- 创建 `pages/index/index` 页面处理扫码逻辑
- 在小程序中调用授权和确认接口

## 使用体验

### 扫码登录流程

1. 用户访问登录页面，切换到「微信登录」标签页
2. 页面自动生成并显示二维码
3. 用户使用微信扫描二维码
4. 小程序弹出授权确认
5. 用户确认后，自动完成登录（新用户自动注册）
6. 页面跳转到后台管理页面

### 绑定微信流程

1. 已登录用户访问个人中心
2. 在「微信绑定」卡片中点击「绑定微信」
3. 扫描弹出的二维码并确认授权
4. 绑定成功后可使用微信扫码登录

## 遇到的问题和解决方案

### 问题1：环境变量格式错误

**问题**：`.env` 文件中配置有多余的逗号，导致读取失败

**解决**：确保环境变量格式正确，不要有多余的引号和逗号

```bash
# ❌ 错误
WX_APP_ID="wxf6fafa413396f3bd",

# ✅ 正确
WX_APP_ID=wxf6fafa413396f3bd
```

### 问题2：小程序码生成失败

**问题**：微信 API 返回错误信息，但错误处理不够详细

**解决**：改进错误处理，显示详细的错误信息：

```typescript
const errorMsg = Buffer.from(response.data).toString('utf-8');
try {
  const errorJson = JSON.parse(errorMsg);
  throw new Error(`生成小程序码失败: ${errorJson.errmsg || errorMsg}`);
} catch {
  throw new Error(`生成小程序码失败: ${errorMsg}`);
}
```

### 问题3：场景值长度限制

**问题**：UUID v4 生成的 token 超过 32 位限制

**解决**：去掉连字符，确保长度在 32 位以内

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   └── wechat/          # 微信相关 API
│   ├── login/
│   │   └── page.tsx         # 登录页（含扫码登录）
│   └── c/
│       └── user/
│           └── info/
│               └── page.tsx # 个人中心（含微信绑定）
├── components/
│   ├── WechatQRLogin.tsx    # 扫码登录组件
│   └── WechatBindCard.tsx   # 微信绑定卡片
└── lib/
    └── wechat.ts            # 微信工具类
```

## 总结

通过本次实现，成功为 Next.js 博客系统集成了微信小程序扫码登录功能。主要亮点：

1. **用户体验优化**：扫码即可登录，无需记忆密码
2. **自动注册**：新用户扫码后自动创建账号，降低注册门槛
3. **安全可靠**：Token 有时效性，一个微信只能绑定一个账号
4. **代码规范**：使用 TypeScript，遵循项目代码规范
5. **文档完善**：提供了详细的使用文档和测试清单

整个实现过程参考了[利用微信小程序扫码授权](https://www.nnnnzs.cn/2022/05/13/%E5%88%A9%E7%94%A8%E5%BE%AE%E4%BF%A1%E5%B0%8F%E7%A8%8B%E5%BA%8F%E6%89%AB%E7%A0%81%E6%8E%88%E6%9D%83)这篇文章的思路，并结合 Next.js 16 的特性进行了适配和优化。

## 参考资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [小程序码生成接口](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/qr-code/wxacode.getUnlimited.html)
- [Next.js 官方文档](https://nextjs.org/docs)
- [Prisma 文档](https://www.prisma.io/docs)

---

**技术栈**: Next.js 16 + TypeScript + Prisma + Redis + 微信小程序 API  
**实现时间**: 2024年12月

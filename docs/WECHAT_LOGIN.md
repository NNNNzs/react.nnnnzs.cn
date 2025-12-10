# 微信小程序扫码登录功能文档

## 功能概述

本项目已集成微信小程序扫码登录功能，支持以下特性：

1. **扫码登录**：未注册用户扫码后自动注册账号
2. **账号绑定**：已登录用户可绑定微信，方便后续快速登录
3. **解绑功能**：支持解绑已绑定的微信账号

## 配置步骤

### 1. 环境变量配置

在项目根目录的 `.env` 文件中添加以下配置：

```bash
# 微信小程序配置
WX_APP_ID=你的小程序AppID
WX_APP_SECRET=你的小程序AppSecret
```

### 2. 数据库迁移

确保数据库用户表包含 `wx_open_id` 字段。执行以下命令应用数据库变更：

```bash
# 开发环境
pnpm prisma db push

# 或者使用迁移（生产环境推荐）
pnpm prisma migrate dev
```

### 3. Redis 配置

扫码登录功能依赖 Redis 存储临时数据。确保以下环境变量已配置：

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=你的Redis密码（如果有）
REDIS_DB=0
```

### 4. 微信小程序配置

#### 4.1 创建小程序页面

在你的微信小程序项目中创建 `pages/index/index` 页面（或使用现有页面）。

#### 4.2 获取场景值

在小程序的 `onLoad` 生命周期中获取场景值：

```javascript
Page({
  onLoad(options) {
    // 从扫码进入时获取场景值
    const scene = options.scene || options.q;
    
    if (scene) {
      this.handleScanLogin(scene);
    }
  },
  
  async handleScanLogin(token) {
    // 1. 获取用户授权
    wx.getUserProfile({
      desc: '用于扫码登录',
      success: (res) => {
        const { nickName, avatarUrl } = res.userInfo;
        
        // 2. 获取登录凭证
        wx.login({
          success: (loginRes) => {
            // 3. 调用你的后端接口确认授权
            this.confirmAuth(token, loginRes.code, nickName, avatarUrl);
          }
        });
      }
    });
  },
  
  async confirmAuth(token, code, nickName, avatarUrl) {
    // 先通过 code2session 获取 openid
    const sessionRes = await wx.request({
      url: 'https://你的域名/api/wechat/code2Session',
      method: 'GET',
      data: { code }
    });
    
    const { openid } = sessionRes.data;
    
    // 确认授权
    await wx.request({
      url: 'https://你的域名/api/wechat/confirm',
      method: 'POST',
      data: {
        token,
        openid,
        nickName,
        avatarUrl
      }
    });
    
    wx.showToast({
      title: '授权成功',
      icon: 'success'
    });
  }
});
```

#### 4.3 配置服务器域名

在微信小程序管理后台配置以下域名为合法请求域名：

```
https://你的域名
https://api.weixin.qq.com
```

## 功能使用

### 扫码登录

1. 访问登录页面：`/login`
2. 切换到「微信登录」标签页
3. 使用微信扫描显示的二维码
4. 在小程序中确认授权
5. 自动完成登录（首次扫码会自动注册账号）

### 绑定微信

1. 已登录用户访问个人中心：`/c/user/info`
2. 在「微信绑定」卡片中点击「绑定微信」
3. 扫描弹出的二维码并确认授权
4. 绑定成功后可使用微信扫码登录

### 解绑微信

1. 访问个人中心：`/c/user/info`
2. 在「微信绑定」卡片中点击「解绑微信」
3. 确认解绑操作

## API 接口说明

### 1. 获取 Token

**接口**: `GET /api/wechat/getToken`

**响应**:
```json
{
  "status": true,
  "data": "32位TOKEN字符串"
}
```

### 2. 获取小程序码

**接口**: `GET /api/wechat/getImg?token=xxx&env=trial`

**参数**:
- `token`: 从 getToken 接口获取的 token
- `env`: 环境版本（release/trial/develop）

**响应**: PNG 图片

### 3. 获取扫码状态

**接口**: `GET /api/wechat/status?token=xxx`

**响应**:
```json
{
  "status": true,
  "data": -1  // -1: 未扫码, 0: 已扫码未授权, 1: 已授权
}
```

### 4. 确认授权

**接口**: `POST /api/wechat/confirm`

**请求体**:
```json
{
  "token": "扫码token",
  "openid": "微信openid",
  "nickName": "用户昵称",
  "avatarUrl": "头像URL"
}
```

**响应**:
```json
{
  "status": true,
  "data": {
    "msg": "授权成功"
  }
}
```

### 5. 绑定微信

**接口**: `POST /api/wechat/bind`

**请求头**: `Authorization: Bearer 登录token`

**请求体**:
```json
{
  "token": "扫码token"
}
```

**响应**:
```json
{
  "status": true,
  "data": {
    "msg": "绑定成功"
  }
}
```

### 6. 解绑微信

**接口**: `DELETE /api/wechat/bind`

**请求头**: `Authorization: Bearer 登录token`

**响应**:
```json
{
  "status": true,
  "data": {
    "msg": "解绑成功"
  }
}
```

## 技术实现

### 核心流程

1. **生成二维码**：
   - 前端调用 `/api/wechat/getToken` 获取 token
   - 使用 token 调用 `/api/wechat/getImg` 生成小程序码
   - token 存储在 Redis 中，1 小时过期

2. **轮询状态**：
   - 前端每 2 秒调用 `/api/wechat/status` 检查扫码状态
   - 状态变化：-1（未扫码）→ 0（已扫码）→ 1（已授权）

3. **授权确认**：
   - 小程序端调用 `/api/wechat/confirm` 传递用户信息
   - 后端根据 openid 查找用户，不存在则自动注册
   - 生成登录 token 并更新 Redis 状态

4. **完成登录**：
   - 前端检测到状态为 1，调用 `/api/wechat/info` 获取登录信息
   - 设置 cookie 或 localStorage 存储 token
   - 跳转到目标页面

### 数据存储

#### Redis Key 格式

```
wechat_screen_key/{token}
```

#### 存储数据结构

```json
{
  "token": "扫码token",
  "status": 1,
  "appName": "博客登录",
  "createTime": "2024-01-01 12:00:00",
  "openid": "微信openid",
  "nickName": "用户昵称",
  "avatarUrl": "头像URL",
  "userId": 123,
  "loginToken": "登录token"
}
```

### 安全性

1. **Token 有效期**：所有 token 默认 1 小时后自动过期
2. **唯一性校验**：同一个 openid 只能绑定一个账号
3. **授权确认**：用户必须在小程序中主动授权
4. **HTTPS**：生产环境必须使用 HTTPS 协议

## 文件结构

```
src/
├── app/
│   ├── api/
│   │   └── wechat/
│   │       ├── getToken/route.ts    # 获取 token
│   │       ├── getImg/route.ts      # 生成小程序码
│   │       ├── info/route.ts        # 获取用户信息
│   │       ├── status/route.ts      # 获取/更新状态
│   │       ├── confirm/route.ts     # 确认授权
│   │       └── bind/route.ts        # 绑定/解绑微信
│   └── login/
│       └── page.tsx                  # 登录页（含扫码登录）
├── components/
│   ├── WechatQRLogin.tsx            # 扫码登录组件
│   └── WechatBindCard.tsx           # 微信绑定卡片
└── lib/
    └── wechat.ts                     # 微信工具类
```

## 故障排查

### 1. 无法生成二维码

- 检查环境变量 `WX_APP_ID` 和 `WX_APP_SECRET` 是否配置正确
- 检查网络连接，确保能访问微信 API
- 查看服务器日志，检查 access_token 是否获取成功

### 2. 扫码后无响应

- 检查 Redis 是否正常运行
- 确认小程序是否正确调用了 `/api/wechat/confirm` 接口
- 查看浏览器控制台和服务器日志

### 3. 绑定失败

- 确认用户已登录
- 检查该 openid 是否已被其他账号绑定
- 查看服务器日志获取详细错误信息

## 参考资料

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [小程序码生成接口](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/qr-code/wxacode.getUnlimited.html)
- [原作者博客文章](https://www.nnnnzs.cn/2022/05/13/%E5%88%A9%E7%94%A8%E5%BE%AE%E4%BF%A1%E5%B0%8F%E7%A8%8B%E5%BA%8F%E6%89%AB%E7%A0%81%E6%8E%88%E6%9D%83)

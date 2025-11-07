# 腾讯云 COS 文件上传配置

本项目使用腾讯云 COS（对象存储）进行文件上传，参考 `api.nnnnzs.cn` 的实现。

## 📋 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# 腾讯云 COS 配置
SecretId=your-cos-secret-id
SecretKey=your-cos-secret-key
Bucket=your-bucket-name
Region=ap-shanghai
CDN_URL=https://static.your-domain.com
```

### 配置说明

- **SecretId**: 腾讯云 API 密钥 ID
- **SecretKey**: 腾讯云 API 密钥 Key
- **Bucket**: COS 存储桶名称
- **Region**: COS 存储桶地域（如：ap-shanghai、ap-beijing）
- **CDN_URL**: CDN 加速域名（用于返回文件访问 URL）

## 🔧 获取腾讯云 COS 配置

### 1. 创建存储桶

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 进入 [对象存储 COS](https://console.cloud.tencent.com/cos)
3. 创建存储桶，记录：
   - 存储桶名称（Bucket）
   - 所属地域（Region）

### 2. 获取 API 密钥

1. 进入 [访问管理](https://console.cloud.tencent.com/cam/capi)
2. 创建 API 密钥，记录：
   - SecretId
   - SecretKey

### 3. 配置 CDN（可选）

1. 进入 [CDN 控制台](https://console.cloud.tencent.com/cdn)
2. 添加域名，绑定到 COS 存储桶
3. 记录 CDN 加速域名（CDN_URL）

## 📝 API 接口

### 上传文件

**接口**: `POST /api/fs/upload`

**请求格式**: `multipart/form-data`

**请求参数**:
- `inputFile`: 文件（File 类型）

**响应格式**:
```json
{
  "status": true,
  "data": "https://static.nnnnzs.cn/upload/abc123.png",
  "message": "success"
}
```

**错误响应**:
```json
{
  "status": false,
  "message": "错误信息"
}
```

## 💻 使用示例

### 前端上传文件

```typescript
import axios from 'axios';

const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('inputFile', file);

  const response = await axios.post('/api/fs/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`上传进度: ${percent}%`);
      }
    },
  });

  if (response.data.status) {
    return response.data.data; // 返回文件 URL
  } else {
    throw new Error(response.data.message);
  }
};
```

### Markdown 编辑器中使用

`md-editor-rt` 编辑器已集成上传功能，会自动调用 `/api/fs/upload` 接口：

```tsx
import { MdEditor } from 'md-editor-rt';

<MdEditor
  modelValue={content}
  onChange={setContent}
  onUploadImg={async (files, callback) => {
    const urls = await Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append('inputFile', file);
        const res = await axios.post('/api/fs/upload', formData);
        return res.data.data;
      })
    );
    callback(urls);
  }}
/>
```

## 🔒 安全配置

### 1. 权限控制

上传接口应该添加认证中间件，确保只有登录用户才能上传：

```typescript
// src/app/api/fs/upload/route.ts
import { getTokenFromRequest, validateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // 验证 Token
  const token = getTokenFromRequest(request.headers);
  if (!token || !(await validateToken(token))) {
    return NextResponse.json(errorResponse('未授权'), { status: 401 });
  }

  // ... 上传逻辑
}
```

### 2. 文件类型限制

可以添加文件类型和大小限制：

```typescript
// 允许的文件类型
const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const maxSize = 5 * 1024 * 1024; // 5MB

if (!allowedTypes.includes(file.type)) {
  return NextResponse.json(errorResponse('不支持的文件类型'), { status: 400 });
}

if (file.size > maxSize) {
  return NextResponse.json(errorResponse('文件大小超过限制'), { status: 400 });
}
```

### 3. 文件命名

上传的文件会使用 MD5 哈希值命名，避免文件名冲突：

```typescript
const md5Name = createHash('md5')
  .update(file.buffer, 'utf-8')
  .digest('hex');
const Key = `/upload/${md5Name}${ext}`;
```

## 📁 文件存储结构

上传的文件存储在 COS 的 `/upload/` 目录下：

```
/upload/
  ├── abc123def456.png
  ├── 789ghi012jkl.jpg
  └── ...
```

访问 URL 格式：
```
https://static.nnnnzs.cn/upload/abc123def456.png
```

## 🐛 常见问题

### Q: 上传失败，提示 "COS 配置缺失"

A: 检查 `.env` 文件中的 COS 配置是否正确：
- SecretId
- SecretKey
- Bucket
- Region
- CDN_URL

### Q: 上传成功但无法访问

A: 检查：
1. CDN_URL 配置是否正确
2. COS 存储桶的访问权限是否设置为"公有读"
3. CDN 域名是否已绑定到存储桶

### Q: 上传速度慢

A: 可以：
1. 使用 CDN 加速
2. 选择离用户较近的地域
3. 优化图片大小（压缩）

### Q: 如何限制文件大小

A: 在 API 路由中添加大小检查：

```typescript
const maxSize = 5 * 1024 * 1024; // 5MB
if (file.size > maxSize) {
  return NextResponse.json(errorResponse('文件大小超过限制'), { status: 400 });
}
```

## 📚 相关资源

- [腾讯云 COS 文档](https://cloud.tencent.com/document/product/436)
- [COS Node.js SDK](https://cloud.tencent.com/document/product/436/8629)
- [md-editor-rt 文档](https://imzbf.github.io/md-editor-rt/)


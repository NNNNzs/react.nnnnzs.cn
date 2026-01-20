# 评论系统设计

## 概述

基于数据库的评论系统，支持树形回复结构，多种登录方式绑定。

## 功能特性

- **树形评论结构**：支持多层级回复（最大深度 5 层）
- **多种绑定方式**：邮箱、GitHub、微信任一绑定即可评论
- **用户头像**：显示用户的 avatar 字段
- **软删除**：删除评论仅标记，不实际删除数据
- **点赞功能**：支持评论点赞

## 数据库设计

### TbComment 表

```prisma
model TbComment {
  id         Int       @id @default(autoincrement())
  post_id    Int       // 关联文章ID
  user_id    Int       // 评论者用户ID
  parent_id  Int?      // 父评论ID（用于回复）
  content    String    @db.Text  // 评论内容（支持Markdown）
  status     Int       @default(1)  // 状态：1-正常，0-隐藏
  is_delete  Int       @default(0)  // 逻辑删除：0-未删除，1-已删除
  like_count Int       @default(0)  // 点赞数
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt

  // 关联关系
  post    TbPost     @relation(fields: [post_id], references: [id])
  user    TbUser     @relation(fields: [user_id], references: [id])
  parent  TbComment? @relation("CommentReplies", fields: [parent_id], references: [id])
  replies TbComment[] @relation("CommentReplies")
}
```

## API 设计

| 方法 | 路由 | 描述 |
|------|------|------|
| GET | `/api/comment/list?postId=xxx` | 获取文章评论列表（树形结构） |
| POST | `/api/comment/create` | 创建评论 |
| DELETE | `/api/comment/[id]` | 删除评论 |
| POST | `/api/comment/[id]/like` | 点赞评论 |

### 权限控制

满足以下**任一条件**即可评论：
- 绑定了邮箱 (`mail` 不为空)
- 绑定了 GitHub (`github_id` 不为空)
- 绑定了微信 (`wx_open_id` 或 `work_wechat_id` 不为空)

## 前端组件

### CommentSection
主容器组件，管理评论状态和交互。

### CommentItem
单条评论组件，支持递归渲染子评论。

### 功能
- 发表评论
- 回复评论
- 删除自己的评论
- 点赞评论
- Markdown 编辑器

## 文件结构

```
src/
├── dto/
│   └── comment.dto.ts           # 评论类型定义
├── services/
│   └── comment.ts               # 评论服务
├── app/api/comment/
│   ├── list/route.ts           # 获取评论列表
│   ├── create/route.ts         # 创建评论
│   ├── [id]/route.ts           # 删除评论
│   └── [id]/like/route.ts      # 点赞评论
└── components/
    └── CommentSection.tsx       # 评论组件
```

## 使用方式

在文章详情页中使用：

```tsx
import CommentSection from '@/components/CommentSection';

export default function ArticleDetail() {
  return (
    <>
      {/* 文章内容 */}
      <CommentSection postId={123} />
    </>
  );
}
```

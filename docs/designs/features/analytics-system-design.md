# 互动与访问统计

全站访客、PV、UV、访问会话及后台看板由 GA4 Data API 提供，详见[全站访客与访问统计](visitor-analytics.md)。客户端沿用已有 GA4/GTM/百度统计配置；服务端只读取 GA4 汇总报表。

## 点赞与文章阅读量

文章与合集点赞使用 `TbLikeRecord` 与 Redis 实现网络地址防刷，默认限制时间为 24 小时，配置键为 `like.ip_limit_hours`。业务接口使用 `src/services/like-record.ts` 的 `canLike` 与 `recordLike`。

| 接口 | 用途 |
| --- | --- |
| `PUT /api/post/fav?id=1&type=likes` | 公开文章点赞 |
| `POST /api/collections/[identifier]/likes` | 合集点赞 |
| `PUT /api/post/fav?id=1&type=visitors` | 原有文章累计阅读量递增 |

文章阅读量使用数据库原子递增，避免并发读改写覆盖。它是文章级业务计数，与 GA4 的页面浏览量、UV 和访问会话分别统计。

## 第三方统计

`src/components/SiteThirdParties.tsx` 按数据库配置加载 GA4、GTM、百度统计和广告脚本。GA4 测量 ID 来自 `ga4.measurement_id`，报表读取使用独立的数字媒体资源 ID 和服务账号只读凭据。

点赞接口不通过服务端 Measurement Protocol 转发事件，不创建自定义 `ga_session_id` Cookie。GA4 报表方案不新增本站访客标识或访问明细表。采集覆盖和数据延迟由实际客户端与 GA4 处理情况决定，详见站点隐私政策。

## 相关规范

- [数据库开发规范](../../rules/database.md)
- [权限系统](../../rules/permission.md)
- [全站访问统计实现](visitor-analytics.md)

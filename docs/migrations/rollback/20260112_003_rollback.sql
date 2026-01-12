-- docs/migrations/rollback/20260112_003_rollback.sql

-- 说明：回滚创建文章版本表和内容块表
-- 作者：系统生成
-- 日期：2026-01-12
-- 原迁移：20260112_003_create_post_version_tables.sql

-- 开始事务
START TRANSACTION;

-- ==================== 删除文章内容块表 ====================
DROP TABLE IF EXISTS tb_post_chunk;

-- ==================== 删除文章版本表 ====================
DROP TABLE IF EXISTS tb_post_version;

COMMIT;

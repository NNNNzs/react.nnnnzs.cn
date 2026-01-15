-- 回滚长期Token表的迁移
-- 迁移时间: 2026-01-15

-- 删除长期Token表
DROP TABLE IF EXISTS `long_term_token`;

-- 说明:
-- 此操作会删除long_term_token表及其所有数据
-- 请确保已备份重要数据后再执行此回滚操作
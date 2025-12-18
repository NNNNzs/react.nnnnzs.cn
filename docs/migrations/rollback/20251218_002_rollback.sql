-- docs/migrations/rollback/20251218_002_rollback.sql

-- 说明：回滚添加手机号字段
-- 作者：开发者
-- 日期：2025-12-18
-- 原迁移：20251218_002_add_user_phone.sql

-- 开始事务
START TRANSACTION;

-- 检查字段是否存在
SELECT COUNT(*) INTO @column_exists
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'phone';

-- 如果存在则删除
IF @column_exists > 0 THEN
    -- 删除索引
    ALTER TABLE tb_user 
    DROP INDEX idx_phone;
    
    -- 删除字段
    ALTER TABLE tb_user 
    DROP COLUMN phone;
    
    -- 更新迁移记录
    INSERT INTO tb_migration_history 
    (migration_name, execution_time, status, checksum)
    VALUES 
    ('rollback_20251218_002_add_user_phone.sql', 0, 'success', MD5('rollback_phone'));
    
    SELECT '✓ 回滚成功: tb_user.phone' AS result;
ELSE
    SELECT '○ 字段不存在: tb_user.phone' AS result;
END IF;

COMMIT;


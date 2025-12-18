-- docs/migrations/20251218_002_add_user_phone.sql

-- 说明：为用户表添加手机号字段
-- 作者：开发者
-- 日期：2025-12-18
-- 影响表：tb_user
-- 回滚脚本：rollback/20251218_002_rollback.sql

-- 开始事务
START TRANSACTION;

-- 检查字段是否存在
SELECT COUNT(*) INTO @column_exists
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'phone';

-- 如果不存在则添加
IF @column_exists = 0 THEN
    -- 添加字段
    ALTER TABLE tb_user 
    ADD COLUMN phone VARCHAR(20) NULL AFTER email;
    
    -- 添加索引
    ALTER TABLE tb_user 
    ADD INDEX idx_phone (phone);
    
    -- 更新迁移记录
    INSERT INTO tb_migration_history 
    (migration_name, execution_time, status, checksum)
    VALUES 
    ('20251218_002_add_user_phone.sql', 0, 'success', MD5('phone_field'));
    
    SELECT '✓ 字段添加成功: tb_user.phone' AS result;
ELSE
    SELECT '○ 字段已存在: tb_user.phone' AS result;
END IF;

COMMIT;


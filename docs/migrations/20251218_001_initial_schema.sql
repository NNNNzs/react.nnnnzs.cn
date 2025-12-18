-- docs/migrations/20251218_001_initial_schema.sql

-- 说明：初始数据库结构（基于当前 schema.prisma）
-- 作者：系统生成
-- 日期：2025-12-18
-- 影响表：tb_user, tb_post, tb_comment, tb_tag, tb_config

-- 开始事务
START TRANSACTION;

-- ==================== 用户表 ====================
SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user';

IF @table_exists = 0 THEN
    CREATE TABLE tb_user (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(100),
        avatar VARCHAR(255),
        email VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        github_id VARCHAR(100),
        wechat_id VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_delete INT DEFAULT 0,
        UNIQUE KEY uk_username (username),
        UNIQUE KEY uk_github_id (github_id),
        UNIQUE KEY uk_wechat_id (wechat_id),
        INDEX idx_role (role),
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
    
    SELECT '✓ 创建表: tb_user' AS result;
ELSE
    SELECT '○ 表已存在: tb_user' AS result;
END IF;

-- ==================== 文章表 ====================
SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_post';

IF @table_exists = 0 THEN
    CREATE TABLE tb_post (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200),
        content TEXT,
        category VARCHAR(50),
        tags VARCHAR(200),
        date DATETIME,
        hide VARCHAR(1) DEFAULT '0',
        visitors INT DEFAULT 0,
        likes INT DEFAULT 0,
        user_id BIGINT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_delete INT DEFAULT 0,
        INDEX idx_category (category),
        INDEX idx_date (date),
        INDEX idx_hide (hide),
        INDEX idx_user (user_id),
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章表';
    
    SELECT '✓ 创建表: tb_post' AS result;
ELSE
    SELECT '○ 表已存在: tb_post' AS result;
END IF;

-- ==================== 评论表 ====================
SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_comment';

IF @table_exists = 0 THEN
    CREATE TABLE tb_comment (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        post_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        content TEXT NOT NULL,
        parent_id BIGINT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_delete INT DEFAULT 0,
        INDEX idx_post (post_id),
        INDEX idx_user (user_id),
        INDEX idx_parent (parent_id),
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论表';
    
    SELECT '✓ 创建表: tb_comment' AS result;
ELSE
    SELECT '○ 表已存在: tb_comment' AS result;
END IF;

-- ==================== 标签表 ====================
SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_tag';

IF @table_exists = 0 THEN
    CREATE TABLE tb_tag (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description VARCHAR(200),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_delete INT DEFAULT 0,
        UNIQUE KEY uk_name (name),
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签表';
    
    SELECT '✓ 创建表: tb_tag' AS result;
ELSE
    SELECT '○ 表已存在: tb_tag' AS result;
END IF;

-- ==================== 配置表 ====================
SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_config';

IF @table_exists = 0 THEN
    CREATE TABLE tb_config (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL,
        config_value TEXT,
        description VARCHAR(200),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_delete INT DEFAULT 0,
        UNIQUE KEY uk_key (config_key),
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配置表';
    
    SELECT '✓ 创建表: tb_config' AS result;
ELSE
    SELECT '○ 表已存在: tb_config' AS result;
END IF;

-- ==================== 迁移记录表 ====================
SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_migration_history';

IF @table_exists = 0 THEN
    CREATE TABLE tb_migration_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        execution_time INT COMMENT '执行时间（毫秒）',
        status ENUM('success', 'failed') NOT NULL,
        error_message TEXT,
        checksum VARCHAR(64),
        INDEX idx_name (migration_name),
        INDEX idx_status (status),
        INDEX idx_executed (executed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='迁移记录表';
    
    SELECT '✓ 创建表: tb_migration_history' AS result;
ELSE
    SELECT '○ 表已存在: tb_migration_history' AS result;
END IF;

-- ==================== 记录迁移执行 ====================
INSERT INTO tb_migration_history 
(migration_name, execution_time, status, checksum)
VALUES 
('20251218_001_initial_schema.sql', 0, 'success', MD5('initial_schema'));

COMMIT;

SELECT '✓ 所有迁移完成！' AS final_result;


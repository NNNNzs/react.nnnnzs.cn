-- docs/migrations/20260112_003_create_post_version_tables.sql

-- 说明：创建文章版本表和内容块表，用于增量向量化和版本管理
-- 作者：系统生成
-- 日期：2026-01-12
-- 影响表：tb_post_version, tb_post_chunk
-- 回滚脚本：rollback/20260112_003_rollback.sql

-- 开始事务
START TRANSACTION;

-- ==================== 文章版本表 ====================
CREATE TABLE IF NOT EXISTS tb_post_version (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    version INT NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    INDEX idx_post_version (post_id, version),
    FOREIGN KEY (post_id) REFERENCES tb_post(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES tb_user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章版本表';

-- ==================== 文章内容块表 ====================
CREATE TABLE IF NOT EXISTS tb_post_chunk (
    id VARCHAR(191) PRIMARY KEY COMMENT '稳定 Chunk ID',
    post_id INT NOT NULL,
    version INT NOT NULL,
    type VARCHAR(50) NOT NULL COMMENT 'section | code | list | paragraph',
    content TEXT NOT NULL,
    hash VARCHAR(64) NOT NULL COMMENT '内容 hash (SHA256)',
    embedding_id VARCHAR(191) NULL COMMENT '向量库中的 ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_post_id (post_id),
    INDEX idx_post_version (post_id, version),
    FOREIGN KEY (post_id) REFERENCES tb_post(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章内容块表';

-- 记录迁移（如果迁移记录表存在）
-- 注意：如果 tb_migration_history 表不存在，这行会失败，但不影响表创建
INSERT IGNORE INTO tb_migration_history 
(migration_name, execution_time, status, checksum)
VALUES 
('20260112_003_create_post_version_tables.sql', 0, 'success', MD5('post_version_tables'));

COMMIT;

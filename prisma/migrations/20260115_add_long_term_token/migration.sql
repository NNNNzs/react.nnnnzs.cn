-- 添加长期Token表
-- 迁移时间: 2026-01-15
-- 说明: 用于管理用户的长期API Token

-- 创建长期Token表
CREATE TABLE `long_term_token` (
  `id` VARCHAR(36) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `userId` INT NOT NULL,
  `expiresAt` DATETIME NULL,
  `description` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastUsed` DATETIME NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `token_unique` (`token`),
  KEY `idx_userId` (`userId`),
  KEY `idx_token` (`token`),

  CONSTRAINT `fk_long_term_token_user`
    FOREIGN KEY (`userId`)
    REFERENCES `tb_user` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 说明:
-- 1. id: UUID格式的主键
-- 2. token: 唯一的Token字符串，以LTK_开头
-- 3. userId: 关联的用户ID
-- 4. expiresAt: 过期时间，NULL表示永久有效
-- 5. description: Token用途描述
-- 6. createdAt: 创建时间
-- 7. lastUsed: 最后使用时间

-- 索引说明:
-- - token_unique: 确保Token唯一性
-- - idx_userId: 快速查询用户的Token列表
-- - idx_token: 快速验证Token

-- 外键约束:
-- - 删除用户时自动删除其所有长期Token
-- - 用户ID必须存在于tb_user表中

-- 使用示例:
-- 1. 创建Token: INSERT INTO long_term_token (id, token, userId, expiresAt, description) VALUES (...)
-- 2. 验证Token: SELECT userId FROM long_term_token WHERE token = ? AND (expiresAt IS NULL OR expiresAt > NOW())
-- 3. 获取用户Token列表: SELECT * FROM long_term_token WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > NOW())
-- 4. 更新最后使用时间: UPDATE long_term_token SET lastUsed = NOW() WHERE token = ?
-- 5. 删除Token: DELETE FROM long_term_token WHERE id = ? AND userId = ?
-- 6. 清理过期Token: DELETE FROM long_term_token WHERE expiresAt < NOW() AND expiresAt IS NOT NULL
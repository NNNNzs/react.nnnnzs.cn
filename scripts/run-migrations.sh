#!/bin/bash

# 数据库迁移执行脚本
# 使用方法: ./run-migrations.sh [环境]

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
ENV=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_DIR/docs/migrations"

# 环境变量配置
if [ "$ENV" = "prod" ]; then
    echo -e "${YELLOW}⚠️  生产环境模式${NC}"
    DB_NAME="${DB_NAME:-react_blog_prod}"
    DB_USER="${DB_USER:-root}"
    DB_HOST="${DB_HOST:-localhost}"
    # 生产环境需要密码
    if [ -z "$DB_PASSWORD" ]; then
        echo -e "${RED}错误: 请设置 DB_PASSWORD 环境变量${NC}"
        exit 1
    fi
    DB_PASS_CMD="-p$DB_PASSWORD"
else
    # 开发环境
    DB_NAME="${DB_NAME:-react_blog}"
    DB_USER="${DB_USER:-root}"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PASS_CMD="-p"  # 会提示输入密码
fi

echo "========================================="
echo "数据库迁移执行工具"
echo "环境: $ENV"
echo "数据库: $DB_NAME"
echo "迁移目录: $MIGRATIONS_DIR"
echo "========================================="
echo ""

# 检查迁移目录
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}错误: 迁移目录不存在: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# 检查迁移记录表
echo "检查迁移记录表..."
mysql -u "$DB_USER" $DB_PASS_CMD -h "$DB_HOST" -e "
SELECT COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = '$DB_NAME' 
AND table_name = 'tb_migration_history';
" "$DB_NAME" 2>/dev/null | grep -q "1" || {
    echo -e "${YELLOW}警告: 迁移记录表不存在，正在创建...${NC}"
    cat "$MIGRATIONS_DIR/20251218_001_initial_schema.sql" | mysql -u "$DB_USER" $DB_PASS_CMD -h "$DB_HOST" "$DB_NAME"
}

# 获取已执行的迁移
echo "获取已执行的迁移列表..."
EXECUTED_MIGRATIONS=$(mysql -u "$DB_USER" $DB_PASS_CMD -h "$DB_HOST" -N -e "
SELECT migration_name FROM tb_migration_history 
WHERE status = 'success' 
ORDER BY executed_at DESC;
" "$DB_NAME" 2>/dev/null)

# 获取待执行的迁移
echo "扫描待执行的迁移..."
PENDING_MIGRATIONS=()
for file in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
    filename=$(basename "$file")
    if ! echo "$EXECUTED_MIGRATIONS" | grep -q "$filename"; then
        PENDING_MIGRATIONS+=("$file")
    fi
done

if [ ${#PENDING_MIGRATIONS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ 所有迁移已执行完成！${NC}"
    exit 0
fi

echo -e "${YELLOW}发现 ${#PENDING_MIGRATIONS[@]} 个待执行的迁移:${NC}"
for file in "${PENDING_MIGRATIONS[@]}"; do
    echo "  - $(basename "$file")"
done
echo ""

# 确认执行
if [ "$ENV" != "prod" ]; then
    read -p "是否执行这些迁移? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
else
    echo -e "${RED}⚠️  生产环境迁移将在 3 秒后开始...${NC}"
    sleep 3
fi

# 执行迁移
echo ""
echo "开始执行迁移..."
START_TIME=$(date +%s)

for file in "${PENDING_MIGRATIONS[@]}"; do
    filename=$(basename "$file")
    echo ""
    echo "-----------------------------------------"
    echo "执行: $filename"
    echo "-----------------------------------------"
    
    # 记录开始时间
    migrate_start=$(date +%s%N)
    
    # 执行迁移
    if mysql -u "$DB_USER" $DB_PASS_CMD -h "$DB_HOST" "$DB_NAME" < "$file" 2>&1; then
        migrate_end=$(date +%s%N)
        duration=$(( (migrate_end - migrate_start) / 1000000 ))  # 转换为毫秒
        
        echo -e "${GREEN}✓ 成功 (耗时: ${duration}ms)${NC}"
        
        # 如果迁移文件中没有记录，手动添加记录
        if ! mysql -u "$DB_USER" $DB_PASS_CMD -h "$DB_HOST" -N -e "
            SELECT COUNT(*) FROM tb_migration_history WHERE migration_name = '$filename';
        " "$DB_NAME" 2>/dev/null | grep -q "1"; then
            mysql -u "$DB_USER" $DB_PASS_CMD -h "$DB_HOST" -e "
            INSERT INTO tb_migration_history 
            (migration_name, execution_time, status, checksum)
            VALUES 
            ('$filename', $duration, 'success', MD5('$(cat "$file" | md5sum | cut -d' ' -f1)'));
            " "$DB_NAME" 2>/dev/null
        fi
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "请检查错误信息并手动修复"
        exit 1
    fi
done

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo ""
echo "========================================="
echo -e "${GREEN}✓ 所有迁移执行完成！${NC}"
echo "总耗时: ${TOTAL_TIME} 秒"
echo "执行数量: ${#PENDING_MIGRATIONS[@]}"
echo "========================================="

# 显示迁移记录
echo ""
echo "最近的迁移记录:"
mysql -u "$DB_USER" $DB_PASS_CMD -h "$DB_HOST" -t -e "
SELECT 
    migration_name,
    executed_at,
    execution_time,
    status
FROM tb_migration_history
ORDER BY executed_at DESC
LIMIT 10;
" "$DB_NAME" 2>/dev/null

